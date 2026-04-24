export const FALLBACK_MODEL = 'gemini-2.5-pro';

export function getDefaultModel(): string {
  return process.env.ALEX_MODEL || FALLBACK_MODEL;
}
