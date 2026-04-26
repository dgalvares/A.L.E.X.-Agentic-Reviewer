const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 1_000;
const MAX_CONFIGURED_RETRIES = 5;
const TRANSIENT_STATUS_CODES = new Set(['429', '500', '502', '503', '504']);

function readBoundedInteger(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export function getAgentRetryConfig(): { maxRetries: number; baseDelayMs: number } {
  return {
    maxRetries: readBoundedInteger(process.env.ALEX_AGENT_MAX_RETRIES, DEFAULT_MAX_RETRIES, MAX_CONFIGURED_RETRIES),
    baseDelayMs: readBoundedInteger(process.env.ALEX_AGENT_RETRY_BASE_MS, DEFAULT_BASE_DELAY_MS, 60_000),
  };
}

export function getPipelineRetryConfig(activeAgentCount: number): { maxRetries: number; baseDelayMs: number } {
  const config = getAgentRetryConfig();
  const allowMultiAgentRetry = process.env.ALEX_ALLOW_MULTI_AGENT_PIPELINE_RETRY === 'true';
  if (activeAgentCount > 1 && !allowMultiAgentRetry) {
    return { ...config, maxRetries: 0 };
  }

  return config;
}

export function isTransientAgentError(errorCode?: string, errorMessage?: string): boolean {
  const haystack = `${errorCode || ''} ${errorMessage || ''}`.toLowerCase();
  if (!haystack.trim()) return false;

  if (TRANSIENT_STATUS_CODES.has(String(errorCode))) return true;
  return [
    'too many requests',
    'rate limit',
    'timeout',
    'timed out',
    'temporarily unavailable',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    'internal server error',
    'econnreset',
    'etimedout',
    'fetch failed',
    'socket hang up',
  ].some((pattern) => haystack.includes(pattern));
}

export function getRetryDelayMs(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseDelayMs * 0.25)));
  return exponential + jitter;
}

export function sleepForRetry(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
