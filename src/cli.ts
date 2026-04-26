#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'child_process';
import ora from 'ora';
import pc from 'picocolors';
import { ReviewOrchestrator } from './orchestrator.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { extractAndParseJSON } from './utils/parser.js';
import { FinalReport, FinalReportSchema } from './schemas/contracts.js';
import { applyStoredConfigToEnv, getConfigPath, getDefaultModel, getGeminiApiKey, readUserConfig, updateUserConfig } from './config.js';
import { extractCodeMetadata } from './tools/diff_tools.js';
import { sanitizeDiff } from './utils/diff_sanitizer.js';
import { isBlockedSensitivePath } from './utils/sensitive_paths.js';
import { formatReportMarkdown } from './utils/report_formatter.js';
import { resolveAgentIds } from './agents/agent_parser.js';
import { AgentId } from './agents/catalog.js';
import { LlmResultParseError } from './errors.js';

/** Lê o git diff via spawn com stream limitado a evitar OOM/DoS */
const MAX_DIFF_BYTES = 10 * 1024 * 1024;  // 10MB stdout
const MAX_STDERR_BYTES = 64 * 1024;       // 64KB stderr — evita OOM em erros verbosos
const MAX_CONTEXT_FILE_BYTES = 256 * 1024;
const MAX_CONTEXT_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_CONTEXT_FILES = 50;
const GIT_DIFF_TIMEOUT_MS = 30_000;
const MAX_RAW_RESULT_LOG_BYTES = 16 * 1024;
const MAX_UNTRACKED_DIFF_FILE_BYTES = 256 * 1024;
const MAX_UNTRACKED_FILES = 100;
const MAX_UNTRACKED_LIST_BYTES = 1024 * 1024;

const CHILD_ENV_ALLOWLIST = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'WINDIR',
  'COMSPEC',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
] as const;

function getSanitizedChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }
  return env;
}

function truncateForLog(value: string, maxBytes = MAX_RAW_RESULT_LOG_BYTES): string {
  const valueBytes = Buffer.byteLength(value, 'utf-8');
  if (valueBytes <= maxBytes) return value;

  const truncated = Buffer.from(value, 'utf-8').subarray(0, maxBytes).toString('utf-8');
  return `${truncated}\n[truncated ${valueBytes - maxBytes} bytes]`;
}

