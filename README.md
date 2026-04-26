# 🛡️ A.L.E.X (Advanced Logic Evaluation X-ray)

> **Status:** ✅ Production Ready | **Engine:** Multi-Agent Reasoning (Google ADK) | **Model:** gemini-2.5-pro

**A.L.E.X** é um framework de análise diagnóstica profunda que realiza a "radiografia" técnica e lógica de sistemas complexos. Diferente de linters tradicionais, o A.L.E.X opera como um **Micro-serviço de Inteligência**, aplicando heurísticas de avaliação em múltiplas camadas para identificar falhas estruturais, vulnerabilidades de segurança e oportunidades de otimização arquitetural.

O próprio código do A.L.E.X é validado continuamente por seus agentes (`alex review`) — cada melhoria de segurança e qualidade neste repositório foi identificada e corrigida pelo Conselho de Agentes que ele hospeda.

---

## 🏛️ Arquitetura Multi-Agente (The Council of Agents)

O A.L.E.X opera sob o padrão de **Delegação Paralela**, orquestrando um conselho de agentes especialistas coordenados via **Google ADK**. O usuário configura apenas o catálogo de agentes de análise; revisores são derivados automaticamente quando suas dependências estão presentes.

```
                    ┌─────────────────────┐
                    │  ReviewOrchestrator │  ← Ponto de entrada (CLI / API)
                    └──────────┬──────────┘
                               │
                               ▼
          ┌──────────────────────────────────────────────┐
          │ ParallelAgent: agentes de análise ativos     │
          │ security, quality, sre, business, tests, ... │
          └──────────────────────┬───────────────────────┘
                                 │
                                 ▼
          ┌──────────────────────────────────────────────┐
          │ ParallelAgent: revisores derivados           │
          │ security-reviewer, performance-reviewer      │
          └──────────────────────┬───────────────────────┘
                                 │
                                 ▼
          ┌──────────────────────────────────────────────┐
          │ architect-consolidator                       │
          │ FinalReport: PASS / WARN / FAIL              │
          └──────────────────────────────────────────────┘
```

### 👑 The Architect (Orquestrador)
- Extrai metadados do diff/sourceCode via parser linear O(n)
- Delega em paralelo para os agentes habilitados no perfil
- Executa revisores apenas quando suas dependências de agentes estão presentes
- Consolida feedbacks conflitantes em um **veredito final único**
- Aplica retry exponencial com jitter para falhas transitórias do provedor

### Agentes de Análise

| Agente | Padrão | Foco |
| :--- | :---: | :--- |
| `security-auditor` | Sim | OWASP Top 10, path traversal, ReDoS, timing attacks, vazamento de credenciais e data leakage |
| `clean-coder` | Sim | S.O.L.I.D, DRY, complexidade ciclomática, No-Any Policy e Contract-First Development |
| `sre-agent` | Sim | Memory leaks, OOM, event loop blocking, timeouts, retry, rate limiting e eficiência operacional |
| `business-proxy` | Sim | Regras de domínio via RAG dinâmico, READMEs e documentação de arquitetura local |
| `error-handling-specialist` | Não | Caminhos de erro, fallback seguro, resiliência e falhas recuperáveis |
| `test-strategist` | Não | Qualidade de testes, cobertura de regressão, contratos e comportamento de CI |
| `observability-engineer` | Não | Logs, métricas, traces, debuggability e diagnóstico sem vazamento de segredo |
| `docs-maintainer` | Não | Documentação de produto, API, operação e superfície de comandos/configuração |
| `scalability-architect` | Não | Escalabilidade, concorrência, batching, limites de memória e crescimento de dados |

### Revisores Derivados

| Revisor | Dependências | Foco |
| :--- | :--- | :--- |
| `security-reviewer` | `sre-agent`, `clean-coder` | Revisa achados de confiabilidade e qualidade sob a ótica de segurança |
| `performance-reviewer` | `security-auditor`, `clean-coder` | Revisa achados de segurança e qualidade sob a ótica de performance |

Use `alex review all` ou `alex review --agents all` para executar todos os agentes de análise. Revisores não são habilitados diretamente pelo usuário.

---

## 🛠️ Stack Tecnológica

| Componente        | Tecnologia           | Detalhes                                                |
| :---              | :---                 | :---                                                    |
| **Language**      | **TypeScript**       | Tipagem estrita; No-Any Policy enforced                 |
| **Framework**     | **Google ADK**       | `@google/adk` + `@google/adk-devtools`                  |
| **API**           | **Express 5**        | Rate limiting, Auth Bearer, Zod validation              |
| **CLI**           | **Commander.js**     | `alex review` e `alex analyze <file>`                   |
| **Reasoning**     | **Gemini 2.5 Pro**   | Configurável via `ALEX_MODEL` no `.env`                 |
| **Contracts**     | **Zod**              | Schemas runtime para entrada e saída dos agentes        |

