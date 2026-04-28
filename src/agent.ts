import { LlmAgent, ParallelAgent, SequentialAgent } from '@google/adk';
import { Schema, Type } from '@google/genai';
import { getDefaultModel } from './config.js';
import { AgentId, AGENT_BY_ID, DEFAULT_AGENT_IDS, AgentDefinition, REVIEWER_CATALOG } from './agents/catalog.js';
import { AgentModelMap, resolveModelForAgent } from './agents/agent_parser.js';
import { buildArchitectConsolidatorInstruction } from './prompts/index.js';
import { AnalysisMode } from './schemas/contracts.js';

// ─── Final Report Schema ───────────────────────────────────────────────────────

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

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CreateRootAgentOpts {
  /**
   * IDs dos agentes a incluir no pipeline.
   * Se omitido, usa DEFAULT_AGENT_IDS (comportamento original).
   */
  enabledAgents?: AgentId[];
  analysisMode?: AnalysisMode;
  /** Override de modelo por agente (CLI/Env). */
  agentModels?: AgentModelMap;
  /** Override de modelo via payload da API (menor prioridade que env vars). */
  payloadAgentModels?: AgentModelMap;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createRootAgent = (
  model: string = getDefaultModel(),
  opts: CreateRootAgentOpts = {},
) => {
  const enabledIds = opts.enabledAgents ?? [...DEFAULT_AGENT_IDS];

  // Resolve definições na ordem do catálogo (preserva determinismo)
  const enabledDefs = enabledIds
    .map((id) => AGENT_BY_ID.get(id))
    .filter((def): def is AgentDefinition => def !== undefined);

  const enabledAgentIds = new Set(enabledDefs.map((d) => d.id));
  const reflectionDefs = REVIEWER_CATALOG.filter((reviewer) => (
    reviewer.requiresAgentIds.every((id) => enabledAgentIds.has(id))
  ));

  /**
   * 1. Conselho de Especialistas (Execução Paralela)
   */
  const councilParallel = new ParallelAgent({
    name: 'council-parallel',
    description: 'Executa a análise de todos os especialistas simultaneamente.',
    subAgents: enabledDefs.map((d) => d.factory(
      resolveModelForAgent(d.id, model, opts.agentModels, opts.payloadAgentModels),
    )),
  });

  /**
   * 2. Instrução do Consolidator gerada dinamicamente a partir dos agentes ativos.
   */
  const councilSection = enabledDefs
    .map((d) => `- ${d.label}: {${d.outputKey}?}`)
    .join('\n');

  const reflectionSection = reflectionDefs.length > 0
    ? reflectionDefs.map((d) => `- ${d.label}: {${d.outputKey}?}`).join('\n')
    : '(fase de reflexão desabilitada para este perfil)';

  const consolidatorInstruction = buildArchitectConsolidatorInstruction(
    councilSection,
    reflectionSection,
    opts.analysisMode,
  );

  /**
   * 3. Agente de Consolidação (The Architect)
   */
  const consolidator = new LlmAgent({
    name: 'architect-consolidator',
    model: resolveModelForAgent('architect-consolidator', model, opts.agentModels, opts.payloadAgentModels),
    description: 'Consolida o relatório final.',
    instruction: consolidatorInstruction,
    outputSchema: finalReportSchema,
  });

  /**
   * 4. Pipeline Principal — reflection é incluída apenas se houver reviewers ativos.
   */
  const pipelineStages: (ParallelAgent | LlmAgent)[] = [councilParallel];

  if (reflectionDefs.length > 0) {
    const reflectionParallel = new ParallelAgent({
      name: 'reflection-parallel',
      description: 'Especialistas revisam os achados uns dos outros.',
      subAgents: reflectionDefs.map((d) => d.factory(
        resolveModelForAgent(d.id, model, opts.agentModels, opts.payloadAgentModels),
      )),
    });
    pipelineStages.push(reflectionParallel);
  }

  pipelineStages.push(consolidator);

  return new SequentialAgent({
    name: 'alex-orchestrator-pipeline',
    description: 'Workflow completo com reflexão do A.L.E.X.',
    subAgents: pipelineStages,
  });
};
