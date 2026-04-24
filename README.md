# 🛡️ A.L.E.X (Advanced Logic Evaluation X-ray)

> **Status:** 🚥 Ready for Deployment | **Engine:** Multi-Agent Reasoning (Google ADK)

**A.L.E.X** é um framework de análise diagnóstica profunda, projetado para realizar a "radiografia" técnica e lógica de sistemas complexos. Diferente de linters tradicionais, o A.L.E.X opera como um **Micro-serviço de Inteligência**, aplicando heurísticas de avaliação em múltiplas camadas para identificar falhas estruturais, vulnerabilidades de design e oportunidades de otimização arquitetural antes do commit.

---

## 🏛️ Arquitetura Multi-Agente (The Council of Agents)

O A.L.E.X opera sob o padrão de **Delegação**, orquestrando um conselho de agentes especialistas coordenados via **Google ADK**.

### 👑 Agente Orquestrador (The Architect)
- **Papel:** O cérebro central e ponto de entrada da API.
- **Responsabilidade:** 
    - Identificar arquivos e stacks envolvidas no `diff`.
    - Delegar sub-tarefas em paralelo para os especialistas.
    - Consolidar feedbacks conflitantes em um **veredito final único**.

### 🛡️ Agente de Segurança (The Security Auditor)
- **Foco:** Proteção e conformidade (OWASP Top 10).
- **Tooling:** RAG específico focado em vulnerabilidades de stack (.NET/React).

### 🛠️ Agente de Qualidade e Design (The Clean Coder)
- **Foco:** Manutenibilidade (S.O.L.I.D, DRY, Complexidade Ciclomática).
- **Métrica:** Atua como um "Sonar Humanoide" focado em eliminar *Code Smells*.

### 🚀 Agente de Performance e Infra (The SRE Agent)
- **Foco:** Eficiência operacional (N+1 queries, Memory Leaks, React Re-renders).

### 🧠 Agente de Contexto (The Business Proxy)
- **Papel:** A Memória Viva do projeto.
- **Responsabilidade:** Validar se a alteração fere regras de domínio consumindo READMEs e Docs de Arquitetura via **RAG Dinâmico**.

---

## 🛠️ Stack Tecnológica (The X-ray Engine)

| Componente             | Tecnologia              | Detalhes                                                               |
| :---                   | :---                    | :---                                                                   |
| **Language**           | **TypeScript**          | Tipagem estrita para contratos de IA.                                  |
| **Framework**          | **Google ADK**          | `@google/adk` para core, `@google/adk-devtools` para CLI/Web.          |
| **API Framework**      | **Fastify / Express**   | Exposição do serviço de forma agnóstico.                               |
| **Reasoning**          | **Gemini 2.5 Pro**      | Multimodalidade e estabilidade em requisições paralelas.               |
| **Intelligence**       | **Vector Search**       | RAG para padrões de arquitetura e segurança.                           |

---

## 📋 Pré-requisitos

Para garantir o funcionamento pleno das ferramentas de streaming e orquestração do ADK:

- **Node.js:** `^24.13.0` ou superior.
- **NPM:** `^11.8.0` ou superior.
- **Google Cloud SDK:** Configurado (opcional para Vertex AI).

> [!WARNING]
> **Requisito de Modelo LLM (Rate Limits):** Devido à natureza paralela do *"Council of Agents"*, recomenda-se estritamente a utilização do modelo **gemini-2.5-pro** como requisito mínimo e fallback padrão. O modelo *gemini-2.0-flash*, mesmo em tiers mais altos, costuma apresentar falhas (HTTP 429) por exaustão de cota de requisições simultâneas ao orquestrar a delegação de tarefas do A.L.E.X.

---

## 🚀 Quick Start (Setup)

1.  **Instalação de Dependências:**
```bash
npm install @google/adk
npm install -D @google/adk-devtools
```

2.  **Configuração de Ambiente:**
Crie um arquivo `.env` na raiz do projeto:
```bash
GEMINI_API_KEY="SUA_CHAVE_AQUI"
# Ou para Vertex AI:
# GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
```

---

## 💻 Execução & Debugging

O A.L.E.X pode ser operado de três formas principais:

### 1. CLI Mode (Interactive)
Ideal para testes rápidos de diagnóstico via terminal.
```bash
npx adk run src/agent.ts
```