---

## 📋 Pré-requisitos

- **Node.js:** `^24.13.0` ou superior
- **NPM:** `^11.8.0` ou superior
- **Git:** Instalado e em `PATH` (necessário para `alex review`)

> [!WARNING]
> **Rate Limits:** Devido à natureza paralela do Council of Agents, use **gemini-2.5-pro** como mínimo. O `gemini-2.0-flash` frequentemente apresenta HTTP 429 por exaustão de cota de requisições simultâneas.

---

## 🚀 Quick Start

### Usar como CLI publicada

```bash
npm install -g @dgalvarestec/alex
alex review
```

Para instalar direto deste repositório antes da publicação no npm:

```bash
npm install -g github:dgalvares/A.L.E.X.-Advanced-Logic-Evaluation-X-ray-
```

Faça o setup uma única vez:

```bash
alex config set-key
alex config set-model gemini-2.5-pro
alex config show
```

O CLI salva essa configuração em `~/.alex/config.json`. Variáveis de ambiente continuam tendo prioridade, então CI/CD pode usar `GEMINI_API_KEY` e `ALEX_MODEL` normalmente.
O comando `alex config set-key` solicita a chave em modo oculto, sem gravá-la no histórico do shell.

### Desenvolvimento local

### 1. Instalação de Dependências

```bash
npm install
```

### 2. Configuração de Ambiente

Crie um arquivo `.env` na raiz (use `.env.example` como base):

```bash
# Obrigatório
GEMINI_API_KEY="sua_chave_aqui"

# Opcional — padrão: gemini-2.5-pro
ALEX_MODEL="gemini-2.5-pro"

# Obrigatório para a API REST (bloqueia acesso se ausente)
API_BEARER_TOKEN="sua_senha_secreta"

# Para deploy em Cloud Run/Kubernetes (CIDR da rede interna)
# TRUSTED_PROXY_CIDR="10.0.0.0/8"
```

### 3. Compilar

```bash
npx tsc
```

### 4. Validar

```bash
npm run typecheck
npm test
```

---

## 💻 Modos de Uso

### CLI — `alex review`
Analisa as modificações locais via `git diff HEAD` e inclui arquivos novos ainda `untracked` no relatório local. Ideal para uso antes do commit.

```bash
# Com o modelo padrão (definido em .env)
alex review

# Com modelo específico
alex review -m gemini-2.5-pro
```

**Output exemplo:**
```
🛡️ A.L.E.X Code Review Iniciado

[ALEX] Análise finalizada com sucesso.

Veredito Final: FAIL
--------------------------------------------------
Foram identificados 2 Blockers críticos de segurança...
--------------------------------------------------

[Blocker] security-auditor
Arquivo: src/server.ts (Linha 25)
Mensagem: Auth Fail-Open — API acessível sem token configurado.
```

### CLI — `alex analyze <arquivo>`
Analisa um arquivo completo estruturalmente. Ideal para validar um módulo específico.

```bash
alex analyze src/services/payment.service.ts
```

### Perfis Dinâmicos de Agentes

Por padrão, `default` mantém o conselho atual. Agentes adicionais podem ser habilitados por comando, variável de ambiente ou configuração persistente:

```bash
alex review --agents default,test-strategist,error-handling-specialist
alex review --agents all
alex review all
alex ci --diff-file pr.diff --agents default,docs-maintainer --disable-agents sre-agent
alex config set-agents default,observability-engineer
alex config set-agents all
alex config disable-agent docs-maintainer
```

Use `all` para rodar todos os agentes de análise registrados. Agentes opt-in disponíveis: `error-handling-specialist`, `test-strategist`, `observability-engineer`, `docs-maintainer` e `scalability-architect`.
Agentes revisores não são configuráveis pelo usuário: eles entram automaticamente quando suas dependências existem. `security-reviewer` roda quando `sre-agent` e `clean-coder` estão ativos; `performance-reviewer` roda quando `security-auditor` e `clean-coder` estão ativos.

| Agente de análise | Perfil | Foco |
|---|---|---|
| `security-auditor` | `default` | Vulnerabilidades, conformidade e vazamento de dados |
| `clean-coder` | `default` | Manutenibilidade, design, DRY e contratos |
| `sre-agent` | `default` | Performance, resiliência e eficiência operacional |
| `business-proxy` | `default` | Regras de negócio e documentação local via RAG |
| `error-handling-specialist` | opt-in / `all` | Fail-open/fail-closed, retries, rollback e idempotência |
| `test-strategist` | opt-in / `all` | Cobertura, regressão, casos negativos e fragilidade de testes |
| `observability-engineer` | opt-in / `all` | Logs, métricas, traces, correlation IDs e auditabilidade |
| `docs-maintainer` | opt-in / `all` | README, exemplos, changelog, docs de API e runbooks |
| `scalability-architect` | opt-in / `all` | Throughput, concorrência, filas, cache e multi-instância |

