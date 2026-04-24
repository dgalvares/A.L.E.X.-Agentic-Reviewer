/**
 * Utility to safely extract and parse JSON objects from LLM text responses.
 * Uses a single pass over the response to avoid regex backtracking and retry
 * loops over nested brace sequences.
 */
export function extractAndParseJSON(rawResult: string): unknown {
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < rawResult.length; index++) {
    const char = rawResult[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      if (depth > 0) inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) startIndex = index;
      depth++;
      continue;
    }

    if (char !== '}' || depth === 0) {
      continue;
    }

    depth--;
    if (depth !== 0 || startIndex === -1) {
      continue;
    }

    const candidate = rawResult.slice(startIndex, index + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      startIndex = -1;
    }
  }

  throw new Error('Objeto JSON valido nao encontrado na resposta.');
}
