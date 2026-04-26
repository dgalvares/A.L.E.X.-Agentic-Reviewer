import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdkPipelineError,
  ReviewOrchestrator,
  isRetryablePipelineError,
} from '../../dist/orchestrator.js';

test('isRetryablePipelineError treats transient ADK provider failures as retryable', () => {
  assert.equal(isRetryablePipelineError(new AdkPipelineError('business-proxy', '502', 'Bad Gateway')), true);
  assert.equal(isRetryablePipelineError(new AdkPipelineError('business-proxy', 'UNKNOWN_ERROR', 'fetch failed')), true);
});

test('isRetryablePipelineError does not retry contract or payload failures', () => {
  assert.equal(isRetryablePipelineError(new AdkPipelineError('business-proxy', '400', 'Invalid request')), false);
  assert.equal(isRetryablePipelineError(new Error('Contrato de resposta invalido')), false);
});

test('ReviewOrchestrator retries transient pipeline failures for single-agent profiles', async () => {
  const originalRetries = process.env.ALEX_AGENT_MAX_RETRIES;
  const originalBase = process.env.ALEX_AGENT_RETRY_BASE_MS;

  try {
    process.env.ALEX_AGENT_MAX_RETRIES = '1';
    process.env.ALEX_AGENT_RETRY_BASE_MS = '0';

    const orchestrator = new ReviewOrchestrator('test-model', {
      enabledAgents: ['security-auditor'],
    });
    let attempts = 0;
    orchestrator.runPipelineOnce = async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new AdkPipelineError('security-auditor', '502', 'Bad Gateway');
      }
      return JSON.stringify({
        streamId: '550e8400-e29b-41d4-a716-446655440000',
        verdict: 'PASS',
        summary: 'ok',
        issues: [],
        timestamp: '2026-04-24T19:00:00.000Z',
      });
    };

    const result = await orchestrator.analyze({
      streamId: '550e8400-e29b-41d4-a716-446655440000',
      diff: 'diff --git a/a.ts b/a.ts',
    });

    assert.equal(attempts, 2);
    assert.match(result, /"verdict":"PASS"/);
  } finally {
    if (originalRetries === undefined) {
      delete process.env.ALEX_AGENT_MAX_RETRIES;
    } else {
      process.env.ALEX_AGENT_MAX_RETRIES = originalRetries;
    }
    if (originalBase === undefined) {
      delete process.env.ALEX_AGENT_RETRY_BASE_MS;
    } else {
      process.env.ALEX_AGENT_RETRY_BASE_MS = originalBase;
    }
  }
});
