import { LlmAgent } from '@google/adk';
import {
  getSecurityAuditor,
  getCleanCoder,
  getSreAgent,
  getBusinessProxy,
  getErrorHandlingSpecialist,
  getTestStrategist,
  getObservabilityEngineer,
  getDocsMaintainer,
  getScalabilityArchitect,
  getSecurityReviewer,
  getPerformanceReviewer,
} from './specialists.js';

export type AgentId =
  | 'security-auditor'
  | 'clean-coder'
  | 'sre-agent'
  | 'business-proxy'
  | 'error-handling-specialist'
  | 'test-strategist'
  | 'observability-engineer'
  | 'docs-maintainer'
  | 'scalability-architect';

export type ReviewerId =
  | 'security-reviewer'
  | 'performance-reviewer';

export interface AgentDefinition {
  id: AgentId;
  label: string;
  defaultEnabled: boolean;
  outputKey: string;
  factory: (model: string) => LlmAgent;
}

export interface ReviewerDefinition {
  id: ReviewerId;
  label: string;
  outputKey: string;
  requiresAgentIds: ReadonlyArray<AgentId>;
  factory: (model: string) => LlmAgent;
}

export const AGENT_CATALOG: ReadonlyArray<AgentDefinition> = [
  {
    id: 'security-auditor',
    label: 'Seguranca',
    defaultEnabled: true,
    outputKey: 'security_findings',
    factory: getSecurityAuditor,
  },
  {
    id: 'clean-coder',
    label: 'Qualidade',
    defaultEnabled: true,
    outputKey: 'quality_findings',
    factory: getCleanCoder,
  },
  {
    id: 'sre-agent',
    label: 'Performance',
    defaultEnabled: true,
    outputKey: 'performance_findings',
    factory: getSreAgent,
  },
  {
    id: 'business-proxy',
    label: 'Negocios',
    defaultEnabled: true,
    outputKey: 'business_findings',
    factory: getBusinessProxy,
  },
  {
    id: 'error-handling-specialist',
    label: 'Tratamento de Erros',
    defaultEnabled: false,
    outputKey: 'error_handling_findings',
    factory: getErrorHandlingSpecialist,
  },
  {
    id: 'test-strategist',
    label: 'Testes',
    defaultEnabled: false,
    outputKey: 'test_findings',
    factory: getTestStrategist,
  },
  {
    id: 'observability-engineer',
    label: 'Observabilidade',
    defaultEnabled: false,
    outputKey: 'observability_findings',
    factory: getObservabilityEngineer,
  },
  {
    id: 'docs-maintainer',
    label: 'Documentacao',
    defaultEnabled: false,
    outputKey: 'docs_findings',
    factory: getDocsMaintainer,
  },
  {
    id: 'scalability-architect',
    label: 'Escalabilidade',
    defaultEnabled: false,
    outputKey: 'scalability_findings',
    factory: getScalabilityArchitect,
  },
] as const;

export const REVIEWER_CATALOG: ReadonlyArray<ReviewerDefinition> = [
  {
    id: 'security-reviewer',
    label: 'Revisao de Seguranca',
    outputKey: 'security_critique',
    requiresAgentIds: ['sre-agent', 'clean-coder'],
    factory: getSecurityReviewer,
  },
  {
    id: 'performance-reviewer',
    label: 'Revisao de Performance',
    outputKey: 'performance_critique',
    requiresAgentIds: ['security-auditor', 'clean-coder'],
    factory: getPerformanceReviewer,
  },
] as const;

export const DEFAULT_AGENT_IDS: ReadonlyArray<AgentId> = AGENT_CATALOG
  .filter((a) => a.defaultEnabled)
  .map((a) => a.id);

export const ALL_AGENT_IDS: ReadonlyArray<AgentId> = AGENT_CATALOG
  .map((a) => a.id);

export const AGENT_BY_ID: ReadonlyMap<AgentId, AgentDefinition> = new Map(
  AGENT_CATALOG.map((a) => [a.id, a]),
);

export const VALID_AGENT_IDS: ReadonlySet<string> = new Set(
  AGENT_CATALOG.map((a) => a.id),
);
