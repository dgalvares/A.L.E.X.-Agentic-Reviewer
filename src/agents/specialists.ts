import { LlmAgent } from '@google/adk';
import { searchLocalRules } from '../tools/rag_tools.js';
import {
  SECURITY_AUDITOR_PROMPT,
  CLEAN_CODER_PROMPT,
  SRE_AGENT_PROMPT,
  BUSINESS_PROXY_PROMPT,
  ERROR_HANDLING_SPECIALIST_PROMPT,
  TEST_STRATEGIST_PROMPT,
  OBSERVABILITY_ENGINEER_PROMPT,
  DOCS_MAINTAINER_PROMPT,
  SCALABILITY_ARCHITECT_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT
} from '../prompts/index.js';

/**
 * Agente de Segurança (The Security Auditor)
 */
export const getSecurityAuditor = (model: string) => new LlmAgent({
  name: 'security-auditor',
  model: model,
  description: 'Auditor de segurança focado em vulnerabilidades e conformidade.',
  instruction: SECURITY_AUDITOR_PROMPT,

  outputKey: 'security_findings',
});

/**
 * Agente de Qualidade e Design (The Clean Coder)
 */
export const getCleanCoder = (model: string) => new LlmAgent({
  name: 'clean-coder',
  model: model,
  description: 'Especialista em qualidade de código e padrões de design.',
  instruction: CLEAN_CODER_PROMPT,

  outputKey: 'quality_findings',
});

/**
 * Agente de Performance (The SRE Agent)
 */
export const getSreAgent = (model: string) => new LlmAgent({
  name: 'sre-agent',
  model: model,
  description: 'Analista de performance e eficiência operacional.',
  instruction: SRE_AGENT_PROMPT,

  outputKey: 'performance_findings',
});

/**
 * Agente de Contexto de Negócio (The Business Proxy)
 */
export const getBusinessProxy = (model: string) => new LlmAgent({
  name: 'business-proxy',
  model: model,
  description: 'Validador de regras de negócio e contexto de domínio.',
  instruction: BUSINESS_PROXY_PROMPT,
  tools: [searchLocalRules],
  outputKey: 'business_findings',
});

/**
 * AGENTES DE REFLEXÃO (REVIEWERS)
 */

export const getErrorHandlingSpecialist = (model: string) => new LlmAgent({
  name: 'error-handling-specialist',
  model: model,
  description: 'Especialista em caminhos de erro, resiliencia e falhas seguras.',
  instruction: ERROR_HANDLING_SPECIALIST_PROMPT,
  outputKey: 'error_handling_findings',
});

export const getTestStrategist = (model: string) => new LlmAgent({
  name: 'test-strategist',
  model: model,
  description: 'Especialista em qualidade de testes e cobertura de regressao.',
  instruction: TEST_STRATEGIST_PROMPT,
  outputKey: 'test_findings',
});

export const getObservabilityEngineer = (model: string) => new LlmAgent({
  name: 'observability-engineer',
  model: model,
  description: 'Especialista em logs, metricas, traces e debuggability.',
  instruction: OBSERVABILITY_ENGINEER_PROMPT,
  outputKey: 'observability_findings',
});

export const getDocsMaintainer = (model: string) => new LlmAgent({
  name: 'docs-maintainer',
  model: model,
  description: 'Especialista em documentacao de produto, API e operacao.',
  instruction: DOCS_MAINTAINER_PROMPT,
  outputKey: 'docs_findings',
});

export const getScalabilityArchitect = (model: string) => new LlmAgent({
  name: 'scalability-architect',
  model: model,
  description: 'Especialista em escalabilidade, concorrencia e crescimento de dados.',
  instruction: SCALABILITY_ARCHITECT_PROMPT,
  outputKey: 'scalability_findings',
});

export const getSecurityReviewer = (model: string) => new LlmAgent({
  name: 'security-reviewer',
  model: model,
  description: 'Revisa achados de outros especialistas sob a ótica de segurança.',
  instruction: SECURITY_REVIEWER_PROMPT,
  outputKey: 'security_critique',
});

export const getPerformanceReviewer = (model: string) => new LlmAgent({
  name: 'performance-reviewer',
  model: model,
  description: 'Revisa achados de outros especialistas sob a ótica de performance.',
  instruction: PERFORMANCE_REVIEWER_PROMPT,
  outputKey: 'performance_critique',
});
