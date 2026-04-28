# A.L.E.X Backlog

Este backlog registra debitos reais que devem ser tratados sem inflar o escopo do nucleo multiagente.

## Arquitetura

- **ARCH-01:** Separar a CLI em servicos menores (`git diff`, leitura de arquivo, renderizacao de resultado).
- **ARCH-02:** Centralizar configuracao runtime em um modulo unico para CLI, API e ADK.
- **ARCH-03:** Avaliar callbacks nativos do ADK para rastrear transicoes de agentes e chamadas de ferramentas.
- **ARCH-04:** Planejar suporte multi-provider para LLMs alem do Gemini. Detalhes em [`BACKLOG_MULTI_PROVIDER.md`](./BACKLOG_MULTI_PROVIDER.md).
- **ARCH-05:** Planejar novos agentes especializados e perfis dinamicos de review. Detalhes em [`BACKLOG_SPECIALIZED_AGENTS.md`](./BACKLOG_SPECIALIZED_AGENTS.md).
- **ARCH-06:** Extrair lógica de `resolveAnalysisMode` para utilitário compartilhado (DRY).
- **ARCH-07:** Refatorar `agent_parser` para importação dinâmica baseada no `REVIEWER_CATALOG` (OCP).

## Infra

- **INFRA-01:** Adicionar RedisStore opcional ao rate limiter para ambientes multi-instancia.
- **INFRA-02:** Definir timeout maximo por analise para evitar requisicoes presas em CI/CD.
- **INFRA-03:** Adicionar logging estruturado com correlacao por `streamId`.
- **INFRA-04:** Implementar cancelamento de pipeline via `AbortSignal` ou `req.on('close')` para evitar resource leak.
- **INFRA-05:** Corrigir gap de billing: acumular tokens de prompt mesmo em caso de retries por falha transitória (ex: 429).
- **INFRA-06:** Adicionar rastreabilidade de provedores/modelos no `TokenUsageByAgentSchema` para auditoria de custos.
- **INFRA-07:** Implementar Error-Handling Middleware global no Express para capturar falhas fora das rotas (ex: body-parser).

## Qualidade

- **QUAL-01:** Expandir testes unitarios para CLI e API com mocks do `ReviewOrchestrator`.
- **QUAL-02:** Criar evaluation sets do ADK para cenarios de seguranca, qualidade, performance e regras de negocio.
- **QUAL-03:** Substituir gradualmente comentarios com encoding legado por texto UTF-8 limpo.
- **QUAL-04:** Corrigir vazamento de estado global em testes que manipulam `process.env` (usar teardown robusto).
- **QUAL-05:** Adicionar cobertura de testes para rotinas de contabilidade de usage (`mergeUsageMetadata` e `buildUsage`).
- **QUAL-06:** Atualizar README com novas flags, headers e exemplos de payload de Token Usage.

## Seguranca

- **SEC-01:** Revisar politica de CORS antes de expor a API publicamente.
- **SEC-02:** Padronizar politicas de retencao/log para diffs potencialmente sensiveis.
- **SEC-03:** Revisar limite de 25MB no `express.json` para mitigar Application-Layer DoS (parser síncrono bloqueante).
- **SEC-04:** Isolar `LlmReportSchema` do contrato de API para mitigar Self-DoS via injeção de prompt no `usage`.
- **SEC-05:** Adicionar limites seguros (`.max()`) em records dinâmicos no Zod (ex: `agentModels`).
