import { LlmAgent } from '@google/adk';

import { searchLocalRules } from '../tools/rag_tools.js';
import {
  SECURITY_AUDITOR_PROMPT,
  CLEAN_CODER_PROMPT,
  SRE_AGENT_PROMPT,
  BUSINESS_PROXY_PROMPT,
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
