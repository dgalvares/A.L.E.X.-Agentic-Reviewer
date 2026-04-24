# 🤖 Antigravity Rules for A.L.E.X Workspace

Este documento rege o comportamento da IA (Antigravity) durante o desenvolvimento deste repositório, garantindo que o framework A.L.E.X seja construído com o rigor técnico exigido pelo **Google Agent Development Kit (ADK)**.

---

## 1. Princípios de Arquitetura Core
- **Contract-First Development:** Antes de qualquer implementação, as Interfaces, Enums e Schemas de validação (Zod) devem estar definidos.
- **Stateless API / Stateful Session:** O serviço é stateless entre requisições, mas internamente deve utilizar o `SessionService` e `State` do ADK para orquestrar o raciocínio do conselho.
- **Micro-serviço Agnóstico:** Código otimizado para Google Cloud Run, evitando dependências de SO específicas.

## 2. Padrões de Desenvolvimento (TypeScript)
- **Tipagem Estrita (No-Any Policy):** Uso obrigatório de interfaces e tipos fortes.
- **Validação com Zod:** Obrigatória para todos os inputs/outputs de `FunctionTool`. Cada campo no schema Zod deve possuir uma `.describe()` clara, pois o ADK utiliza isso para instruir o LLM.
- **Isolamento de Agentes:** Cada especialista deve ser um módulo independente, comunicando-se apenas via interfaces de ferramentas ou delegação do Orquestrador.

## 3. Gestão de Inteligência (ADK Patterns)
- **Modularidade via Skills:** Agentes complexos devem seguir o padrão de **Skills** do ADK (`SKILL.md` e diretórios de `references/`, `assets/`).
- **Prompts Externos:** Instruções de sistema não devem ser hardcoded. Use arquivos de configuração ou a estrutura de Skills.
- **Naming Convention:**
    - **Tools:** `snake_case` (ex: `analyze_code_diff`).
    - **Agents/Skills:** `kebab-case` ou `PascalCase` para classes (ex: `security-agent`).

## 4. Observabilidade & Rastreabilidade
- **Native Callbacks:** É obrigatório o uso de **ADK Callbacks** para logar transições de estado, chamadas de ferramentas e eventos de inter-agentes. Isso garante compatibilidade com o `adk web` (Trace View).
- **Metadados de Origem:** Toda resposta deve conter o campo `origin`, mapeado via eventos do ADK para permitir auditoria de "quem disse o quê".

## 5. Protocolo de Veredito & Decisão
- **Hierarquia de Prioridade:** Seguranças e Regras de Negócio têm peso absoluto.
    - `Security Alert (Blocker)` OU `Business Violation` => **RESULT: FAIL**.
- **Consenso:** O Orquestrador utiliza o histórico da `Session` para resolver conflitos entre agentes antes do veredito final.

## 6. Qualidade & Avaliação Automatizada
- **Evaluation Sets:** Para cada novo agente ou ferramenta, um arquivo `.test.json` correspondente deve ser criado em `tests/evaluation/`.
- **Regressão:** Alterações na lógica de orquestração exigem a execução do `npx adk eval` para garantir que o comportamento do conselho não degradou.

## 7. Validação de Código
- **Code Review Obrigatório:** Todo novo código gerado ou modificado pela IA ou desenvolvedores deve passar obrigatoriamente pela validação local do A.L.E.X (`alex review` ou `alex analyze <arquivo>`) antes de ser considerado finalizado.

---
> [!IMPORTANT]
> Estas regras são imutáveis e alinham o A.L.E.X ao estado da arte do desenvolvimento agentic com Google ADK.