function countLines(value: string): number {
  if (value === '') return 0;
  let count = 1;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

function isLikelyBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

function isWithinDirectory(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveExistingFileWithinCwd(inputPath: string): Promise<string> {
  const cwdReal = await fs.promises.realpath(process.cwd());
  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const realPath = await fs.promises.realpath(resolvedPath);

  if (!isWithinDirectory(cwdReal, realPath)) {
    throw new Error(`Caminho fora do projeto: ${inputPath}`);
  }

  return realPath;
}

async function resolveOutputFile(inputPath: string): Promise<string> {
  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const outputDir = path.dirname(resolvedPath);
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputDirReal = await fs.promises.realpath(outputDir);
  return path.join(outputDirReal, path.basename(resolvedPath));
}

async function getGitDiff(): Promise<string> {
  return new Promise((resolve, reject) => {
    // encoding não é suportado no tipo ChildProcessWithoutNullStreams; usamos Buffer
    const proc = spawn('git', ['diff', '--no-ext-diff', 'HEAD'], {
      env: getSanitizedChildEnv(),
    });
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;
    let totalStderrBytes = 0;
    let settled = false; // Flag para evitar race condition após SIGKILL
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(() => reject(new Error(`git diff excedeu o timeout de ${GIT_DIFF_TIMEOUT_MS / 1000}s.`)));
    }, GIT_DIFF_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (!settled) { settled = true; clearTimeout(timeout); fn(); }
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_DIFF_BYTES) {
        proc.kill('SIGKILL');
        finish(() => reject(new Error(`Git diff excede o limite máximo permitido de ${MAX_DIFF_BYTES / 1024 / 1024}MB.`)));
        return;
      }
      chunks.push(chunk);
    });

    // Acumula stderr com limite de tamanho para evitar OOM
    proc.stderr.on('data', (chunk: Buffer) => {
      totalStderrBytes += chunk.length;
      if (totalStderrBytes <= MAX_STDERR_BYTES) {
        stderrChunks.push(chunk);
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        finish(() => reject(new Error(Buffer.concat(stderrChunks).toString('utf-8') || `git diff saiu com codigo ${code}`)));
        return;
      }

      finish(() => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    proc.on('error', (err) => finish(() => reject(err)));
  });
}

async function getUntrackedFilesDiff(): Promise<string> {
  const output = await new Promise<Buffer>((resolve, reject) => {
    const proc = spawn('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
      env: getSanitizedChildEnv(),
    });
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;
    let totalStderrBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(() => reject(new Error(`git ls-files excedeu o timeout de ${GIT_DIFF_TIMEOUT_MS / 1000}s.`)));
    }, GIT_DIFF_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (!settled) { settled = true; clearTimeout(timeout); fn(); }
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_UNTRACKED_LIST_BYTES) {
        proc.kill('SIGKILL');
        finish(() => reject(new Error('Lista de arquivos untracked excede o limite permitido.')));
        return;
      }
      chunks.push(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      totalStderrBytes += chunk.length;
      if (totalStderrBytes <= MAX_STDERR_BYTES) {
        stderrChunks.push(chunk);
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        finish(() => reject(new Error(Buffer.concat(stderrChunks).toString('utf-8') || `git ls-files saiu com codigo ${code}`)));
        return;
      }

      finish(() => resolve(Buffer.concat(chunks)));
    });
    proc.on('error', (err) => finish(() => reject(err)));
  });

  const files = output.toString('utf-8').split('\0').filter(Boolean).slice(0, MAX_UNTRACKED_FILES);
  if (files.length === 0) return '';

  const cwdReal = await fs.promises.realpath(process.cwd());
  const sections: string[] = [];
  let totalBytes = 0;

  for (const file of files) {
    const targetPath = path.resolve(process.cwd(), file);
    let resolvedPath: string;
    try {
      resolvedPath = await fs.promises.realpath(targetPath);
    } catch {
      continue;
    }

    if (!isWithinDirectory(cwdReal, resolvedPath) || isBlockedSensitivePath(resolvedPath)) {
      continue;
    }

    try {
      const stat = await fs.promises.stat(resolvedPath);
      if (!stat.isFile() || stat.size > MAX_UNTRACKED_DIFF_FILE_BYTES) {
        continue;
      }

      const buffer = await fs.promises.readFile(resolvedPath);
      if (isLikelyBinary(buffer)) {
        continue;
      }

      const content = buffer.toString('utf-8');
      const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\n$/, '');
      const lineCount = countLines(normalizedContent);
      const addedLines = normalizedContent ? normalizedContent.replace(/^/gm, '+') : '';
      const section = [
        `diff --git a/${file} b/${file}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${file}`,
        `@@ -0,0 +1,${lineCount} @@`,
        addedLines,
        '',
      ].join('\n');

      totalBytes += Buffer.byteLength(section, 'utf-8');
      if (totalBytes > MAX_DIFF_BYTES) {
        throw new Error(`Diff com arquivos untracked excede o limite maximo permitido de ${MAX_DIFF_BYTES / 1024 / 1024}MB.`);
      }
      sections.push(section);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Diff com arquivos untracked excede')) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'unknown file error';
      console.warn(pc.yellow(`[ALEX] Untracked file omitted for ${file}: ${message}`));
    }
  }

  return sections.join('');
}

async function getLocalReviewDiff(): Promise<string> {
  const [trackedDiff, untrackedDiff] = await Promise.all([
    getGitDiff(),
    getUntrackedFilesDiff(),
  ]);
  return [trackedDiff, untrackedDiff].filter((part) => part.trim()).join('\n');
}

