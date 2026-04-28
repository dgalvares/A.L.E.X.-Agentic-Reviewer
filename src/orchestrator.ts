import { InMemoryRunner, stringifyContent } from '@google/adk';
import type { GenerateContentResponseUsageMetadata } from '@google/genai';
import crypto from 'crypto';
import { createRootAgent, CreateRootAgentOpts } from './agent.js';
import { AgentId, DEFAULT_AGENT_IDS } from './agents/catalog.js';
import { AgentModelMap } from './agents/agent_parser.js';
import { getPipelineRetryConfig, getRetryDelayMs, isTransientAgentError, sleepForRetry } from './agents/retry_policy.js';
import { AnalysisMode, AnalysisPayload, TokenUsageByAgent, Usage } from './schemas/contracts.js';
import { extractCodeMetadata } from './tools/diff_tools.js';

/**
 * ReviewOrchestrator - Fachada para o sistema A.L.E.X
 * Encapsula a complexidade do Runner e Session do ADK.
 */
export interface ReviewOrchestratorOpts {
  /** IDs dos agentes a incluir no pipeline (omitir = comportamento padrão). */
  enabledAgents?: AgentId[];
  analysisMode?: AnalysisMode;
  /** Override de modelo por agente (CLI/Env). */
  agentModels?: AgentModelMap;
  /** Override de modelo via payload da API (menor prioridade que env vars). */
  payloadAgentModels?: AgentModelMap;
}

export class ReviewOrchestrator {
  private runner: InMemoryRunner;
  private appName = 'ALEX-Core';
  private activeAgentCount: number;

  constructor(model?: string, opts: ReviewOrchestratorOpts = {}) {
    const agentOpts: CreateRootAgentOpts = {
      enabledAgents: opts.enabledAgents,
      analysisMode: opts.analysisMode,
      agentModels: opts.agentModels,
      payloadAgentModels: opts.payloadAgentModels,
    };
    this.activeAgentCount = opts.enabledAgents?.length ?? DEFAULT_AGENT_IDS.length;
    this.runner = new InMemoryRunner({
      agent: createRootAgent(model, agentOpts),
      appName: this.appName
    });
  }

  /**
   * Realiza a análise completa de um diff ou arquivos.
   */
  async analyze(input: AnalysisPayload): Promise<{ content: string; usage?: Usage }> {
    const userId = 'system-client';
    const contentToAnalyze = input.diff || input.sourceCode || '';
    const codeMetadata = extractCodeMetadata(contentToAnalyze);
    const normalizedInput: AnalysisPayload = {
      ...input,
      streamId: input.streamId || crypto.randomUUID(),
      metadata: {
        ...input.metadata,
        stack: codeMetadata.detectedStack,
        project: input.metadata?.project || 'local-workspace',
        filesAffected: codeMetadata.filesCount,
      },
    };
    
    console.log(`[ALEX] Iniciando análise da transação: ${normalizedInput.streamId}`);

    const { maxRetries, baseDelayMs } = getPipelineRetryConfig(this.activeAgentCount);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.runPipelineOnce(userId, normalizedInput);
      } catch (error: unknown) {
        if (!isRetryablePipelineError(error) || attempt >= maxRetries) {
          throw error;
        }

        const delayMs = getRetryDelayMs(attempt + 1, baseDelayMs);
        console.warn(`[ALEX] Falha transitória no pipeline ${normalizedInput.streamId}; retry ${attempt + 1}/${maxRetries} em ${delayMs}ms. ${getErrorMessage(error)}`);
        await sleepForRetry(delayMs);
      }
    }

    throw new Error('O pipeline terminou sem gerar conteúdo.');
  }

  private async runPipelineOnce(userId: string, normalizedInput: AnalysisPayload): Promise<{ content: string; usage?: Usage }> {
    const session = await this.runner.sessionService.createSession({
      appName: this.appName,
      userId: userId
    });

    const eventStream = this.runner.runAsync({
      userId: userId,
      sessionId: session.id,
      newMessage: {
        role: 'user',
        parts: [{ text: JSON.stringify(normalizedInput) }]
      }
    });

    let lastContent: string | null = null;
    // Acumula tokens por agente (author). Um agente pode ser invocado múltiplas vezes.
    const usagePerAgent = new Map<string, GenerateContentResponseUsageMetadata>();

    for await (const event of eventStream) {
      if (event.errorCode) {
        throw new AdkPipelineError(event.author, event.errorCode, event.errorMessage);
      }

      // Acumula usageMetadata emitida pelo ADK para cada agente
      if (event.usageMetadata && event.author) {
        const prev = usagePerAgent.get(event.author);
        if (prev) {
          usagePerAgent.set(event.author, mergeUsageMetadata(prev, event.usageMetadata));
        } else {
          usagePerAgent.set(event.author, { ...event.usageMetadata });
        }
      }

      const content = stringifyContent(event);
      if (content) lastContent = content;
    }

    if (lastContent) {
      console.log(`[ALEX] Análise finalizada com sucesso. streamId=${normalizedInput.streamId}`);
      return { content: lastContent, usage: buildUsage(usagePerAgent) };
    }

    throw new Error('O pipeline terminou sem gerar conteúdo.');
  }
}

