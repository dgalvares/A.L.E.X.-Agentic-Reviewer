import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReportMarkdown } from '../../dist/utils/report_formatter.js';

test('formatReportMarkdown renders verdict, summary and issues', () => {
  const markdown = formatReportMarkdown({
    streamId: '550e8400-e29b-41d4-a716-446655440000',
    verdict: 'WARN',
    summary: 'Resumo curto.',
    issues: [{
      origin: 'security-auditor',
      severity: 'Minor',
      file: 'src/server.ts',
      line: 10,
      message: 'Mensagem de teste.',
      codeSnippet: 'const ok = true;',
    }],
    timestamp: '2026-04-24T21:00:00.000Z',
  }, 'Titulo');

  assert.match(markdown, /## ⚠️ Titulo/);
  assert.match(markdown, /\*\*Veredito:\*\* WARN/);
  assert.match(markdown, /\| Severidade \| Origem \| Local \| Mensagem \|/);
  assert.match(markdown, /<summary>Ver detalhes dos apontamentos<\/summary>/);
  assert.match(markdown, /src\/server\.ts:10/);
  assert.match(markdown, /const ok = true;/);
});