async function getChangedFilesContext(diffContent: string): Promise<string | undefined> {
  const metadata = extractCodeMetadata(diffContent);
  const cwdReal = await fs.promises.realpath(process.cwd());
  let totalBytes = 0;
  let limitReached = false;
  const selectedFiles: Array<{ file: string; resolvedPath: string }> = [];

  const files = metadata.files.slice(0, MAX_CONTEXT_FILES);
  for (const file of files) {
    const targetPath = path.resolve(process.cwd(), file);
    let resolvedPath: string;

    try {
      resolvedPath = await fs.promises.realpath(targetPath);
    } catch {
      continue;
    }

    if (!isWithinDirectory(cwdReal, resolvedPath)) {
      continue;
    }

    if (isBlockedSensitivePath(resolvedPath)) {
      continue;
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile() || stat.size > MAX_CONTEXT_FILE_BYTES) {
      continue;
    }

    const sectionOverheadBytes = Buffer.byteLength(`=== File: ${file} ===\n\n`, 'utf-8');
    const sectionBytes = sectionOverheadBytes + stat.size;
    if (totalBytes + sectionBytes > MAX_CONTEXT_TOTAL_BYTES) {
      limitReached = true;
      break;
    }

    selectedFiles.push({ file, resolvedPath });
    totalBytes += sectionBytes;
  }

  const sections: string[] = [];
  const READ_BATCH_SIZE = 8;
  for (let i = 0; i < selectedFiles.length; i += READ_BATCH_SIZE) {
    const batch = selectedFiles.slice(i, i + READ_BATCH_SIZE);
    const batchSections = await Promise.all(
      batch.map(async ({ file, resolvedPath }) => {
        try {
          const content = await fs.promises.readFile(resolvedPath, 'utf-8');
          return `=== File: ${file} ===\n${content}\n`;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'unknown read error';
          console.warn(pc.yellow(`[ALEX] Context omitted for ${file}: ${message}`));
          return `=== File: ${file} ===\n[context omitted: file could not be read: ${message}]\n`;
        }
      }),
    );
    sections.push(...batchSections);
  }

  let combinedContext = sections.join('');

  if (limitReached) {
    combinedContext += '\n=== CONTEXT NOTICE ===\nFull-file context limit reached; some changed files were omitted.\n';
  }

  if (metadata.files.length > MAX_CONTEXT_FILES) {
    combinedContext += `\n=== CONTEXT NOTICE ===\nFile context limit reached; only the first ${MAX_CONTEXT_FILES} changed files were inspected.\n`;
  }

  return combinedContext || undefined;
}

// ─── Helper compartilhado de UI ───────────────────────────────────────────────
function printVerdict(spinner: ReturnType<typeof ora>, result: FinalReport): void {
  spinner.stop();
  const isPass = result.verdict === 'PASS';
  const isWarn = result.verdict === 'WARN';
  const verdictColor = isPass ? pc.green : (isWarn ? pc.yellow : pc.red);

  console.log(pc.bold(`\n[ALEX] Análise finalizada com sucesso.`));
  console.log(verdictColor(pc.bold(`\nVeredito Final: ${result.verdict}`)));
  console.log(pc.gray('--------------------------------------------------'));
  console.log(pc.white(result.summary));
  console.log(pc.gray('--------------------------------------------------\n'));

  if (result.issues && result.issues.length > 0) {
    console.log(pc.bold('Detalhes dos Apontamentos:\n'));
    result.issues.forEach((issue) => {
      const sevColor = issue.severity === 'Blocker' || issue.severity === 'Critical' ? pc.red : pc.yellow;
      console.log(`[${sevColor(issue.severity)}] ${pc.cyan(issue.origin)}`);
      console.log(`Arquivo: ${pc.underline(issue.file)}${issue.line ? ` (Linha ${issue.line})` : ''}`);
      console.log(`Mensagem: ${issue.message}`);
      if (issue.codeSnippet) console.log(pc.gray(`Trecho: ${issue.codeSnippet.trim()}`));
      console.log('');
    });
  }
}

async function runAnalysis(request: {
  metadata: { stack: string; project: string };
  diff?: string;
  sourceCode?: string;
}, model: string, enabledAgents?: AgentId[]): Promise<FinalReport> {
  const orchestrator = new ReviewOrchestrator(model, { enabledAgents });
  const rawResult = await orchestrator.analyze(request);
  let parsed: unknown;

  try {
    parsed = extractAndParseJSON(rawResult);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'JSON invalido.';
    throw new LlmResultParseError(message, rawResult);
  }

  const validation = FinalReportSchema.safeParse(parsed);
  if (!validation.success) {
    throw new LlmResultParseError(
      `Contrato de resposta invalido: ${validation.error.message}`,
      rawResult,
    );
  }

  return validation.data;
}