| Revisor automático | Dependências | Função |
|---|---|---|
| `security-reviewer` | `sre-agent`, `clean-coder` | Verifica se achados de performance/qualidade introduzem risco de segurança |
| `performance-reviewer` | `security-auditor`, `clean-coder` | Verifica se achados de segurança/qualidade introduzem gargalos |

> [!NOTE]
> **Proteções de Segurança na CLI:**
> - Path Traversal Prevention via `fs.realpath` (anti-symlink bypass)
> - Data Leakage Blocklist: `.pem`, `.key`, `.pfx`, `.sqlite`, `id_rsa`, `.npmrc`, etc.
> - Limite de 1MB por arquivo (anti-OOM)
> - Git diff limitado a 10MB com stream via `spawn` (anti-DoS)

### API REST — `POST /v1/analyze`
Para integração com CI/CD (GitHub Actions, GitLab CI).

```bash
npm run start:api
# API disponível em http://localhost:3000
```

**Endpoint:** `POST /v1/analyze`

**Headers obrigatórios:**
```
Authorization: Bearer <API_BEARER_TOKEN>
Content-Type: application/json
```

**Payload:**
```json
{
  "streamId": "uuid-opcional",
  "metadata": {
    "stack": ".net",
    "project": "MeuProjeto",
    "agents": ["default", "test-strategist"],
    "disabledAgents": ["docs-maintainer"]
  },
  "diff": "conteúdo_do_git_diff_aqui"
}
```

**Resposta:**
```json
{
  "streamId": "...",
  "verdict": "FAIL",
  "summary": "Foram encontrados 2 Blockers...",
  "issues": [
    {
      "origin": "security-auditor",
      "severity": "Blocker",
      "file": "src/api/controller.cs",
      "line": 42,
      "message": "SQL Injection via concatenação direta.",
      "codeSnippet": "var query = \"SELECT * FROM users WHERE id = \" + id;"
    }
  ],
  "timestamp": "2026-04-24T19:00:00Z"
}
```

**Health Check:**
```bash
curl http://localhost:3000/health
# {"status":"UP","version":"1.0.0"}
```

### ADK Web UI (Debug)
Interface visual para inspecionar o fluxo de raciocínio dos agentes.

```bash
npx adk web
# http://localhost:8000
```

### GitHub Actions — `alex review`
Existem dois templates:

- `.github/workflows/alex-pr-review.yml`: usado neste repositório, buildando o A.L.E.X localmente.
- `.github/workflows/alex-pr-review.consumer.yml`: copie para outros repositórios; ele instala `@dgalvarestec/alex` como CLI global.

O workflow consumidor permite acionar o A.L.E.X em PRs:

- manualmente via `workflow_dispatch` informando `pr_number`;
- por comentário contendo `alex review` no PR ou em review comments.
- por comentário com perfil de agentes, como `alex review all`, `alex review --agents all` ou `alex review --agents default,test-strategist --disable-agents docs-maintainer`.

Configure o secret `GEMINI_API_KEY` no repositório. Opcionalmente, configure as variáveis `ALEX_MODEL`, `ALEX_AGENTS` e `ALEX_DISABLED_AGENTS` para trocar o modelo e o perfil de agentes padrão.

Para falhas transitórias do provedor, o A.L.E.X aplica retry exponencial com jitter preservando o ciclo interno do ADK. Os padrões são `ALEX_AGENT_MAX_RETRIES=2` e `ALEX_AGENT_RETRY_BASE_MS=1000`. Para evitar retry storm, perfis com múltiplos agentes não reexecutam o pipeline inteiro por padrão; use `ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY=true` apenas se aceitar esse custo.

Na API, `ALEX_API_MAX_CONCURRENT_ANALYSES` controla o backpressure global de análises simultâneas. O padrão é `2`; quando o limite é atingido, a API responde `503` com `Retry-After`.

O workflow consumidor executa:
```bash
gh pr diff <PR> > pr.diff
alex ci --diff-file pr.diff --output-file alex-review.md --pr-number <PR>
```

Comentários `alex review` só executam para usuários com permissão `write`, `maintain` ou `admin`, evitando consumo indevido da chave em repositórios públicos.

### Publicação no npm

O repositório usa publicação por **Trusted Publishing (OIDC)** — sem `NPM_TOKEN` armazenado:

- `.github/workflows/publish.yml`: publicado no npm quando uma tag `v*` é enviada.
- `.github/workflows/release.yml`: cria GitHub Release ao detectar tag `v*`.
- `.github/workflows/preview-manual.yml`: gera `.tgz` preview como artifact, sem publicar.

