import { z } from 'zod';

export const MAX_ANALYSIS_CONTENT_LENGTH = 10 * 1024 * 1024;
export const MAX_AGENT_PROFILE_ITEMS = 32;
export const MAX_AGENT_PROFILE_ITEM_LENGTH = 100;
const AgentProfileItemSchema = z.string().max(MAX_AGENT_PROFILE_ITEM_LENGTH);

export const AnalysisModeSchema = z.enum(['DIFF_ONLY', 'DIFF_WITH_CONTEXT', 'FULL_FILE'])
  .describe('Escopo da analise: somente diff, diff com arquivos completos apenas como contexto, ou arquivo/contexto completo como alvo.');

/**
 * Severidade dos apontamentos seguindo a regra 4 do workspace.
 */
export const SeveritySchema = z.enum(['Blocker', 'Critical', 'Major', 'Minor', 'Info'])
  .describe('Nível de severidade do problema identificado.');

/**
 * Estrutura de um problema individual identificado por um agente especialista.
 */
export const AnalysisIssueSchema = z.object({
  origin: z.string().describe('Identificação do agente que gerou o apontamento (ex: security-agent).'),
  severity: SeveritySchema,
  line: z.number().optional().describe('Linha aproximada no arquivo onde o problema foi detectado.'),
  file: z.string().describe('Caminho do arquivo analisado.'),
  message: z.string().describe('Descrição detalhada do problema e recomendação de correção.'),
  codeSnippet: z.string().optional().describe('Trecho de código relacionado ao problema.'),
});

/**
 * Payload de entrada para uma análise de código.
 */
export const AnalysisPayloadSchema = z.object({
  streamId: z.string().uuid().optional().describe('ID único da transação de análise. Quando ausente, a API gera um UUID.'),
  metadata: z.object({
    stack: z.string().optional().describe('Stack tecnológica (ex: .net, react, node).'),
    project: z.string().optional().describe('Nome do projeto ou micro-serviço.'),
    model: z.string().optional().describe('Modelo LLM opcional para esta requisição.'),
    agents: z.array(AgentProfileItemSchema).max(MAX_AGENT_PROFILE_ITEMS).optional().describe('IDs de agentes habilitados para esta requisicao.'),
    disabledAgents: z.array(AgentProfileItemSchema).max(MAX_AGENT_PROFILE_ITEMS).optional().describe('IDs de agentes removidos do conjunto final para esta requisicao.'),
    analysisMode: AnalysisModeSchema.optional().describe('Controla se achados ficam restritos ao diff ou podem usar o arquivo/contexto completo como alvo.'),
    filesAffected: z.number().optional().describe('Número de arquivos afetados, preenchido pelo orquestrador.'),
    agentModels: z.record(z.string(), z.string()).optional().describe('Override de modelo por agente. Ex: { "security-auditor": "gemini-2.0-flash" }. Menor prioridade que env vars e CLI.'),
  }).optional().describe('Metadados do projeto. Quando ausente, a API usa valores padrão.'),
  diff: z.string().max(MAX_ANALYSIS_CONTENT_LENGTH).optional().describe('Conteúdo do diff do Git a ser analisado.'),
  sourceCode: z.string().max(MAX_ANALYSIS_CONTENT_LENGTH).optional().describe('Conteúdo completo de um ou mais arquivos a serem analisados.'),
  contextUrls: z.array(z.string().url()).optional().describe('URLs opcionais para RAG de documentação.'),
}).refine(data => data.diff || data.sourceCode, {
  message: "O payload deve conter pelo menos 'diff' ou 'sourceCode'.",
});

/**
 * Custo em tokens de um agente individual do pipeline.
 */
export const TokenUsageByAgentSchema = z.object({
  agent: z.string().describe('Nome/ID do agente que consumiu os tokens.'),
  promptTokens: z.number().int().nonnegative().describe('Tokens de prompt enviados ao modelo.'),
  completionTokens: z.number().int().nonnegative().describe('Tokens gerados pelo modelo (candidatesTokenCount).'),
  totalTokens: z.number().int().nonnegative().describe('Total de tokens consumidos pelo agente nesta invocação.'),
  thoughtsTokens: z.number().int().nonnegative().optional().describe('Tokens de raciocínio interno (thinking), se aplicável.'),
  cachedTokens: z.number().int().nonnegative().optional().describe('Tokens servidos do cache de contexto.'),
});

/**
 * Custo total em tokens do review, agregando todos os agentes do pipeline.
 */
export const UsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().describe('Total de tokens de prompt em todo o pipeline.'),
  completionTokens: z.number().int().nonnegative().describe('Total de tokens de completion em todo o pipeline.'),
  totalTokens: z.number().int().nonnegative().describe('Total geral de tokens consumidos no review.'),
  thoughtsTokens: z.number().int().nonnegative().optional().describe('Total de tokens de thinking em todo o pipeline.'),
  cachedTokens: z.number().int().nonnegative().optional().describe('Total de tokens servidos de cache em todo o pipeline.'),
  byAgent: z.array(TokenUsageByAgentSchema).describe('Breakdown de tokens por agente participante do pipeline.'),
});

/**
 * Relatório final consolidado pelo Orquestrador (The Architect).
 */
export const FinalReportSchema = z.object({
  streamId: z.string().uuid(),
  verdict: z.enum(['PASS', 'FAIL', 'WARN']).describe('Veredito final da análise baseada no consenso e hierarquia de prioridades.'),
  summary: z.string().describe('Resumo executivo consolidado para o desenvolvedor.'),
  issues: z.array(AnalysisIssueSchema).describe('Lista completa de problemas validados e consolidados.'),
  timestamp: z.string().datetime().describe('Data e hora da finalização do relatório.'),
  usage: UsageSchema.optional().describe('Custo em tokens do review. Presente apenas quando o ADK reportar usageMetadata.'),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;
export type AnalysisIssue = z.infer<typeof AnalysisIssueSchema>;
export type AnalysisPayload = z.infer<typeof AnalysisPayloadSchema>;
export type FinalReport = z.infer<typeof FinalReportSchema>;
export type TokenUsageByAgent = z.infer<typeof TokenUsageByAgentSchema>;
export type Usage = z.infer<typeof UsageSchema>;
