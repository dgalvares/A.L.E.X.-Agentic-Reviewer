import { LlmAgent, ParallelAgent, SequentialAgent } from '@google/adk';
import { Schema, Type } from '@google/genai';
import { getSecurityAuditor, getCleanCoder, getSreAgent, getBusinessProxy, getSecurityReviewer, getPerformanceReviewer } from './agents/specialists.js';
import { getDefaultModel } from './config.js';

const finalReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    streamId: { type: Type.STRING, description: 'ID único da transação de análise recebida.' },
    verdict: {
      type: Type.STRING,
      description: 'Veredito final da análise baseada no consenso e hierarquia de prioridades. Valores permitidos: PASS, FAIL, WARN',
      enum: ['PASS', 'FAIL', 'WARN']
    },
    summary: {
      type: Type.STRING,
      description: 'Resumo executivo consolidado para o desenvolvedor.'
    },
    issues: {
      type: Type.ARRAY,
      description: 'Lista completa de problemas validados e consolidados.',
      items: {
        type: Type.OBJECT,
        properties: {
          origin: { type: Type.STRING, description: 'Identificação do agente que gerou o apontamento (ex: security-agent).' },
          severity: { type: Type.STRING, description: 'Nível de severidade.', enum: ['Blocker', 'Critical', 'Major', 'Minor', 'Info'] },
          line: { type: Type.INTEGER, description: 'Linha aproximada no arquivo.' },
          file: { type: Type.STRING, description: 'Caminho do arquivo.' },
          message: { type: Type.STRING, description: 'Descrição detalhada e recomendação.' },
          codeSnippet: { type: Type.STRING, description: 'Trecho de código relacionado.' }
        },
        required: ['origin', 'severity', 'file', 'message']
      }
    },
    timestamp: {
      type: Type.STRING,
      description: 'Data e hora da finalização do relatório (formato ISO 8601).'
    }
  },
  required: ['streamId', 'verdict', 'summary', 'issues', 'timestamp']
};

export const createRootAgent = (model: string = getDefaultModel()) => {
  /**
   * 1. Definindo o Conselho de Especialistas (Execução Paralela)
   */
  const councilParallel = new ParallelAgent({
    name: 'council-parallel',
    description: 'Executa a análise de todos os especialistas simultaneamente.',
    subAgents: [getSecurityAuditor(model), getCleanCoder(model), getSreAgent(model), getBusinessProxy(model)],
  });

  /**
   * 2. Fase de Reflexão (Cross-Review Paralelo)
   */
  const reflectionParallel = new ParallelAgent({
    name: 'reflection-parallel',
    description: 'Especialistas revisam os achados uns dos outros.',
    subAgents: [getSecurityReviewer(model), getPerformanceReviewer(model)],
  });

  /**
   * 3. Agente de Consolidação (The Architect)
   */
  const consolidator = new LlmAgent({
    name: 'architect-consolidator',
    model: model,
    description: 'Consolida o relatório final.',
    instruction: `Você é o "Architect". Sua missão é consolidar o relatório final em JSON estrito.
Analise os achados iniciais e as críticas da fase de reflexão injetados abaixo.
Resolva conflitos e emita o veredito (PASS, FAIL, WARN). Se houver apontamentos com severidade Blocker, o veredito deve ser FAIL.

**Resultados do Conselho Paralelo:**
- Segurança: {security_findings?}
- Qualidade: {quality_findings?}
- Performance: {performance_findings?}
- Negócios: {business_findings?}

**Resultados da Reflexão (Críticas):**
- Revisão de Segurança: {security_critique?}
- Revisão de Performance: {performance_critique?}
`,
    outputSchema: finalReportSchema,
  });

  /**
   * 4. Pipeline Principal
   * Triage -> Parallel Analysis -> Reflection -> Consolidation
   */
  return new SequentialAgent({
    name: 'alex-orchestrator-pipeline',
    description: 'Workflow completo com reflexão do A.L.E.X.',
    subAgents: [councilParallel, reflectionParallel, consolidator],
  });
};
