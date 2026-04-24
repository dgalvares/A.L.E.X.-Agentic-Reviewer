import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAndParseJSON } from '../../dist/utils/parser.js';

test('extractAndParseJSON parses a clean JSON object', () => {
  assert.deepEqual(extractAndParseJSON('{"verdict":"PASS","issues":[]}'), {
    verdict: 'PASS',
    issues: [],
  });
});

test('extractAndParseJSON extracts JSON from surrounding LLM text', () => {
  const raw = 'Aqui esta:\n```json\n{"summary":"ok","nested":{"value":"{literal}"}}\n```';

  assert.deepEqual(extractAndParseJSON(raw), {
    summary: 'ok',
    nested: { value: '{literal}' },
  });
});

test('extractAndParseJSON skips invalid brace blocks and parses the first valid object', () => {
  const raw = 'ruido {nao-json} depois {"valid":true}';

  assert.deepEqual(extractAndParseJSON(raw), { valid: true });
});

test('extractAndParseJSON skips invalid balanced blocks without retrying inside them', () => {
  const raw = `prefix {"invalid": } {"valid":true}`;

  assert.deepEqual(extractAndParseJSON(raw), { valid: true });
});

test('extractAndParseJSON throws when no valid JSON object exists', () => {
  assert.throws(() => extractAndParseJSON('sem objeto valido'), /JSON valido/);
});
