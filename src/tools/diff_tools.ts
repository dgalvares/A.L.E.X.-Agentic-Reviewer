/**
 * Helper function para extrair metadados técnicos do código fonte ou diff.
 * Usa parser iterativo com indexOf em vez de split('\n') para evitar criar
 * arrays gigantes na heap com payloads de até 10MB (risco de OOM).
 */
export const extractCodeMetadata = (content: string) => {
  const diffFiles: string[] = [];
  const sourceFiles: string[] = [];

  // Parser O(n) sem alocação de array intermediário: processa linha por linha via indexOf
  let start = 0;
  const len = content.length;
  while (start < len) {
    const end = content.indexOf('\n', start);
    const lineEnd = end === -1 ? len : end;
    const line = content.slice(start, lineEnd);
    start = lineEnd + 1;

    if (line.startsWith('+++ b/')) {
      const filePath = line.slice(6, 6 + 255);
      if (filePath) diffFiles.push(filePath);
    } else if (line.startsWith('=== File: ') && line.endsWith(' ===')) {
      const filePath = line.slice(10, line.length - 4).slice(0, 255);
      if (filePath) sourceFiles.push(filePath);
    }
  }

  const files = [...new Set([...diffFiles, ...sourceFiles])];
  const extensions = new Set(files.map(f => f.split('.').pop()));

  let stack = 'unknown';
  if (extensions.has('cs')) stack = '.NET';
  if (extensions.has('ts') || extensions.has('tsx')) stack = 'TypeScript/React';
  if (extensions.has('py')) stack = 'Python';
  if (extensions.has('java')) stack = 'Java';
  if (extensions.has('js')) stack = 'JavaScript';

  return {
    filesCount: files.length,
    files,
    extensions: Array.from(extensions),
    detectedStack: stack
  };
};
