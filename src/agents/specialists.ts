import { LlmAgent } from '@google/adk';
import { analyzeDiffMetadata } from '../tools/diff_tools.js';
import { searchLocalRules } from '../tools/rag_tools.js';

/**
 * Agente de Segurança (The Security Auditor)
 */
export const securityAuditor = new LlmAgent({
  name: 'security-auditor',
  model: 'gemini-2.0-flash',
  description: 'Auditor de segurança focado em vulnerabilidades e conformidade.',
  instruction: `Você é o "Security Auditor". Sua responsabilidade é identificar vulnerabilidades.`,
  tools: [analyzeDiffMetadata],
  outputKey: 'security_findings',
});

/**
 * Agente de Qualidade e Design (The Clean Coder)
 */
export const cleanCoder = new LlmAgent({
  name: 'clean-coder',
  model: 'gemini-2.0-flash',
  description: 'Especialista em qualidade de código e padrões de design.',
  instruction: `Você é o "Clean Coder". Sua responsabilidade é garantir a manutenibilidade do código.`,
  tools: [analyzeDiffMetadata],
  outputKey: 'quality_findings',
});

/**
 * Agente de Performance (The SRE Agent)
 */
export const sreAgent = new LlmAgent({
  name: 'sre-agent',
  model: 'gemini-2.0-flash',
  description: 'Analista de performance e eficiência operacional.',
  instruction: `Você é o "SRE Agent". Sua responsabilidade é identificar gargalos de performance.`,
  tools: [analyzeDiffMetadata],
  outputKey: 'performance_findings',
});

/**
 * Agente de Contexto de Negócio (The Business Proxy)
 */
export const businessProxy = new LlmAgent({
  name: 'business-proxy',
  model: 'gemini-2.0-flash',
  description: 'Validador de regras de negócio e contexto de domínio.',
  instruction: `Você é o "Business Proxy". Sua responsabilidade é validar se o código fere regras de negócio.
IMPORTANTE: Sempre utilize a ferramenta "search_local_rules" antes de dar seu veredito, para ler as documentações e garantir aderência às regras corporativas.`,
  tools: [analyzeDiffMetadata, searchLocalRules],
  outputKey: 'business_findings',
});

/**
 * AGENTES DE REFLEXÃO (REVIEWERS)
 */

export const securityReviewer = new LlmAgent({
  name: 'security-reviewer',
  model: 'gemini-2.0-flash',
  description: 'Revisa achados de outros especialistas sob a ótica de segurança.',
  instruction: `Analise os achados anteriores de PERFORMANCE e QUALIDADE presentes no histórico da sessão.
Verifique se alguma otimização introduz brechas de segurança. Levante vetos se necessário.

**Achados Anteriores:**
- Performance: {performance_findings?}
- Qualidade: {quality_findings?}
`,
  outputKey: 'security_critique',
});

export const performanceReviewer = new LlmAgent({
  name: 'performance-reviewer',
  model: 'gemini-2.0-flash',
  description: 'Revisa achados de outros especialistas sob a ótica de performance.',
  instruction: `Analise os achados anteriores de SEGURANÇA e QUALIDADE presentes no histórico da sessão.
Verifique se as correções causam gargalos de performance.

**Achados Anteriores:**
- Segurança: {security_findings?}
- Qualidade: {quality_findings?}
`,
  outputKey: 'performance_critique',
});
