/**
 * Utility to safely extract and parse JSON objects from LLM text responses.
 * Avoids ReDoS and large memory footprints from heavy regex.
 */
export function extractAndParseJSON(rawResult: string): any {
  const startIndex = rawResult.indexOf('{');
  const endIndex = rawResult.lastIndexOf('}');
  
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Limites do objeto JSON não encontrados na resposta.');
  }
  
  const cleanedJSON = rawResult.substring(startIndex, endIndex + 1);
  return JSON.parse(cleanedJSON);
}
