import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AnalysisPayloadSchema,
  FinalReportSchema,
  MAX_ANALYSIS_CONTENT_LENGTH,
  MAX_AGENT_PROFILE_ITEMS,
  MAX_AGENT_PROFILE_ITEM_LENGTH,
} from '../../dist/schemas/contracts.js';

test('AnalysisPayloadSchema accepts API payload without streamId or metadata', () => {
  const validation = AnalysisPayloadSchema.safeParse({
    diff: 'diff --git a/a.ts b/a.ts',
  });

  assert.equal(validation.success, true);
});

test('AnalysisPayloadSchema accepts dynamic agent profile metadata', () => {
  const validation = AnalysisPayloadSchema.safeParse({
    metadata: {
      agents: ['default', 'test-strategist'],
      disabledAgents: ['docs-maintainer'],
    },
    diff: 'diff --git a/a.ts b/a.ts',
  });

  assert.equal(validation.success, true);
});

test('AnalysisPayloadSchema rejects payloads without diff or sourceCode', () => {
  const validation = AnalysisPayloadSchema.safeParse({
    metadata: { stack: 'TypeScript', project: 'ALEX' },
  });

  assert.equal(validation.success, false);
});

test('AnalysisPayloadSchema rejects oversized analysis content', () => {
  const validation = AnalysisPayloadSchema.safeParse({
    diff: 'a'.repeat(MAX_ANALYSIS_CONTENT_LENGTH + 1),
  });

  assert.equal(validation.success, false);
});

test('AnalysisPayloadSchema rejects oversized agent profile arrays', () => {
  const validation = AnalysisPayloadSchema.safeParse({
    metadata: {
      agents: Array.from({ length: MAX_AGENT_PROFILE_ITEMS + 1 }, () => 'clean-coder'),
    },
    diff: 'diff --git a/a.ts b/a.ts',
  });

  assert.equal(validation.success, false);
});

test('AnalysisPayloadSchema rejects oversized agent profile items', () => {
  const validation = AnalysisPayloadSchema.safeParse({
    metadata: {
      agents: ['a'.repeat(MAX_AGENT_PROFILE_ITEM_LENGTH + 1)],
    },
    diff: 'diff --git a/a.ts b/a.ts',
  });

  assert.equal(validation.success, false);
});

test('FinalReportSchema validates the final report contract', () => {
  const validation = FinalReportSchema.safeParse({
    streamId: '550e8400-e29b-41d4-a716-446655440000',
    verdict: 'WARN',
    summary: 'Ha pontos de atencao.',
    issues: [{
      origin: 'security-auditor',
      severity: 'Minor',
      file: 'src/server.ts',
      message: 'Mensagem de teste.',
    }],
    timestamp: '2026-04-24T19:00:00.000Z',
  });

  assert.equal(validation.success, true);
});
