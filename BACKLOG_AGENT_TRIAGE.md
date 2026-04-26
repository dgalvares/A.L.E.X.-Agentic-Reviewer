# Backlog: Triagem Automatica de Agentes por Contexto

Este backlog formaliza o plano para que o A.L.E.X infira automaticamente quais especialistas
ativar com base no conteudo do diff ou arquivo analisado, sem exigir `--agents` explicito.

## Objetivo

Reduzir o atrito para o usuario e o custo de API em reviews rotineiras, ativando apenas os
especialistas relevantes para o tipo de mudanca detectada, mantendo a possibilidade de
sobrescrita manual via `--agents` e `--disable-agents`.

## Decisao de Design

Adotar triagem baseada em **regras locais** (sem chamada LLM adicional):

- Zero custo extra de API.
- Resultado determinístico e testavel.
- CLI tem sempre precedencia: `--agents` sobreescreve a triagem automatica.
- Implementada como extensao do `agent_parser.ts`, nao como novo agente.

Abordagens descartadas:

- **Triage LLM**: exigiria dois runners sequenciais no ADK (triage + pipeline), aumentando
  latencia, custo e fragilidade de parsing do JSON de saida.
- **ReAct/tool-use**: imprevisivel e inadequado para CI/CD deterministico.

## Regras de Triagem Propostas

Cada regra mapeia padroes de arquivo/keyword para agentes sugeridos ou removidos.

### Por extensao de arquivo

| Extensoes detectadas no diff | Agentes sugeridos | Agentes removidos |
|---|---|---|
| `.sql`, `.prisma`, `.migration.*` | `security-auditor`, `sre-agent` | — |
| `.md`, `.mdx`, `.rst`, `.txt` | `docs-maintainer` | `security-auditor`, `sre-agent`, `business-proxy` |
| `.yml`, `.yaml`, `Dockerfile*`, `.dockerignore` | `sre-agent`, `security-auditor` | — |
| `.test.*`, `.spec.*`, `__tests__/**` | `test-strategist`, `clean-coder` | — |
| `.env*`, `secrets.*`, `*.pem`, `*.key` | `security-auditor` | — |
| `package.json`, `*.lock`, `go.sum`, `requirements.txt` | `security-auditor`, `sre-agent` | — |

### Por keyword no diff (heuristica de conteudo)

| Keyword/padrao | Agente sugerido |
|---|---|
| `password`, `secret`, `token`, `apiKey`, `credentials` | `security-auditor` |
| `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `FROM` | `security-auditor` |
| `console.log`, `print(`, `logger.` | `observability-engineer` |
| `catch`, `throw`, `Error(`, `exception` | `error-handling-specialist` |
| `retry`, `timeout`, `circuit`, `backpressure` | `sre-agent`, `scalability-architect` |
| `README`, `CHANGELOG`, `docs/`, `openapi` | `docs-maintainer` |

### Comportamento padrao da triagem

- Se nenhuma regra casar: usa `DEFAULT_AGENT_IDS` (comportamento atual preservado).
- Agentes inferidos por triagem podem ser ampliados ou restringidos por `--agents` / `--disable-agents`.
- O conjunto final NUNCA fica sem ao menos um agente do council (validacao existente no parser).

## Implementacao

### Fase 1: Funcao de triagem

Criar `src/agents/triage.ts`:

```ts
export function inferAgentsFromContent(opts: {
  diff?: string;
  sourceCode?: string;
}): AgentId[] | undefined
```

- Retorna `undefined` se nenhuma regra casar (fallback para default).
- Retorna lista de AgentIds se regras casarem.
- Funcao pura, sem efeitos colaterais, testavel de forma isolada.

### Fase 2: Integracao no agent_parser

Atualizar `resolveAgentIds` para aceitar resultado de triagem como entrada de menor
precedencia:

```ts
resolveAgentIds({
  agents?: string,          // CLI > env var
  disabledAgents?: string,
  inferredAgents?: AgentId[] // triagem automatica (menor precedencia)
})
```

Precedencia final: `CLI --agents` > `env ALEX_AGENTS` > `inferredAgents` > `default`.

### Fase 3: Integracao no CLI e orchestrator

- CLI extrai `diff` e `sourceCode` antes de chamar `resolveAgents`.
- Passa `inferredAgents` para `resolveAgentIds` apenas quando `--agents` nao foi fornecido.
- Log informativo: `[ALEX] Triagem automatica: security-auditor, sre-agent inferidos.`

### Fase 4: Testes

Cobrir:

- Diff so com `.md` → remove agentes de codigo, ativa `docs-maintainer`.
- Diff com `.sql` → garante `security-auditor`.
- Diff com keywords de auth → garante `security-auditor`.
- Diff generico sem regra → usa `default`.
- `--agents` sobrescreve triagem.
- `--disable-agents` remove agente inferido.

## Criterios de Aceite

- Triagem nao altera comportamento quando `--agents` e fornecido.
- Triagem nao altera comportamento quando nenhuma regra casar.
- Log de triagem e exibido apenas quando agentes foram inferidos.
- Council nunca fica vazio apos triagem + remocoes.
- Funcao de triagem e pura e testavel de forma isolada.

## Posicao no Plano de Entrega

Este backlog e independente do PR 1 (infra de selecao) e do PR 2 (novos agentes).
Recomenda-se implementar apos o PR 2, quando os agentes que a triagem ativara
(ex: `docs-maintainer`, `test-strategist`) ja existirem no catalogo.

Sugestao: **PR 3** — Triagem automatica.

## Riscos

- Regras incorretas podem silenciar agentes relevantes (ex: diff de infra sem `.yml`).
- Manutencao das regras cresce conforme novos agentes e extensoes sao adicionados.
- Usuario pode nao perceber que agentes foram omitidos (mitigado pelo log informativo).

## Fora de Escopo

- Triagem via LLM (custo e latencia).
- Triagem aprendida historicamente por repositorio.
- Pesos ou scores por agente.
- UI para visualizar quais agentes foram inferidos.
