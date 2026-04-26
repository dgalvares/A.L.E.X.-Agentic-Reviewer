import { InMemoryRunner, stringifyContent } from '@google/adk';
import crypto from 'crypto';
import { createRootAgent, CreateRootAgentOpts } from './agent.js';
import { AgentId, DEFAULT_AGENT_IDS } from './agents/catalog.js';
import { getPipelineRetryConfig, getRetryDelayMs, isTransientAgentError, sleepForRetry } from './agents/retry_policy.js';
import { AnalysisPayload } from './schemas/contracts.js';
import { extractCodeMetadata } from './tools/diff_tools.js';

/**
 * ReviewOrchestrator - Fachada para o sistema A.L.E.X
 * Encapsula a complexidade do Runner e Session do ADK.
 */
export interface ReviewOrchestratorOpts {
  /** IDs dos agentes a incluir no pipeline (omitir = comportamento padrão). */
  enabledAgents?: AgentId[];
}

export class ReviewOrchestrator {
  private runner: InMemoryRunner;
  private appName = 'ALEX-Core';
  private activeAgentCount: number;

  constructor(model?: string, opts: ReviewOrchestratorOpts = {}) {
    const agentOpts: CreateRootAgentOpts = {
      enabledAgents: opts.enabledAgents,
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
  async analyze(input: AnalysisPayload) {
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

  private async runPipelineOnce(userId: string, normalizedInput: AnalysisPayload): Promise<string> {
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

    for await (const event of eventStream) {
      if (event.errorCode) {
        throw new AdkPipelineError(event.author, event.errorCode, event.errorMessage);
      }

      const content = stringifyContent(event);
      if (content) lastContent = content;
    }

    if (lastContent) {
      console.log(`[ALEX] Análise finalizada com sucesso. streamId=${normalizedInput.streamId}`);
      return lastContent;
    }

    throw new Error('O pipeline terminou sem gerar conteúdo.');
  }
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
