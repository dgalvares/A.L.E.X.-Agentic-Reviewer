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
import { getDefaultModel } from './config.js';
import { extractCodeMetadata } from './tools/diff_tools.js';
import { sanitizeDiff } from './utils/diff_sanitizer.js';
import { isBlockedSensitivePath } from './utils/sensitive_paths.js';

/** Lê o git diff via spawn com stream limitado a evitar OOM/DoS */
const MAX_DIFF_BYTES = 10 * 1024 * 1024;  // 10MB stdout
const MAX_STDERR_BYTES = 64 * 1024;       // 64KB stderr — evita OOM em erros verbosos
const MAX_CONTEXT_FILE_BYTES = 256 * 1024;
const MAX_CONTEXT_TOTAL_BYTES = 2 * 1024 * 1024;

async function getGitDiff(): Promise<string> {
  return new Promise((resolve, reject) => {
    // encoding não é suportado no tipo ChildProcessWithoutNullStreams; usamos Buffer
    const proc = spawn('git', ['diff', 'HEAD']);
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;
    let totalStderrBytes = 0;
    let settled = false; // Flag para evitar race condition após SIGKILL

    const finish = (fn: () => void) => {
      if (!settled) { settled = true; fn(); }
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
      if (code !== 0 && chunks.length === 0) {
        finish(() => reject(new Error(Buffer.concat(stderrChunks).toString('utf-8') || `git diff saiu com código ${code}`)));
      } else {
        finish(() => resolve(Buffer.concat(chunks).toString('utf-8')));
      }
    });
    proc.on('error', (err) => finish(() => reject(err)));
  });
}

async function getChangedFilesContext(diffContent: string): Promise<string | undefined> {
  const metadata = extractCodeMetadata(diffContent);
  const cwdReal = await fs.promises.realpath(process.cwd());
  let combinedContext = '';
  let totalBytes = 0;

  for (const file of metadata.files) {
    const targetPath = path.resolve(process.cwd(), file);
    let resolvedPath: string;

    try {
      resolvedPath = await fs.promises.realpath(targetPath);
    } catch {
      continue;
    }

    if (!resolvedPath.startsWith(cwdReal + path.sep) && resolvedPath !== cwdReal) {
      continue;
    }

    if (isBlockedSensitivePath(resolvedPath)) {
      continue;
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile() || stat.size > MAX_CONTEXT_FILE_BYTES) {
      continue;
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8');
    const section = `=== File: ${file} ===\n${content}\n`;
    const sectionBytes = Buffer.byteLength(section, 'utf-8');
    if (totalBytes + sectionBytes > MAX_CONTEXT_TOTAL_BYTES) {
      combinedContext += '\n=== CONTEXT NOTICE ===\nFull-file context limit reached; some changed files were omitted.\n';
      break;
    }

    combinedContext += section;
    totalBytes += sectionBytes;
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
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o .env da pasta onde o CLI foi instalado (A.L.E.X raiz)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const defaultModel = getDefaultModel();

if (!process.env.GEMINI_API_KEY) {
  console.error(pc.red('Erro: GEMINI_API_KEY não configurada!'));
  console.log(pc.yellow('Crie um arquivo .env na raiz do projeto A.L.E.X ou exporte a variável globalmente.'));
  process.exit(1);
}

const program = new Command();

program
  .name('alex')
  .description('A.L.E.X (Advanced Logic Evaluation X-ray) CLI')
  .version('1.0.0');

program
  .command('review')
  .description('Analisa as modificações locais (git diff) usando o conselho de especialistas.')
  .option('-m, --model <modelo>', 'Modelo LLM para utilizar na análise', defaultModel)
  .action(async (options) => {
    console.log(pc.cyan(pc.bold('\n🛡️ A.L.E.X Code Review Iniciado\n')));

    const spinner = ora('Capturando git diff local...').start();

    let diffContent = '';
    try {
      // Usa spawn com limite de bytes para evitar DoS/OOM em repositórios grandes
      diffContent = await getGitDiff();
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

    const orchestrator = new ReviewOrchestrator(modelToUse);
    
    const request = {
      metadata: {
        stack: "Auto-detected",
        project: process.cwd().split(/[\/\\]/).pop() || 'local-workspace'
      },
      diff: sanitizeDiff(diffContent),
      sourceCode: await getChangedFilesContext(diffContent)
    };

    try {
      const rawResult = await orchestrator.analyze(request);
      
      let result: FinalReport;
      try {
        const parsed = extractAndParseJSON(rawResult);
        const validation = FinalReportSchema.safeParse(parsed);
        if (!validation.success) {
          throw new Error(`Contrato de resposta inválido: ${validation.error.message}`);
        }
        result = validation.data;
      } catch (parseError) {
        spinner.fail(pc.red('Erro ao interpretar a resposta da IA. O formato JSON esperado falhou.'));
        console.error(rawResult);
        process.exit(1);
      }

      printVerdict(spinner, result);
      if (result.verdict !== 'PASS') process.exit(1);
      
    } catch (error: unknown) {
      spinner.fail(pc.red('Erro durante a análise do A.L.E.X.'));
      
      if (error instanceof Error) {
        if (error.message && error.message.includes('429')) {
           console.error(pc.yellow('\n⚠️ Limite de Cota Atingido (429 Too Many Requests). Verifique sua chave de API ou aguarde alguns minutos.\n'));
        } else {
           // Loga apenas a mensagem para não vazar a GEMINI_API_KEY embutida no objeto Error
           console.error(pc.red(error.message));
        }
      }
      process.exit(1);
    }
  });

program
  .command('analyze <caminho>')
  .description('Analisa um arquivo de código completo estruturalmente.')
  .option('-m, --model <modelo>', 'Modelo LLM para utilizar na análise', defaultModel)
  .action(async (caminho, options) => {
    console.log(pc.cyan(pc.bold('\n🛡️ A.L.E.X Code Analysis Iniciado\n')));

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
    if (!resolvedPath!.startsWith(cwdReal + path.sep) && resolvedPath! !== cwdReal) {
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

    const orchestrator = new ReviewOrchestrator(modelToUse);
    
    const request = {
      metadata: {
        stack: "Auto-detected",
        project: process.cwd().split(/[\/\\]/).pop() || 'local-workspace'
      },
      sourceCode: sourceCodePayload
    };

    try {
      const rawResult = await orchestrator.analyze(request);
      
      let result: FinalReport;
      try {
        const parsed = extractAndParseJSON(rawResult);
        const validation = FinalReportSchema.safeParse(parsed);
        if (!validation.success) {
          throw new Error(`Contrato de resposta inválido: ${validation.error.message}`);
        }
        result = validation.data;
      } catch (parseError) {
        spinner.fail(pc.red('Erro ao interpretar a resposta da IA. O formato JSON esperado falhou.'));
        console.error(rawResult);
        process.exit(1);
      }

      printVerdict(spinner, result);
      if (result.verdict !== 'PASS') process.exit(1);
      
    } catch (error: unknown) {
      spinner.fail(pc.red('Erro durante a análise do A.L.E.X.'));
      if (error instanceof Error) {
        if (error.message && error.message.includes('429')) {
           console.error(pc.yellow('\n⚠️ Limite de Cota Atingido (429 Too Many Requests). Verifique sua chave de API ou aguarde alguns minutos.\n'));
        } else {
           // Loga apenas a mensagem para não vazar a GEMINI_API_KEY embutida no objeto Error
           console.error(pc.red(error.message));
        }
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
