# Backlog: Specialized Agents and Dynamic Review Profiles

Este backlog formaliza o plano para ampliar o conselho de agentes do A.L.E.X e permitir habilitar/desabilitar agentes por review.

## Objetivos

- Cobrir gaps hoje apenas parcialmente tratados pelos agentes atuais.
- Permitir reviews mais leves ou mais profundos conforme o contexto.
- Dar controle por CLI, API e GitHub Actions sobre quais especialistas participam da analise.

## Gaps Identificados

### Observabilidade

Parcialmente coberta pelo `sre-agent`, mas sem foco explicito em logs, metricas, traces, correlation IDs, alertas, auditabilidade e debuggability.

Agente proposto:

```text
observability-engineer
```

### Qualidade de Testes

Parcialmente coberta pelo `clean-coder`, mas sem foco dedicado em cobertura, regressao, casos negativos, mocks, testes frageis e gaps de CI.

Agente proposto:

```text
test-strategist
```

### Documentacao

Parcialmente coberta pelo `business-proxy`, que le documentacao para validar regra de negocio, mas nao avalia se README, changelog, exemplos, docs de API ou docs operacionais precisam mudar.

Agente proposto:

```text
docs-maintainer
```

### Escalabilidade

Parcialmente coberta pelo `sre-agent`, mas performance local nao cobre throughput, concorrencia, filas, cache, backpressure, crescimento de dados e arquitetura multi-instancia.

Agente proposto:

```text
scalability-architect
```

### Tratamento de Erros

Hoje aparece de forma indireta em seguranca, SRE e qualidade, mas nao existe foco dedicado em fail-open/fail-closed, erros silenciosos, retries, mensagens ruins, mascaramento de segredos, rollback, idempotencia e propagacao de excecoes.

Agente proposto:

```text
error-handling-specialist
```

## Status

Concluido. O backlog foi entregue com estes ajustes finais:

- `AGENT_CATALOG` contem apenas agentes de analise configuraveis pelo usuario.
- `REVIEWER_CATALOG` contem revisores internos, ativados automaticamente por dependencia.
- `default` expande para o perfil padrao de agentes de analise.
- `all` expande para todos os agentes de analise registrados.
- Revisores nao podem ser habilitados/desabilitados diretamente pelo usuario.

## Fase 1: Catalogo de Agentes [Concluido]

Criar um catalogo central para os agentes:

```ts
type AgentId =
  | 'security-auditor'
  | 'clean-coder'
  | 'sre-agent'
  | 'business-proxy'
  | 'test-strategist'
  | 'observability-engineer'
  | 'docs-maintainer'
  | 'scalability-architect'
  | 'error-handling-specialist';
```

Cada entrada deve conter:

```ts
{
  id,
  label,
  defaultEnabled,
  outputKey,
  factory
}
```

Critérios de aceite:

- Agentes atuais entram no catalogo sem alterar comportamento padrao.
- `default` expande para o conjunto padrao atual.
- Agente desconhecido falha com mensagem clara.

## Fase 2: Selecao Dinamica de Agentes [Concluido]

Adicionar suporte a selecao por CLI:

```bash
alex review --agents security-auditor,clean-coder,test-strategist
alex review --disable-agents docs-maintainer,scalability-architect
alex ci --agents default,error-handling-specialist
```

Adicionar suporte por env vars:

```text
ALEX_AGENTS=default,test-strategist,error-handling-specialist
ALEX_DISABLED_AGENTS=docs-maintainer
```

Critérios de aceite:

- `--agents` define o conjunto permitido.
- `--disable-agents` remove agentes do conjunto final.
- Env vars funcionam em CI/CD.
- CLI tem precedencia sobre env vars.

## Fase 3: Orquestracao Dinamica [Concluido]

Hoje `src/agent.ts` monta o conselho de forma estatica.

Evoluir de:

```ts
createRootAgent(model)
```

para:

```ts
createRootAgent(model, {
  enabledAgents: [...]
})
```

Critérios de aceite:

- `councilParallel` e montado a partir do catalogo.
- Consolidator recebe apenas outputKeys de agentes habilitados.
- Reflection agents continuam funcionando sem assumir outputs ausentes.

## Fase 4: API e Contratos [Concluido]

Adicionar controle por request:

```ts
metadata: {
  agents?: string[];
  disabledAgents?: string[];
}
```

Critérios de aceite:

- API aceita perfis de agentes por request.
- Payload invalido retorna erro claro.
- Backward compatibility mantida.

## Fase 5: GitHub Actions [Concluido]

Atualizar workflows:

```yaml
env:
  ALEX_AGENTS: ${{ vars.ALEX_AGENTS || 'default' }}
  ALEX_DISABLED_AGENTS: ${{ vars.ALEX_DISABLED_AGENTS || '' }}
```

Chamada:

```bash
alex ci \
  --diff-file pr.diff \
  --agents "$ALEX_AGENTS" \
  --disable-agents "$ALEX_DISABLED_AGENTS"
```

Critérios de aceite:

- Repos consumidores podem configurar perfil de review por variaveis do GitHub.
- Ausencia de variaveis mantem comportamento atual.

## Fase 6: Novos Prompts [Concluido]

Adicionar prompts dedicados em `src/prompts/index.ts`.

Ordem recomendada:

1. `error-handling-specialist`
2. `test-strategist`
3. `observability-engineer`
4. `docs-maintainer`
5. `scalability-architect`

Critérios de aceite:

- Cada prompt inclui regras de evidencia.
- Cada agente evita emitir Blocker sem contexto suficiente.
- Cada agente tem outputKey proprio.

## Fase 7: Config Persistente [Concluido]

Adicionar comandos opcionais:

```bash
alex config set-agents default,test-strategist,error-handling-specialist
alex config disable-agent docs-maintainer
alex config show
```

Esta fase deve vir depois de CLI/env/API para evitar crescer o primeiro corte.

## Fase 8: Testes [Concluido]

Status: concluido em testes unitarios e de workflow.

Cobertura entregue:

- [x] parsing de lista de agentes;
- [x] expansao de `default`;
- [x] expansao de `all`;
- [x] agente desconhecido;
- [x] remocao via `disabledAgents`;
- [x] precedencia CLI > env > config;
- [x] pipeline com subconjunto de agentes;
- [x] workflow consumidor com variaveis de agentes;
- [x] consolidator com outputKeys dinamicos;
- [x] revisores dependentes dos agentes habilitados.

## Plano de Entrega

### PR 1: Infra de selecao [Concluido]

- Catalogo.
- Parser de agentes.
- CLI/env/API.
- Orquestracao dinamica.
- Testes.
- Sem novos agentes.

### PR 2: Novos agentes [Concluido]

- `error-handling-specialist`.
- `test-strategist`.
- `observability-engineer`.
- `docs-maintainer`.
- `scalability-architect`.
- README e workflows atualizados.

## Riscos

- Mais agentes aumentam custo e latencia.
- Mais perspectivas podem aumentar ruido se prompts nao forem bem restritos.
- Consolidator precisa lidar bem com outputs ausentes.
- Perfis customizados podem remover agentes essenciais sem aviso.

## Fora de Escopo Inicial

- UI web para selecionar agentes.
- Pesos/prioridades configuraveis por agente.
- Execucao condicional automatica por tipo de arquivo → ver `BACKLOG_AGENT_TRIAGE.md`.
- Perfil de review aprendido historicamente.
