import {
  AgentId,
  ALL_AGENT_IDS,
  DEFAULT_AGENT_IDS,
  VALID_AGENT_IDS,
} from './catalog.js';

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
