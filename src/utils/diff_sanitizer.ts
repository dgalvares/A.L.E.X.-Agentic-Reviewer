import { isBlockedSensitivePath } from './sensitive_paths.js';

const SECRET_VALUE_PATTERN = /(api[_-]?key|token|secret|password|passwd|pwd|private[_-]?key|credential|authorization|bearer)\s*[:=]\s*['"]?[^'"\s]+/i;

export function sanitizeDiff(diffContent: string): string {
  const sanitizedLines: string[] = [];
  let currentFileSensitive = false;
  let redactedCurrentFile = false;

  for (const line of diffContent.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      currentFileSensitive = isSensitiveDiffHeader(line);
      redactedCurrentFile = false;
      sanitizedLines.push(line);
      continue;
    }

    if (currentFileSensitive) {
      if (isDiffMetadataLine(line)) {
        sanitizedLines.push(line);
      } else if (!redactedCurrentFile) {
        sanitizedLines.push('[ALEX REDACTED] Diff content omitted for a sensitive file.');
        redactedCurrentFile = true;
      }
      continue;
    }

    sanitizedLines.push(sanitizeDiffLine(line));
  }

  return sanitizedLines.join('\n');
}

function isSensitiveDiffHeader(line: string): boolean {
  return line.split(/\s+/).slice(2).some(part => {
    const normalizedPath = part.replace(/^a\//, '').replace(/^b\//, '');
    return isBlockedSensitivePath(normalizedPath);
  });
}

function isDiffMetadataLine(line: string): boolean {
  return line.startsWith('diff --git ') ||
    line.startsWith('index ') ||
    line.startsWith('--- ') ||
    line.startsWith('+++ ') ||
    line.startsWith('@@ ');
}

function sanitizeDiffLine(line: string): string {
  if (!line.startsWith('+') && !line.startsWith('-')) {
    return line;
  }

  return SECRET_VALUE_PATTERN.test(line)
    ? `${line[0]}[ALEX REDACTED] possible secret value`
    : line;
}