Configure no npm o Trusted Publisher do pacote `@dgalvarestec/alex`:

```text
Provider: GitHub Actions
Repository: dgalvares/A.L.E.X.-Advanced-Logic-Evaluation-X-ray-
Workflow filename: publish.yml
Environment: npm-production
```

No GitHub, crie o environment `npm-production` (com aprovação manual opcional).

Publicação de versão:

```bash
npm version patch   # ou minor / major
npm run typecheck
npm test
git push origin main --follow-tags
```

---

## 📂 Estrutura do Projeto

```
A.L.E.X/
├── src/
│   ├── agents/
│   │   └── specialists.ts     # Security, Clean Coder, SRE, Business Proxy
│   ├── prompts/
│   │   └── index.ts           # Prompts dos agentes externalizados
│   ├── schemas/
│   │   └── contracts.ts       # Zod schemas: AnalysisPayload, FinalReport, etc.
│   ├── tools/
│   │   └── diff_tools.ts      # Parser O(n) para metadados de diff/sourceCode
│   ├── utils/
│   │   ├── parser.ts          # Helper compartilhado de extração de JSON
│   │   ├── diff_sanitizer.ts  # Sanitização de diffs: redact secrets e arquivos sensíveis
│   │   └── sensitive_paths.ts # Blocklist centralizada de paths/extensões proibidos
│   ├── agent.ts               # rootAgent (ADK entry point)
│   ├── cli.ts                 # CLI: comandos review e analyze
│   ├── config.ts              # Configuração centralizada (FALLBACK_MODEL, getDefaultModel)
│   ├── orchestrator.ts        # ReviewOrchestrator — coordenação imutável do pipeline
│   └── server.ts              # API Express com Auth, Rate Limit e Zod
├── tests/
│   └── evaluation/            # Arquivos .test.json para ADK Eval
├── .agents/
│   └── rules.md               # Regras imutáveis do workspace
├── BACKLOG.md                 # Débitos arquiteturais para iterações futuras
└── .env.example               # Template de configuração
```

---

## 🔒 Segurança da API

| Proteção | Implementação |
|---|---|
| **Autenticação** | Bearer Token via SHA-256 hash + `crypto.timingSafeEqual` (anti Timing Attack) |
| **Rate Limiting** | 10 req/min/IP com `express-rate-limit` (RFC headers) |
| **Validação de Input** | `AnalysisPayloadSchema` via Zod após auth/rate limit, antes do processamento |
| **Fail-Closed** | API retorna 500 se `API_BEARER_TOKEN` não estiver configurado |
| **Trust Proxy** | Restrito a `loopback` por padrão; configurável via `TRUSTED_PROXY_CIDR` |
| **Body Limit** | 10MB máximo; `jsonParser` aplicado **após** auth para economizar parse desnecessário |
| **Sanitização de Diff** | `diff_sanitizer.ts` redacta secrets e arquivos sensíveis antes de enviar ao LLM |
| **Limite de Confiança do LLM** | Código, diffs e comentários analisados são tratados como conteúdo não confiável; instruções embutidas nesses inputs não devem substituir prompts do sistema |
| **Imutabilidade** | Orquestrador cria `normalizedInput` via spread — sem mutação do payload original |

> [!WARNING]
> **Ambientes multi-pod (Cloud Run/Kubernetes):** O `MemoryStore` padrão do rate limiter não é compartilhado entre instâncias. Para deploy distribuído, configure `RedisStore` — veja `BACKLOG.md` [INFRA-01].

---

## 📜 Regras do Workspace (`.agents/rules.md`)

1. **Especialização Estrita:** Agentes proibidos de opinar fora de seu domínio técnico.
2. **Protocolo de Consenso:** Um `Blocker` de segurança resulta em **FAIL** imediato.
3. **Rastreabilidade:** Todo apontamento deve conter `origin` (ex: `security-auditor`).
4. **Tipagem Estrita:** Severidades via Enum (`Blocker`, `Critical`, `Major`, `Minor`, `Info`).
5. **Prioridade de Domínio:** Regras de negócio documentadas sobrepõem preferências estéticas.
6. **Filtro de Ingestão:** Ignorar `bin`, `obj`, `node_modules`, `dist`.
7. **Obrigatoriedade de Review:** Todo novo código deve ser validado via `alex review` antes do merge.

---

## 📌 Backlog & Próximos Passos

Os débitos arquiteturais identificados pelo próprio A.L.E.X estão documentados em [`BACKLOG.md`](./BACKLOG.md), incluindo:

- **[ARCH-01/02]** Refatoração da CLI (God Class → Services)
- **[INFRA-01]** RedisStore para rate limiting distribuído
- **[QUAL-03]** Testes de unidade (`ADK Eval`)

---

© 2026 DgAlvaresTEC — Advanced Agentic Systems
