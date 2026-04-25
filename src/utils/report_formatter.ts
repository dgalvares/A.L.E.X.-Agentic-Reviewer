import { FinalReport } from '../schemas/contracts.js';

export function formatReportMarkdown(report: FinalReport, title = 'A.L.E.X Code Review'): string {
  const issues = report.issues.length === 0
    ? 'Nenhum apontamento encontrado.'
    : report.issues.map(formatIssue).join('\n\n');

  return [
    `## ${title}`,
    '',
    `**Veredito:** ${report.verdict}`,
    '',
    '### Resumo',
    '',
    report.summary,
    '',
    '### Apontamentos',
    '',
    issues,
    '',
    '---',
    `Gerado em: ${report.timestamp}`,
  ].join('\n');
}

function formatIssue(issue: FinalReport['issues'][number]): string {
  const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  const snippet = issue.codeSnippet
    ? `\n\n\`\`\`\n${issue.codeSnippet.trim()}\n\`\`\``
    : '';

  return [
    `- **${issue.severity}** em \`${location}\``,
    `  - **Origem:** ${issue.origin}`,
    `  - **Mensagem:** ${issue.message}${snippet}`,
  ].join('\n');
}
