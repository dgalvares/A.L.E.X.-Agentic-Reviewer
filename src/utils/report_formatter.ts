import { FinalReport } from '../schemas/contracts.js';

export function formatReportMarkdown(report: FinalReport, title = 'A.L.E.X Code Review'): string {
  const verdict = verdictPresentation(report.verdict);
  const severitySummary = formatSeveritySummary(report);
  const issueSummary = report.issues.length === 0
    ? '> Nenhum apontamento encontrado.'
    : formatIssuesTable(report);
  const issueDetails = report.issues.length === 0
    ? ''
    : [
        '',
        '<details>',
        '<summary>Ver detalhes dos apontamentos</summary>',
        '',
        report.issues.map(formatIssueDetails).join('\n\n'),
        '',
        '</details>',
      ].join('\n');

  return [
    `## ${verdict.icon} ${title}`,
    '',
    `**Veredito:** ${verdict.label}`,
    `**Apontamentos:** ${report.issues.length}${severitySummary ? ` (${severitySummary})` : ''}`,
    '',
    '### Resumo',
    '',
    report.summary,
    '',
    '### Apontamentos',
    '',
    issueSummary,
    issueDetails,
    '',
    '---',
    `<sub>Gerado pelo A.L.E.X em ${report.timestamp}</sub>`,
  ].join('\n');
}

function verdictPresentation(verdict: FinalReport['verdict']): { icon: string; label: string } {
  if (verdict === 'PASS') return { icon: '✅', label: 'PASS' };
  if (verdict === 'WARN') return { icon: '⚠️', label: 'WARN' };
  return { icon: '❌', label: 'FAIL' };
}

function formatSeveritySummary(report: FinalReport): string {
  const counts = report.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  return ['Blocker', 'Critical', 'Major', 'Minor', 'Info']
    .filter((severity) => counts[severity])
    .map((severity) => `${severity}: ${counts[severity]}`)
    .join(', ');
}

function formatIssuesTable(report: FinalReport): string {
  return [
    '| Severidade | Origem | Local | Mensagem |',
    '| --- | --- | --- | --- |',
    ...report.issues.map((issue) => {
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      return `| ${issue.severity} | ${escapeTableCell(issue.origin)} | \`${escapeTableCell(location)}\` | ${escapeTableCell(shorten(issue.message, 140))} |`;
    }),
  ].join('\n');
}

function formatIssueDetails(issue: FinalReport['issues'][number], index: number): string {
  const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  const snippet = issue.codeSnippet
    ? `\n\n\`\`\`\n${issue.codeSnippet.trim()}\n\`\`\``
    : '';

  return [
    `#### ${index + 1}. ${issue.severity} em \`${location}\``,
    '',
    `**Origem:** ${issue.origin}`,
    '',
    issue.message,
    snippet,
  ].join('\n');
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
