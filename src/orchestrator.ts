import { InMemoryRunner, stringifyContent } from '@google/adk';
import crypto from 'crypto';
import { createRootAgent } from './agent.js';
import { AnalysisPayload } from './schemas/contracts.js';
import { extractCodeMetadata } from './tools/diff_tools.js';

/**
 * ReviewOrchestrator - Fachada para o sistema A.L.E.X
 * Encapsula a complexidade do Runner e Session do ADK.
 */
export class ReviewOrchestrator {
  private runner: InMemoryRunner;
  private appName = 'ALEX-Core';

  constructor(model?: string) {
    // No ADK TS, o construtor recebe um objeto
    this.runner = new InMemoryRunner({
      agent: createRootAgent(model),
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
        stack: codeMetadata.detectedStack,
        project: input.metadata?.project || 'local-workspace',
        model: input.metadata?.model,
        filesAffected: codeMetadata.filesCount,
      },
    };
    
    // 1. Criar uma sessão
    const session = await this.runner.sessionService.createSession({
      appName: this.appName,
      userId: userId
    });

    console.log(`[ALEX] Iniciando análise da transação: ${normalizedInput.streamId}`);

    // 2. Executar o pipeline
    const eventStream = this.runner.runAsync({
      userId: userId,
      sessionId: session.id,
      newMessage: {
        role: 'user',
        parts: [{ text: JSON.stringify(normalizedInput) }]
      }
    });

    // 3. Capturar resultados
    let lastContent: string | null = null;

    for await (const event of eventStream) {
      // Debug
      // console.log('--- EVENT ---', JSON.stringify(event, null, 2));
      
      if (event.errorCode) {
        throw new Error(`[ADK Error] Author: ${event.author} | Code: ${event.errorCode} | Msg: ${event.errorMessage}`);
      }

      const content = stringifyContent(event);
      if (content) {
        lastContent = content;
        // Ocultando console log poluidor de debug se não for final
        // console.log(`[${event.author}] ... ${content.substring(0, 50).replace(/\n/g, ' ')}...`);
      }
    }

    if (lastContent) {
      console.log(`[ALEX] Análise finalizada com sucesso.`);
      return lastContent;
    }

    throw new Error('O pipeline terminou sem gerar conteúdo.');
  }
}
