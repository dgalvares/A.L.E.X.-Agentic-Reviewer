# 🛡️ A.L.E.X (Advanced Logic Evaluation X-ray)

> **Status:** ✅ Production Ready | **Engine:** Multi-Agent Reasoning (Google ADK) | **Model:** gemini-2.5-pro

**A.L.E.X** é um framework de análise diagnóstica profunda que realiza a "radiografia" técnica e lógica de sistemas complexos. Diferente de linters tradicionais, o A.L.E.X opera como um **Micro-serviço de Inteligência**, aplicando heurísticas de avaliação em múltiplas camadas para identificar falhas estruturais, vulnerabilidades de segurança e oportunidades de otimização arquitetural.

O próprio código do A.L.E.X é validado continuamente por seus agentes (`alex review`) — cada melhoria de segurança e qualidade neste repositório foi identificada e corrigida pelo Conselho de Agentes que ele hospeda.

---

## 🏛️ Arquitetura Multi-Agente (The Council of Agents)

O A.L.E.X opera sob o padrão de **Delegação Paralela**, orquestrando um conselho de agentes especialistas coordenados via **Google ADK**.

```
                    ┌─────────────────────┐
                    │  ReviewOrchestrator │  ← Ponto de entrada (CLI / API)
                    └──────────┬──────────┘
                               │ ParallelAgent
          ┌────────────────────┼─────────────────────┐
          ▼                    ▼                     ▼                    ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │  Security    │   │  Clean Coder │   │  SRE Agent   │   │  Business    │
  │  Auditor     │   │              │   │              │   │  Proxy       │
  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
         └──────────────────┴──────────────────┴──────────────────┘
                                       │ Cross-Review (Reflexão)
                    ┌──────────────────┼───────────────────┐
                    ▼                                       ▼
           ┌─────────────────┐                  ┌─────────────────┐
           │ Security        │                  │ Performance     │
           │ Reviewer        │                  │ Reviewer        │
           └─────────────────┘                  └─────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │    architect-consolidator           │
                    │  (FinalReport: PASS / WARN / FAIL)  │
                    └─────────────────────────────────────┘
```

### 👑 The Architect (Orquestrador)
- Extrai metadados do diff/sourceCode via parser linear O(n)
- Delega em paralelo para os 4 especialistas
- Consolida feedbacks conflitantes em um **veredito final único**

### 🛡️ Security Auditor
- OWASP Top 10, Path Traversal, ReDoS, Timing Attacks
- Detecção de vazamento de credenciais e Data Leakage

### 🛠️ Clean Coder
- S.O.L.I.D, DRY, Complexidade Ciclomática
- No-Any Policy, Contract-First Development

### 🚀 SRE Agent
- Memory Leaks, OOM, Event Loop blocking
- Resiliência: timeouts, retry, rate limiting

### 🧠 Business Proxy
- Valida conformidade com regras de domínio via RAG dinâmico
- Consome READMEs e documentação de arquitetura local

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
Analisa as modificações locais via `git diff HEAD`. Ideal para uso antes do commit.

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
  "metadata": { "stack": ".net", "project": "MeuProjeto" },
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
