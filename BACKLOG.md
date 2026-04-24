# A.L.E.X Backlog

Este backlog registra debitos reais que devem ser tratados sem inflar o escopo do nucleo multiagente.

## Arquitetura

- **ARCH-01:** Separar a CLI em servicos menores (`git diff`, leitura de arquivo, renderizacao de resultado).
- **ARCH-02:** Centralizar configuracao runtime em um modulo unico para CLI, API e ADK.
- **ARCH-03:** Avaliar callbacks nativos do ADK para rastrear transicoes de agentes e chamadas de ferramentas.

## Infra

- **INFRA-01:** Adicionar RedisStore opcional ao rate limiter para ambientes multi-instancia.
- **INFRA-02:** Definir timeout maximo por analise para evitar requisicoes presas em CI/CD.
- **INFRA-03:** Adicionar logging estruturado com correlacao por `streamId`.

## Qualidade

- **QUAL-01:** Expandir testes unitarios para CLI e API com mocks do `ReviewOrchestrator`.
- **QUAL-02:** Criar evaluation sets do ADK para cenarios de seguranca, qualidade, performance e regras de negocio.
- **QUAL-03:** Substituir gradualmente comentarios com encoding legado por texto UTF-8 limpo.

## Seguranca

- **SEC-01:** Revisar politica de CORS antes de expor a API publicamente.
- **SEC-02:** Padronizar politicas de retencao/log para diffs potencialmente sensiveis.
