# Backlog: Multi-provider LLM Support

Este backlog formaliza o plano para permitir que o A.L.E.X use provedores de IA alem do Gemini, mantendo compatibilidade com o fluxo atual baseado em Google ADK.

## Objetivo

Permitir selecionar o provedor/modelo em CLI, API e GitHub Actions sem acoplar o produto a uma unica API key.

Exemplos desejados:

```bash
alex config set-provider gemini
alex config set-key
alex config set-model gemini-2.5-pro

alex config set-provider openai
alex config set-key
alex config set-model gpt-5.1

alex review --provider openai --model gpt-5.1
alex ci --provider anthropic --model claude-sonnet-4.5
```

## Decisao Arquitetural Inicial

Comecar com arquitetura provider-agnostic, mas implementar apenas:

1. `gemini` como provider padrao e compativel com o comportamento atual.
2. `openai` como primeiro provider externo.

Anthropic, Bedrock e outros providers devem entrar depois que o contrato estiver estabilizado.

## Fase 1: Configuracao Multi-provider

- Adicionar `ALEX_PROVIDER`.
- Manter compatibilidade com `GEMINI_API_KEY` e `ALEX_MODEL`.
- Evoluir `~/.alex/config.json` para suportar:

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-pro",
  "apiKeys": {
    "gemini": "...",
    "openai": "...",
    "anthropic": "..."
  }
}
```

- Criar comandos:
  - `alex config set-provider <provider>`
  - `alex config set-key` usando o provider ativo
  - `alex config show` sem exibir segredos

Critérios de aceite:

- Instalações atuais com `GEMINI_API_KEY` continuam funcionando.
- Config local antiga com `geminiApiKey` continua sendo lida.
- CI/CD pode usar somente env vars, sem arquivo local.

## Fase 2: Interface de LLM

Criar uma interface minima para chamadas de modelo:

```ts
export interface LlmClient {
  generate(input: LlmRequest): Promise<LlmResponse>;
}
```

Responsabilidades:

- Normalizar entrada e saida.
- Centralizar timeout, retry e erros conhecidos.
- Preservar contratos Zod do relatorio final.

Critérios de aceite:

- `ReviewOrchestrator` deixa de depender diretamente de variaveis de ambiente de um provider especifico.
- Testes unitarios conseguem mockar um `LlmClient`.

## Fase 3: Estrategia com Google ADK

Avaliar duas opcoes:

### Opcao A: Hibrida

- Gemini continua usando Google ADK.
- Outros providers usam clients diretos.
- A.L.E.X passa a controlar a orquestracao multiagente acima dos providers.

Vantagem: menor risco imediato.

Risco: dois caminhos de execucao internos.

### Opcao B: Orquestracao propria

- Reduzir o acoplamento ao ADK.
- Todos os providers passam pelo mesmo motor multiagente do A.L.E.X.

Vantagem: arquitetura mais limpa.

Risco: maior esforco e maior chance de regressao.

Decisao recomendada para inicio: **Opcao A**.

## Fase 4: Primeiro Provider Extra

Implementar `openai` como primeiro provider externo.

Novas env vars:

```text
ALEX_PROVIDER=openai
ALEX_MODEL=gpt-5.1
OPENAI_API_KEY=...
```

Critérios de aceite:

- `alex review --provider openai --model <model>` funciona.
- `alex ci` funciona em GitHub Actions com `OPENAI_API_KEY`.
- Saida final permanece compatível com `FinalReportSchema`.

## Fase 5: GitHub Actions e API

Atualizar workflow consumidor para aceitar:

```yaml
env:
  ALEX_PROVIDER: ${{ vars.ALEX_PROVIDER || 'gemini' }}
  ALEX_MODEL: ${{ vars.ALEX_MODEL || 'gemini-2.5-pro' }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Atualizar API para receber provider/model explicitamente ou via config runtime.

Critérios de aceite:

- Repo consumidor consegue escolher provider por `vars.ALEX_PROVIDER`.
- Ausencia de chave do provider ativo falha com mensagem clara.
- Nenhuma chave e impressa em logs.

## Fase 6: Providers Posteriores

Candidatos:

- `anthropic`
- `bedrock`
- `azure-openai`
- `openrouter`

Cada novo provider deve entrar com:

- client dedicado;
- testes unitarios;
- exemplo de env vars;
- documentacao de limites conhecidos.

## Riscos

- O ADK pode limitar suporte real a providers nao-Gemini.
- Modelos diferentes podem variar muito no formato de resposta.
- Custos e rate limits por provider precisam de tratamento especifico.
- Multi-provider aumenta superficie de vazamento de segredos em logs/processos.

## Estimativa

- Fase 1: 0.5 dia
- Fase 2: 1 a 2 dias
- Fase 3: 0.5 dia para decisao e spike
- Fase 4: 1 dia
- Fase 5: 0.5 a 1 dia
- Cada provider adicional: 0.5 a 1 dia

Estimativa para Gemini + OpenAI bem feito: **2 a 4 dias**.

## Fora de Escopo Inicial

- UI para selecao de provider.
- Roteamento automatico por custo/latencia.
- Fallback automatico entre providers.
- Suporte simultaneo a multiplos providers no mesmo review.

