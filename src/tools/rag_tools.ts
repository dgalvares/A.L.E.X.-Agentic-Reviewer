import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_TOTAL_RULE_BYTES = 128 * 1024;
const MAX_RULE_FILE_BYTES = 32 * 1024;
const IGNORED_DIRECTORIES = new Set(['bin', 'obj', 'node_modules', 'dist', '.git']);

/**
 * Funcao utilitaria para ler arquivos locais.
 * Em um cenario "Ephemeral RAG", lemos os arquivos em memoria com limites.
 */
export async function readLocalRules(query?: string): Promise<string> {
  const rulesDir = path.resolve(process.cwd(), '.agents');

  let rootRealPath: string;
  try {
    rootRealPath = await fs.realpath(rulesDir);
  } catch {
    return 'Aviso: Diretorio de regras (.agents) nao encontrado. Assumir que nao ha regras estritas de dominio adicionais a aplicar.';
  }

  let combinedRules = '';
  let totalBytes = 0;
  const normalizedQuery = query?.trim().toLowerCase();
  const files = await listRuleFiles(rootRealPath);

  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_RULE_FILE_BYTES) continue;

      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(rootRealPath, file);
      if (normalizedQuery && !matchesQuery(relativePath, content, normalizedQuery)) {
        continue;
      }

      const section = `\n=== REGRAS DE [${relativePath}] ===\n${content}\n`;
      const sectionBytes = Buffer.byteLength(section, 'utf-8');
      if (totalBytes + sectionBytes > MAX_TOTAL_RULE_BYTES) {
        combinedRules += '\n=== AVISO ===\nLimite de contexto de regras atingido; alguns arquivos foram omitidos.\n';
        break;
      }

      combinedRules += section;
      totalBytes += sectionBytes;
    } catch {
      continue;
    }
  }

  return combinedRules || 'Nenhuma regra de negocio encontrada nos arquivos locais para a consulta informada.';
}

async function listRuleFiles(rootRealPath: string): Promise<string[]> {
  const results: string[] = [];
  const stack = [rootRealPath];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const candidatePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          stack.push(candidatePath);
        }
        continue;
      }

      if (!entry.isFile() || (!entry.name.endsWith('.md') && !entry.name.endsWith('.txt'))) {
        continue;
      }

      try {
        const fullPath = await fs.realpath(candidatePath);
        if (fullPath === rootRealPath || fullPath.startsWith(rootRealPath + path.sep)) {
          results.push(fullPath);
        }
      } catch {
        continue;
      }
    }
  }

  return results.sort();
}

function matchesQuery(relativePath: string, content: string, normalizedQuery: string): boolean {
  return relativePath.toLowerCase().includes(normalizedQuery) ||
    content.toLowerCase().includes(normalizedQuery);
}

/**
 * Ferramenta que expoe as regras locais para os agentes de contexto (Business Proxy).
 */
export const searchLocalRules = new FunctionTool({
  name: 'search_local_rules',
  description: 'Busca e le os arquivos de regras de negocio locais (como .agents/rules.md) para validar restricoes arquiteturais.',
  parameters: z.object({
    query: z.string().optional().describe('Palavra-chave ou termo para focar a busca (ex: "seguranca", "regras", "tipagem"). Opcional.'),
  }),
  execute: async ({ query }) => {
    return readLocalRules(query);
  }
});