// ---------------------------------------------------------------------------
// Token Usage helpers
// ---------------------------------------------------------------------------

/**
 * Soma dois objetos de usageMetadata (para sumarizar múltiplos eventos do mesmo agente).
 */
function mergeUsageMetadata(
  a: GenerateContentResponseUsageMetadata,
  b: GenerateContentResponseUsageMetadata,
): GenerateContentResponseUsageMetadata {
  return {
    promptTokenCount: (a.promptTokenCount ?? 0) + (b.promptTokenCount ?? 0),
    candidatesTokenCount: (a.candidatesTokenCount ?? 0) + (b.candidatesTokenCount ?? 0),
    totalTokenCount: (a.totalTokenCount ?? 0) + (b.totalTokenCount ?? 0),
    thoughtsTokenCount: (a.thoughtsTokenCount ?? 0) + (b.thoughtsTokenCount ?? 0),
    cachedContentTokenCount: (a.cachedContentTokenCount ?? 0) + (b.cachedContentTokenCount ?? 0),
  };
}

/**
 * Constrói o objeto `Usage` do contrato a partir do mapa interno de tokens por agente.
 * Retorna `undefined` quando nenhum evento trouxe usageMetadata (ex: modelos que não reportam).
 */
function buildUsage(usagePerAgent: Map<string, GenerateContentResponseUsageMetadata>): Usage | undefined {
  if (usagePerAgent.size === 0) return undefined;

  const byAgent: TokenUsageByAgent[] = [];
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalAll = 0;
  let totalThoughts = 0;
  let totalCached = 0;

  for (const [agent, meta] of usagePerAgent) {
    const prompt = meta.promptTokenCount ?? 0;
    const completion = meta.candidatesTokenCount ?? 0;
    const total = meta.totalTokenCount ?? (prompt + completion);
    const thoughts = meta.thoughtsTokenCount ?? 0;
    const cached = meta.cachedContentTokenCount ?? 0;

    totalPrompt += prompt;
    totalCompletion += completion;
    totalAll += total;
    totalThoughts += thoughts;
    totalCached += cached;

    byAgent.push({
      agent,
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
      ...(thoughts > 0 ? { thoughtsTokens: thoughts } : {}),
      ...(cached > 0 ? { cachedTokens: cached } : {}),
    });
  }

  return {
    promptTokens: totalPrompt,
    completionTokens: totalCompletion,
    totalTokens: totalAll,
    ...(totalThoughts > 0 ? { thoughtsTokens: totalThoughts } : {}),
    ...(totalCached > 0 ? { cachedTokens: totalCached } : {}),
    byAgent,
  };
}

export class AdkPipelineError extends Error {
  constructor(
    readonly author: string | undefined,
    readonly errorCode: string,
    readonly errorMessage: string | undefined,
  ) {
    super(`[ADK Error] Author: ${author} | Code: ${errorCode} | Msg: ${errorMessage}`);
    this.name = 'AdkPipelineError';
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isRetryablePipelineError(error: unknown): boolean {
  if (error instanceof AdkPipelineError) {
    return isTransientAgentError(error.errorCode, error.errorMessage);
  }

  return error instanceof Error && isTransientAgentError(undefined, error.message);
}
