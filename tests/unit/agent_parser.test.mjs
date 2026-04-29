import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_AGENT_IDS,
  DEFAULT_AGENT_IDS,
} from '../../dist/agents/catalog.js';
import {
  resolveAgentIds,
  agentIdToEnvKey,
  resolveModelForAgent,
  resolveAgentModels,
} from '../../dist/agents/agent_parser.js';
import {
  buildArchitectConsolidatorInstruction,
} from '../../dist/prompts/index.js';
import {
  createRootAgent,
} from '../../dist/agent.js';

test('resolveAgentIds expands default without opt-in agents', () => {
  const resolved = resolveAgentIds({ agents: 'default' });

  assert.deepEqual(resolved, [...DEFAULT_AGENT_IDS]);
  assert.equal(resolved.includes('test-strategist'), false);
});

test('resolveAgentIds supports comma or space separated opt-in agents', () => {
  const resolved = resolveAgentIds({
    agents: 'default test-strategist,error-handling-specialist',
  });

  assert.equal(resolved.includes('test-strategist'), true);
  assert.equal(resolved.includes('error-handling-specialist'), true);
});

test('review command exposes optional profile shortcut', async () => {
  const { execFileSync } = await import('node:child_process');
  const help = execFileSync(process.execPath, ['dist/cli.js', 'review', '--help'], {
    encoding: 'utf8',
  });

  assert.match(help, /review \[options\] \[profile\]/);
  assert.match(help, /--include-context-findings/);
});

test('ci command exposes context findings option', async () => {
  const { execFileSync } = await import('node:child_process');
  const help = execFileSync(process.execPath, ['dist/cli.js', 'ci', '--help'], {
    encoding: 'utf8',
  });

  assert.match(help, /--include-context-findings/);
});

test('resolveAgentIds expands all to every registered agent', () => {
  const resolved = resolveAgentIds({ agents: 'all' });

  assert.deepEqual(resolved, [...ALL_AGENT_IDS]);
  assert.equal(resolved.includes('test-strategist'), true);
  assert.equal(resolved.includes('performance-reviewer'), false);
});

test('resolveAgentIds rejects reviewer ids because users configure only agent catalogs', () => {
  assert.throws(
    () => resolveAgentIds({ agents: 'security-reviewer' }),
    /Agente desconhecido/,
  );
});

test('resolveAgentIds rejects unknown enabled agents', () => {
  assert.throws(
    () => resolveAgentIds({ agents: 'default,missing-agent' }),
    /Agente desconhecido/,
  );
});

test('resolveAgentIds ignores unknown disabled agents for forward-compatible profiles', () => {
  const resolved = resolveAgentIds({
    agents: 'security-auditor',
    disabledAgents: 'future-agent',
  });

  assert.deepEqual(resolved, ['security-auditor']);
});

test('resolveAgentIds removes disabled agents and keeps at least one council agent', () => {
  const resolved = resolveAgentIds({
    agents: 'security-auditor,clean-coder,sre-agent',
    disabledAgents: 'clean-coder',
  });

  assert.deepEqual(resolved, ['security-auditor', 'sre-agent']);
});

test('resolveAgentIds rejects an empty agent profile', () => {
  assert.throws(
    () => resolveAgentIds({ agents: 'security-auditor', disabledAgents: 'security-auditor' }),
    /nenhum agente de analise/,
  );
});

test('buildArchitectConsolidatorInstruction uses only provided output keys', () => {
  const instruction = buildArchitectConsolidatorInstruction(
    '- Testes: {test_findings?}',
    '(fase de reflexao desabilitada)',
  );

  assert.match(instruction, /test_findings/);
  assert.doesNotMatch(instruction, /security_findings/);
  assert.match(instruction, /Modo DIFF_WITH_CONTEXT/);
  assert.match(instruction, /linhas adicionadas, removidas ou modificadas pelo diff/);
});

test('buildArchitectConsolidatorInstruction can target full file context', () => {
  const instruction = buildArchitectConsolidatorInstruction(
    '- Testes: {test_findings?}',
    '(fase de reflexao desabilitada)',
    'FULL_FILE',
  );

  assert.match(instruction, /Modo FULL_FILE/);
  assert.doesNotMatch(instruction, /Use sourceCode apenas como contexto/);
});

test('buildArchitectConsolidatorInstruction supports diff-only mode', () => {
  const instruction = buildArchitectConsolidatorInstruction(
    '- Testes: {test_findings?}',
    '(fase de reflexao desabilitada)',
    'DIFF_ONLY',
  );

  assert.match(instruction, /Modo DIFF_ONLY/);
  assert.match(instruction, /diretamente pelo diff/);
});

test('createRootAgent derives reviewers when their agent dependencies are present', () => {
  const agent = createRootAgent('test-model', {
    enabledAgents: ['security-auditor', 'clean-coder', 'sre-agent'],
  });
  const stageNames = agent.subAgents.flatMap((stage) => [
    stage.name,
    ...(stage.subAgents ?? []).map((subAgent) => subAgent.name),
  ]);

  assert.equal(stageNames.includes('security-reviewer'), true);
  assert.equal(stageNames.includes('performance-reviewer'), true);
});

test('createRootAgent skips reviewers when their agent dependencies are absent', () => {
  const agent = createRootAgent('test-model', {
    enabledAgents: ['security-auditor'],
  });
  const stageNames = agent.subAgents.flatMap((stage) => [
    stage.name,
    ...(stage.subAgents ?? []).map((subAgent) => subAgent.name),
  ]);

  assert.equal(stageNames.includes('security-auditor'), true);
  assert.equal(stageNames.includes('security-reviewer'), false);
  assert.equal(stageNames.includes('performance-reviewer'), false);
});

test('agentIdToEnvKey converts agent IDs to uppercase env keys', () => {
  assert.equal(agentIdToEnvKey('security-auditor'), 'ALEX_MODEL_SECURITY_AUDITOR');
  assert.equal(agentIdToEnvKey('architect-consolidator'), 'ALEX_MODEL_ARCHITECT_CONSOLIDATOR');
});

test('resolveModelForAgent applies precedence: CLI/Env > Payload > Global', () => {
  const globalModel = 'global-pro';
  const payloadModels = new Map([['security-auditor', 'payload-flash']]);

  // 1. Fallback global
  assert.equal(resolveModelForAgent('clean-coder', globalModel, new Map()), globalModel);

  // 2. Payload override
  assert.equal(resolveModelForAgent('security-auditor', globalModel, undefined, payloadModels), 'payload-flash');

  // 3. Env Var override (higher precedence than payload)
  process.env.ALEX_MODEL_SRE_AGENT = 'env-ultra';
  assert.equal(resolveModelForAgent('sre-agent', globalModel, undefined, new Map([['sre-agent', 'payload-ignore']])), 'env-ultra');
  delete process.env.ALEX_MODEL_SRE_AGENT;
});

test('resolveAgentModels parses CLI strings', () => {
  const map = resolveAgentModels('security-auditor:flash-2.0,clean-coder:pro-1.5');
  assert.equal(map.get('security-auditor'), 'flash-2.0');
  assert.equal(map.get('clean-coder'), 'pro-1.5');
});