/**
 * Resolve o conjunto final de agentes com a precedência correta: CLI > env vars.
 * Erros de validação (ID inválido, council vazio) são relançados para o chamador.
 */
function resolveAgents(cliAgents?: string, cliDisabled?: string): AgentId[] {
  const agents = cliAgents !== undefined ? cliAgents : process.env.ALEX_AGENTS;
  const disabled = cliDisabled !== undefined ? cliDisabled : process.env.ALEX_DISABLED_AGENTS;
  return resolveAgentIds({ agents, disabledAgents: disabled });
}

function resolveAgentsOrExit(cliAgents?: string, cliDisabled?: string): AgentId[] {
  try {
    return resolveAgents(cliAgents, cliDisabled);
  } catch (error: unknown) {
    console.error(pc.red(error instanceof Error ? error.message : 'Selecao de agentes invalida.'));
    process.exit(1);
  }
}

function failAnalysis(spinner: ReturnType<typeof ora>, error: unknown): never {
  if (error instanceof LlmResultParseError) {
    spinner.fail(pc.red('Erro ao interpretar a resposta da IA. O formato JSON esperado falhou.'));
    console.error(pc.red(error.message));
    console.error(truncateForLog(error.rawResult));
    process.exit(1);
  }

  spinner.fail(pc.red('Erro durante a analise do A.L.E.X.'));
  if (error instanceof Error) {
    if (error.message && error.message.includes('429')) {
      console.error(pc.yellow('\nLimite de Cota Atingido (429 Too Many Requests). Verifique sua chave de API ou aguarde alguns minutos.\n'));
    } else {
      console.error(pc.red(error.message));
    }
  }
  process.exit(1);
}

