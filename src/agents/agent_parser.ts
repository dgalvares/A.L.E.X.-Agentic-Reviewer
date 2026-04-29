import {
  AgentId,
  ALL_AGENT_IDS,
  DEFAULT_AGENT_IDS,
  VALID_AGENT_IDS,
} from './catalog.js';

/** IDs válidos para override de modelo (agentes + consolidador). */
const VALID_MODEL_TARGET_IDS = new Set<string>([
  ...Array.from(VALID_AGENT_IDS),
  'architect-consolidator',
  'security-reviewer',
  'performance-reviewer',
]);

/**
 * Mapa de override de modelo por agente.
 * Chave = AgentId | 'architect-consolidator' | 'security-reviewer' | 'performance-reviewer'
 * Valor = nome do modelo LLM (ex: 'gemini-2.0-flash')
 */
export type AgentModelMap = Map<string, string>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentSelectionOpts {
  /**
   * Lista de IDs (vírgula) ou `"default"` para expandir o conjunto padrão.
   * Pode misturar `"default"` com IDs específicos: `"default,test-strategist"`.
   * Se omitido, usa DEFAULT_AGENT_IDS.
   */
  agents?: string;
  /**
   * Lista de IDs (vírgula) a remover do conjunto final.
   * IDs não presentes no conjunto são ignorados silenciosamente.
   */
  disabledAgents?: string;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Resolve a lista final de AgentIds a partir das opções de seleção.
 *
 * Precedência: a função não decide precedência CLI vs env — isso é
 * responsabilidade do chamador, que deve passar o valor correto em `opts`.
 *
 * @throws {Error} Se um ID desconhecido for fornecido na lista de habilitados.
 * @throws {Error} Se nenhum agente do tipo `council` restar após remoções.
 */
export function resolveAgentIds(opts: AgentSelectionOpts = {}): AgentId[] {
  // 1. Expandir a lista de agentes habilitados
  const enabledIds = expandAgentList(opts.agents);

  // 2. Aplicar remoções
  const disabledIds = parseIdList(opts.disabledAgents ?? '');
  const finalIds = enabledIds.filter((id) => !disabledIds.includes(id));

  // 3. Garantir que ao menos um agente de analise esta presente.
  if (finalIds.length === 0) {
    throw new Error(
      'Selecao invalida: nenhum agente de analise restou apos aplicar --disable-agents. ' +
        'O A.L.E.X requer ao menos um dos agentes: ' +
        [...DEFAULT_AGENT_IDS].join(', ') +
        '.',
    );
  }

  return finalIds;
}

// ─── Model override helpers ───────────────────────────────────────────────────

/**
 * Converte um agent ID para o nome da env var correspondente.
 * Ex: 'security-auditor' → 'ALEX_MODEL_SECURITY_AUDITOR'
 */
export function agentIdToEnvKey(id: string): string {
  return `ALEX_MODEL_${id.replace(/-/g, '_').toUpperCase()}`;
}

/**
 * Faz o parse do formato CLI `agentId:modelName,...` para um Map.
 * Aceita vírgula e/ou espaço como separadores.
 *
 * @throws {Error} Se um ID desconhecido for fornecido.
 */
export function parseAgentModels(raw?: string): AgentModelMap {
  const map: AgentModelMap = new Map();
  if (!raw || !raw.trim()) return map;

  const tokens = raw
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    if (colonIdx <= 0 || colonIdx === token.length - 1) {
      throw new Error(
        `Formato inválido em --agent-models: "${token}". ` +
        `Use o formato: agentId:modelName (ex: security-auditor:gemini-2.0-flash).`,
      );
    }
    const agentId = token.slice(0, colonIdx).trim();
    const modelName = token.slice(colonIdx + 1).trim();

    if (!VALID_MODEL_TARGET_IDS.has(agentId)) {
      throw new Error(
        `ID de agente inválido em --agent-models: "${agentId}". ` +
        `IDs válidos: ${[...VALID_MODEL_TARGET_IDS].join(', ')}.`,
      );
    }
    map.set(agentId, modelName);
  }

  return map;
}

/**
 * Resolve o modelo LLM a usar para um agente específico, aplicando a precedência:
 * 1. cliMap (--agent-models)  — prioridade máxima
 * 2. Env var por agente       — ALEX_MODEL_<AGENT_ID_UPPERCASE>
 * 3. payloadMap               — metadata.agentModels da API REST
 * 4. globalModel              — ALEX_MODEL / --model  (fallback)
 */
export function resolveModelForAgent(
  agentId: string,
  globalModel: string,
  cliMap?: AgentModelMap,
  payloadMap?: AgentModelMap,
): string {
  if (cliMap?.has(agentId)) return cliMap.get(agentId)!;
  const envVal = process.env[agentIdToEnvKey(agentId)];
  if (envVal) return envVal;
  if (payloadMap?.has(agentId)) return payloadMap.get(agentId)!;
  return globalModel;
}

/**
 * Constrói o AgentModelMap final combinando o valor da CLI (maior prioridade)
 * com as env vars por agente (lidas de process.env).
 * Retorna um Map pronto para ser passado ao orchestrator.
 *
 * @param cliRaw  — string bruta de --agent-models (opcional)
 */
export function resolveAgentModels(cliRaw?: string): AgentModelMap {
  // Parse CLI primeiro (validação acontece aqui — erros lançados para o chamador)
  const cliMap = parseAgentModels(cliRaw);

  // Complementa com env vars para IDs que não foram especificados via CLI
  const merged: AgentModelMap = new Map(cliMap);
  for (const id of VALID_MODEL_TARGET_IDS) {
    if (!merged.has(id)) {
      const envVal = process.env[agentIdToEnvKey(id)];
      if (envVal) merged.set(id, envVal);
    }
  }

  return merged;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Expande a string de agentes (com suporte ao token `default`) para
 * um array de AgentIds sem duplicatas, mantendo ordem de aparição.
 *
 * Aceita vírgula e/ou espaço como separadores, tornando o comportamento
 * robusto em shells como PowerShell que convertem `a,b` em `"a b"`.
 */
function expandAgentList(raw?: string): AgentId[] {
  if (!raw || !raw.trim()) {
    return [...DEFAULT_AGENT_IDS] as AgentId[];
  }

  // Normaliza: substitui vírgulas por espaços e depois faz split por whitespace
  const tokens = raw
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const expanded: AgentId[] = [];
  const seen = new Set<AgentId>();

  const push = (id: AgentId) => {
    if (!seen.has(id)) {
      seen.add(id);
      expanded.push(id);
    }
  };

  for (const token of tokens) {
    if (token === 'default') {
      for (const id of DEFAULT_AGENT_IDS) {
        push(id as AgentId);
      }
    } else if (token === 'all') {
      for (const id of ALL_AGENT_IDS) {
        push(id as AgentId);
      }
    } else {
      if (!VALID_AGENT_IDS.has(token)) {
        throw new Error(
          `Agente desconhecido: "${token}". ` +
            `IDs válidos: ${[...VALID_AGENT_IDS].join(', ')}.`,
        );
      }
      push(token as AgentId);
    }
  }

  return expanded;
}

/**
 * Converte uma string de IDs separados por vírgula e/ou espaço em AgentId[].
 * IDs desconhecidos em listas de remoção são ignorados silenciosamente
 * (evita falha quando um agente ainda não existe no perfil atual).
 */
function parseIdList(raw: string): AgentId[] {
  if (!raw.trim()) return [];
  return raw
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((token) => VALID_AGENT_IDS.has(token))
    .map((token) => {
      return token as AgentId;
    });
}