### 2. Web UI Mode (Trace & Debug)
Abre uma interface local (http://localhost:8000) para visualizar o fluxo de pensamento (**Trace**) e os eventos dos agentes.
```bash
npx adk web
```

### 3. Evaluation Mode
Executa baterias de testes para validar a precisão dos agentes.
```bash
npx adk eval src/ tests/evaluation.test.json
```

---

## 🧭 Plano de Execução (The Build Phase)

### 🧩 Fase 1: Scaffold & Tipagem (Contract First)
- **Ação:** Inicializar o projeto e definir o Schema JSON de comunicação.
- **Task:** Configurar `AgentSystem` e definir interfaces: `CodeDiff`, `AnalysisIssue` e `FinalReport`.

### 🔀 Fase 2: Implementação da Orquestração
- **Ação:** Criar a lógica de coordenação paralela via `Promise.all`.
- **Task:** Implementar a classe `ReviewOrchestrator` e o gerenciamento de estado dos agentes.

### 🔄 Fase 3: Comunicação Inter-Agentes (Reflexão)
- **Ação:** Implementar o passo de **Cross-Review**. 
- **Task:** Configurar loops de reflexão onde o Orquestrador pede para o *Security* revisar as sugestões de *Performance*.

### 📚 Fase 4: Agente de Contexto & RAG Efêmero
- **Ação:** Desenvolver o `BusinessContextAgent.ts`.
- **Task:** Implementar busca semântica em arquivos `.md` e `.txt` locais para validar regras de negócio.

---

## 📂 Estrutura do Projeto (ADK Patterns)

```text
A.L.E.X/
├── src/
│   ├── agents/          # Definições de LlmAgent (Architect, Security, etc)
│   ├── tools/           # FunctionTools customizadas (RAG, Diff Analyzers)
│   ├── schemas/         # Zod schemas para contratos de entrada/saída
│   └── agent.ts         # Ponto de entrada (rootAgent)
├── tests/
│   └── evaluation/      # Arquivos .test.json para ADK Eval
└── .env                 # Configurações de API Key
```

---

## 📜 Agent Rules (The Constraints)

Para garantir a evolução consistente via Antigravity, as seguintes regras são imutáveis:

1.  **Especialização Estrita:** Agentes são proibidos de opinar fora de seu domínio técnico.
2.  **Protocolo de Consenso:** O Orquestrador possui o poder do **Veto**. Se houver um `Blocker` de segurança, o veredito é **FAIL**.
3.  **Rastreabilidade:** Cada apontamento deve conter a propriedade `origin` (ex: `origin: "security-agent"`).
4.  **Tipagem Estrita:** Uso obrigatório de **Enums** para Severidade (`Blocker`, `Critical`, `Major`, `Minor`, `Info`).
5.  **Prioridade de Domínio:** Regras de negócio documentadas atropelam preferências estéticas de código.
6.  **Filtro de Ingestão:** O Agente de Contexto deve ignorar pastas de artefatos (`bin`, `obj`, `node_modules`, `dist`).

---

## 🏗️ Estratégia de Deploy (Ports & Adapters)

O A.L.E.X foi desenhado com o "Cérebro" centralizado e isolado (Core Engine), permitindo que ele seja consumido através de diferentes adaptadores:

### 1. Integração via API (CI/CD)
O núcleo pode ser envelopado em um servidor web (Fastify/Express) expondo um endpoint `POST /v1/analyze`.
- **Casos de Uso:** Acionado via Webhook por GitHub Actions ou GitLab CI a cada novo Pull Request, operando como um revisor de código autônomo.
- **Payload Exemplo:**
```json
{
  "streamId": "uuid",
  "metadata": { "stack": ".net", "project": "Bonifiq" },
  "diff": "git_diff_content_here"
}
```

### 2. Integração via CLI Local
O núcleo também pode ser embutido num pacote global (`npm install -g @alex/cli`), permitindo uso no terminal.
- **Casos de Uso:** O desenvolvedor executa `alex review` localmente antes do commit. A CLI captura o `git diff` da máquina, roda a inteligência e pinta o JSON de resposta no próprio terminal.

---

## 📌 Melhorias Futuras (TODOs)

- [ ] **Dynamic Model & Key Injection:** Permitir ao usuário (tanto na CLI quanto no payload da API) definir qual modelo do Gemini usar (`gemini-2.0-flash`, `gemini-2.5-pro`, etc) e injetar sua própria `GEMINI_API_KEY` por requisição (Bring Your Own Key - BYOK), garantindo escalabilidade em ambientes multi-tenant sem esgotar a cota de um único projeto.

---
© 2026 DgAlvaresTEC - Advanced Agentic Systems
