# Backlog: Deep Analysis via Sequential Thinking

Este backlog detalha a implementação da flag `--deep`, que habilita o raciocínio sequencial (Chain of Thought) nos agentes do A.L.E.X utilizando o Model Context Protocol (MCP).

## Objetivos
- Permitir análises de alta precisão para mudanças críticas.
- Reduzir falsos positivos em auditorias de segurança e regras de negócio.
- Implementar o suporte a ferramentas MCP de forma escalável.

---

## Fase 1: Infraestrutura e CLI (Fundação)

- [ ] **CLI-01:** Adicionar flag `-d, --deep` aos comandos `review` e `ci` no `src/cli.ts`.
- [ ] **CLI-02:** Atualizar o contrato `AnalysisOptions` para incluir a propriedade `deepMode: boolean`.
- [ ] **CLI-03:** Passar o estado de `deepMode` desde a CLI até a `createRootAgent` no `src/agent.ts`.

## Fase 2: Integração MCP Tooling

- [ ] **MCP-01:** Implementar/Configurar o cliente MCP para o protocolo `sequential-thinking`.
- [ ] **MCP-02:** Criar um wrapper de ferramenta no padrão ADK que mapeie as chamadas do agente para o servidor MCP.
- [ ] **MCP-03:** Garantir que o `LlmAgent` consiga processar múltiplos "thought steps" antes de gerar o output final (ajuste de loops de execução se necessário).

## Fase 3: Adaptação dos Especialistas

- [ ] **SPEC-01:** Modificar a factory de agentes em `src/agents/specialists.ts` para aceitar o parâmetro `deepMode`.
- [ ] **SPEC-02:** Injetar a ferramenta de Sequential Thinking nos agentes prioritários:
    - `security-auditor` (para análise de fluxo de dados).
    - `business-proxy` (para validação cruzada de requisitos).
    - `architect-consolidator` (para resolução de conflitos).
- [ ] **SPEC-03:** Criar "Deep Prompts": Versões das instruções dos agentes que explicitamente orientam o uso da ferramenta de pensamento para validar hipóteses antes de concluir.

## Fase 4: UX e Feedback Visual

- [ ] **UX-01:** Atualizar o spinner (`ora`) para indicar que uma "Análise Profunda" está em curso (pode demorar minutos).
- [ ] **UX-02:** Implementar logs de progresso (opcionais com `--verbose`) que mostrem os títulos dos "thoughts" que o agente está processando.
- [ ] **UX-03:** Adicionar um aviso no relatório final indicando que a análise foi feita em modo `--deep`.

## Fase 5: Estabilidade e Custos

- [ ] **COST-01:** Implementar um "Thinking Budget": Limite máximo de passos de pensamento ou tokens para evitar loops infinitos ou custos explosivos.
- [ ] **COST-02:** Aumentar os timeouts padrão de rede para a API do Gemini/LLM quando o modo deep estiver ativo.
- [ ] **COST-03:** Validar a persistência de contexto: Garantir que o histórico de pensamentos não estoure o limite de contexto do modelo escolhido.

---

## Riscos e Mitigações
- **Risco:** Latência extrema em CI/CD.
- **Mitigação:** Recomendar o uso de `--deep` apenas em triggers específicos (ex: merge para `main`) ou via comando manual.
- **Risco:** Custo de API elevado.
- **Mitigação:** Exibir um aviso de "Alto Consumo de Tokens" ao iniciar o modo deep no console.