async function writeReportFile(filePath: string, content: string): Promise<void> {
  try {
    const stat = await fs.promises.lstat(filePath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Recusando escrever em symlink: ${filePath}`);
    }
  } catch (error: unknown) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW;
  const handle = await fs.promises.open(filePath, flags, 0o600);
  try {
    await handle.writeFile(content, 'utf-8');
  } finally {
    await handle.close();
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o .env da pasta onde o CLI foi instalado (A.L.E.X raiz)
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
applyStoredConfigToEnv();
const defaultModel = getDefaultModel();

function ensureGeminiApiKey(): void {
  if (getGeminiApiKey()) return;

  console.error(pc.red('Erro: GEMINI_API_KEY não configurada.'));
  console.log(pc.yellow('Execute `alex config set-key` ou exporte GEMINI_API_KEY no ambiente.'));
  process.exit(1);
}

async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('Entrada interativa indisponivel. Use GEMINI_API_KEY no ambiente para execucoes nao interativas.');
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = '';
    let ignoringEscapeSequence = false;
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };
    const finish = () => {
      cleanup();
      process.stdout.write('\n');
      resolve(value);
    };
    const abort = () => {
      cleanup();
      process.stdout.write('\n');
      reject(new Error('Entrada cancelada.'));
    };
    const onData = (chunk: Buffer) => {
      const input = chunk.toString('utf-8');
      for (const char of input) {
        const code = char.charCodeAt(0);
        if (code === 3) return abort();
        if (code === 27) {
          ignoringEscapeSequence = true;
          continue;
        }
        if (ignoringEscapeSequence) {
          if (code >= 64 && code <= 126) ignoringEscapeSequence = false;
          continue;
        }
        if (code === 13 || code === 10) return finish();
        if (code === 8 || code === 127) {
          value = value.slice(0, -1);
          continue;
        }
        if (code < 32 || code > 126) {
          continue;
        }
        value += char;
      }
    };

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

const program = new Command();

program
  .name('alex')
  .description('A.L.E.X (Advanced Logic Evaluation X-ray) CLI')
  .version('1.0.0');

const configCommand = program
  .command('config')
  .description('Gerencia a configuração global do A.L.E.X CLI.');

configCommand
  .command('set-key')
  .description('Salva a GEMINI_API_KEY no perfil do usuario usando entrada oculta.')
  .action(async () => {
    let geminiApiKey: string;
    try {
      geminiApiKey = (await promptHidden('GEMINI_API_KEY: ')).trim();
    } catch (error: unknown) {
      console.error(pc.red(error instanceof Error ? error.message : 'Falha ao ler GEMINI_API_KEY.'));
      process.exit(1);
    }

    if (!geminiApiKey) {
      console.error(pc.red('GEMINI_API_KEY vazia. Configuracao nao alterada.'));
      process.exit(1);
    }

    updateUserConfig({ geminiApiKey });
    console.log(pc.green(`GEMINI_API_KEY salva em ${getConfigPath()}`));
  });
configCommand
  .command('set-model <model>')
  .description('Define o modelo padrão do A.L.E.X CLI.')
  .action((model) => {
    updateUserConfig({ model });
    console.log(pc.green(`Modelo padrão salvo: ${model}`));
  });

configCommand
  .command('set-agents <agents>')
  .description('Define o perfil persistente de agentes. Ex: default,test-strategist.')
  .action((agents) => {
    try {
      resolveAgentIds({ agents });
    } catch (error: unknown) {
      console.error(pc.red(error instanceof Error ? error.message : 'Selecao de agentes invalida.'));
      process.exit(1);
    }

    updateUserConfig({ agents });
    console.log(pc.green(`Perfil de agentes salvo: ${agents}`));
  });

configCommand
  .command('disable-agent <agents>')
  .description('Define agentes persistentes a desabilitar. Ex: docs-maintainer.')
  .action((agents) => {
    try {
      resolveAgentIds({ disabledAgents: agents });
    } catch (error: unknown) {
      console.error(pc.red(error instanceof Error ? error.message : 'Selecao de agentes invalida.'));
      process.exit(1);
    }

    updateUserConfig({ disabledAgents: agents });
    console.log(pc.green(`Agentes desabilitados salvos: ${agents}`));
  });

configCommand
  .command('show')
  .description('Mostra a configuração ativa sem exibir segredos.')
  .action(() => {
    const userConfig = readUserConfig();
    const activeModel = getDefaultModel();
    const hasKey = Boolean(getGeminiApiKey());
    const keySource = process.env.GEMINI_API_KEY ? 'env' : (userConfig.geminiApiKey ? 'user-config' : 'missing');
    const modelSource = process.env.ALEX_MODEL ? 'env' : (userConfig.model ? 'user-config' : 'fallback');

    console.log(`Config path: ${getConfigPath()}`);
    console.log(`GEMINI_API_KEY: ${hasKey ? `configured (${keySource})` : 'missing'}`);
    console.log(`ALEX_MODEL: ${activeModel} (${modelSource})`);
    console.log(`ALEX_AGENTS: ${process.env.ALEX_AGENTS || userConfig.agents || 'default'}`);
    console.log(`ALEX_DISABLED_AGENTS: ${process.env.ALEX_DISABLED_AGENTS || userConfig.disabledAgents || '(none)'}`);
  });

program
  .command('review [profile]')
  .description('Analisa as modificações locais (git diff) usando o conselho de especialistas.')
  .option('-m, --model <modelo>', 'Modelo LLM para utilizar na análise', defaultModel)
  .option('--agents <lista>', 'Agentes habilitados (vírgula). Ex: security-auditor,clean-coder. Usa env ALEX_AGENTS se omitido.')
  .option('--disable-agents <lista>', 'Agentes a remover do conjunto. Ex: sre-agent. Usa env ALEX_DISABLED_AGENTS se omitido.')
  .action(async (profile, options) => {
    ensureGeminiApiKey();
    console.log(pc.cyan(pc.bold('\n🛡️ A.L.E.X Code Review Iniciado\n')));

    const enabledAgents = resolveAgentsOrExit(options.agents ?? profile, options.disableAgents);

    const spinner = ora('Capturando git diff local...').start();

    let diffContent = '';
    try {
      // Usa spawn com limite de bytes para evitar DoS/OOM em repositórios grandes
      diffContent = await getLocalReviewDiff();
    } catch (error: unknown) {
      spinner.fail(pc.red('Falha ao tentar executar git diff. Certifique-se de que está em um repositório git.'));
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }

    if (!diffContent || diffContent.trim() === '') {
      spinner.succeed(pc.green('Nenhuma modificação encontrada no repositório. O código está limpo.'));
      process.exit(0);
    }

    const modelToUse = options.model || defaultModel;
    spinner.text = `Analisando código com o Conselho de Especialistas (${modelToUse})... Isso pode levar alguns segundos.`;

    
    const request = {
      metadata: {
        stack: "Auto-detected",
        project: process.cwd().split(/[\/\\]/).pop() || 'local-workspace'
      },
      diff: sanitizeDiff(diffContent),
      sourceCode: sanitizeDiff(await getChangedFilesContext(diffContent) || '')
    };

    try {
      const result = await runAnalysis(request, modelToUse, enabledAgents);

      printVerdict(spinner, result);
      if (result.verdict !== 'PASS') process.exit(1);
      
    } catch (error: unknown) {
      failAnalysis(spinner, error);
    }
  });

program
  .command('analyze <caminho>')
  .description('Analisa um arquivo de código completo estruturalmente.')
  .option('-m, --model <modelo>', 'Modelo LLM para utilizar na análise', defaultModel)
  .option('--agents <lista>', 'Agentes habilitados (vírgula). Ex: security-auditor,clean-coder. Usa env ALEX_AGENTS se omitido.')
  .option('--disable-agents <lista>', 'Agentes a remover do conjunto. Ex: sre-agent. Usa env ALEX_DISABLED_AGENTS se omitido.')
  .action(async (caminho, options) => {
    ensureGeminiApiKey();
    console.log(pc.cyan(pc.bold('\n🛡️ A.L.E.X Code Analysis Iniciado\n')));

    const enabledAgents = resolveAgentsOrExit(options.agents, options.disableAgents);

    const targetPath = path.resolve(process.cwd(), caminho);
    
    // 1. Path Traversal Prevention (LFI) via fs.realpath (previne symlinks e prefix bypass)
    let resolvedPath: string;
    try {
      resolvedPath = await fs.promises.realpath(targetPath);
    } catch {
      console.error(pc.red(`Erro: O caminho especificado não existe (${targetPath})`));
      process.exit(1);
    }
    const cwdReal = await fs.promises.realpath(process.cwd());
    if (!isWithinDirectory(cwdReal, resolvedPath!)) {
      console.error(pc.red(`Erro de Segurança: O caminho está fora do escopo do projeto (${resolvedPath!}).`));
      process.exit(1);
    }

    // 2. Data Leakage Blocklist (expandida) — usa resolvedPath para prevenir bypass por symlink
    const baseName = path.basename(resolvedPath!);
    if (isBlockedSensitivePath(resolvedPath!)) {
      console.error(pc.red(`Erro de Segurança: Arquivo bloqueado pela política contra vazamento de segredos (${baseName}).`));
      process.exit(1);
    }

    const stat = await fs.promises.stat(resolvedPath!);
    if (!stat.isFile()) {
      console.error(pc.red(`Erro: Atualmente o comando 'analyze' suporta apenas arquivos únicos. Recebido diretório: ${targetPath}`));
      process.exit(1);
    }

    // 3. OOM Risk Prevention (Max Size 1MB)
    const MAX_SIZE = 1024 * 1024;
    if (stat.size > MAX_SIZE) {
      console.error(pc.red(`Erro de Performance: O arquivo excede o limite máximo permitido de 1MB (${(stat.size / 1024 / 1024).toFixed(2)} MB).`));
      process.exit(1);
    }

    const spinner = ora(`Lendo arquivo local: ${caminho}...`).start();

    let fileContent = '';
    try {
      fileContent = await fs.promises.readFile(resolvedPath!, 'utf-8');
    } catch (error: unknown) {
      spinner.fail(pc.red('Falha ao ler o arquivo especificado.'));
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }

    if (!fileContent || fileContent.trim() === '') {
      spinner.succeed(pc.green('O arquivo está vazio. Nenhuma análise necessária.'));
      process.exit(0);
    }

    // Formatando no payload para simular um arquivo único lido
    const sourceCodePayload = `=== File: ${caminho} ===\n${fileContent}`;

    const modelToUse = options.model || defaultModel;
    spinner.text = `Analisando arquivo com o Conselho de Especialistas (${modelToUse})... Isso pode levar alguns segundos.`;

    
    const request = {
      metadata: {
        stack: "Auto-detected",
        project: process.cwd().split(/[\/\\]/).pop() || 'local-workspace'
      },
      sourceCode: sanitizeDiff(sourceCodePayload)
    };

    try {
      const result = await runAnalysis(request, modelToUse, enabledAgents);

      printVerdict(spinner, result);
      if (result.verdict !== 'PASS') process.exit(1);
      
    } catch (error: unknown) {
      failAnalysis(spinner, error);
    }
  });

program
  .command('ci')
  .description('Analisa um diff de PR em CI e gera relatorio Markdown ou JSON para GitHub Actions.')
  .requiredOption('--diff-file <arquivo>', 'Arquivo contendo o diff do PR.')
  .option('--output-file <arquivo>', 'Arquivo de saida do relatorio.', 'alex-review.md')
  .option('--format <formato>', 'Formato de saida: markdown ou json.', 'markdown')
  .option('--project <nome>', 'Nome do projeto/repositorio.', process.cwd().split(/[\/\\]/).pop() || 'local-workspace')
  .option('--pr-number <numero>', 'Numero do PR para enriquecer o titulo.')
  .option('-m, --model <modelo>', 'Modelo LLM para utilizar na analise', defaultModel)
  .option('--fail-on-fail', 'Retorna exit code 1 quando o veredito for FAIL.')
  .option('--agents <lista>', 'Agentes habilitados (vírgula). Ex: security-auditor,clean-coder. Usa env ALEX_AGENTS se omitido.')
  .option('--disable-agents <lista>', 'Agentes a remover do conjunto. Ex: docs-maintainer. Usa env ALEX_DISABLED_AGENTS se omitido.')
  .action(async (options) => {
    ensureGeminiApiKey();
    const modelToUse = options.model || defaultModel;

    const enabledAgents = resolveAgentsOrExit(options.agents, options.disableAgents);

    try {
      const diffPath = await resolveExistingFileWithinCwd(options.diffFile);
      const outputPath = await resolveOutputFile(options.outputFile);
      const stat = await fs.promises.stat(diffPath);
      if (!stat.isFile() || stat.size > MAX_DIFF_BYTES) {
        throw new Error(`Arquivo de diff invalido ou maior que ${MAX_DIFF_BYTES / 1024 / 1024}MB.`);
      }

      const diffContent = await fs.promises.readFile(diffPath, 'utf-8');
      if (!diffContent.trim()) {
        throw new Error('Arquivo de diff vazio.');
      }

      const request = {
        metadata: {
          stack: 'Auto-detected',
          project: options.project,
        },
        diff: sanitizeDiff(diffContent),
        sourceCode: sanitizeDiff(await getChangedFilesContext(diffContent) || ''),
      };

      const result = await runAnalysis(request, modelToUse, enabledAgents);
      const title = options.prNumber ? `A.L.E.X Code Review - PR #${options.prNumber}` : 'A.L.E.X Code Review';
      const output = options.format === 'json'
        ? JSON.stringify(result, null, 2)
        : formatReportMarkdown(result, title);

      await writeReportFile(outputPath, output);
      console.log(`[ALEX] Relatorio gerado em ${outputPath}`);
      console.log(`[ALEX] Veredito: ${result.verdict}`);

      if (options.failOnFail && result.verdict === 'FAIL') {
        process.exit(1);
      }
    } catch (error: unknown) {
      if (error instanceof LlmResultParseError) {
        console.error(pc.red(error.message));
        console.error(truncateForLog(error.rawResult));
        process.exit(1);
      }

      console.error(pc.red(error instanceof Error ? error.message : 'Falha inesperada no modo CI.'));
      process.exit(1);
    }
  });

program.parse(process.argv);
