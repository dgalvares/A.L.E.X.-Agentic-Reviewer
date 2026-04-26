import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAgentRetryConfig,
  getPipelineRetryConfig,
  getRetryDelayMs,
  isTransientAgentError,
} from '../../dist/agents/retry_policy.js';

test('isTransientAgentError detects retryable provider failures', () => {
  assert.equal(isTransientAgentError('502', 'Bad Gateway'), true);
  assert.equal(isTransientAgentError('429', 'Too Many Requests'), true);
  assert.equal(isTransientAgentError('UNKNOWN_ERROR', 'socket hang up'), true);
  assert.equal(isTransientAgentError('UNKNOWN_ERROR', 'fetch failed'), true);
  assert.equal(isTransientAgentError('400', 'Invalid request payload'), false);
  assert.equal(isTransientAgentError(undefined, undefined), false);
});

test('getAgentRetryConfig clamps env configuration', async () => {
  const originalRetries = process.env.ALEX_AGENT_MAX_RETRIES;
  const originalBase = process.env.ALEX_AGENT_RETRY_BASE_MS;

  try {
    process.env.ALEX_AGENT_MAX_RETRIES = '99';
    process.env.ALEX_AGENT_RETRY_BASE_MS = '15';

    assert.deepEqual(getAgentRetryConfig(), {
      maxRetries: 5,
      baseDelayMs: 15,
    });
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

test('getRetryDelayMs applies exponential backoff with bounded jitter', () => {
  const delay = getRetryDelayMs(2, 100);

  assert.equal(delay >= 200, true);
  assert.equal(delay < 225, true);
});

test('getPipelineRetryConfig disables retry storms for multi-agent profiles by default', () => {
  const originalRetries = process.env.ALEX_AGENT_MAX_RETRIES;
  const originalAllow = process.env.ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY;

  try {
    process.env.ALEX_AGENT_MAX_RETRIES = '2';
    delete process.env.ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY;

    assert.equal(getPipelineRetryConfig(1).maxRetries, 2);
    assert.equal(getPipelineRetryConfig(4).maxRetries, 0);

    process.env.ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY = 'true';
    assert.equal(getPipelineRetryConfig(4).maxRetries, 2);
  } finally {
    if (originalRetries === undefined) {
      delete process.env.ALEX_AGENT_MAX_RETRIES;
    } else {
      process.env.ALEX_AGENT_MAX_RETRIES = originalRetries;
    }
    if (originalAllow === undefined) {
      delete process.env.ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY;
    } else {
      process.env.ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY = originalAllow;
    }
  }
});
