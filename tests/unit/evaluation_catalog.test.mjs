import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AGENT_CATALOG, REVIEWER_CATALOG } from '../../dist/agents/catalog.js';

test('every catalog entry has an evaluation fixture', () => {
  const ids = [
    ...AGENT_CATALOG.map((agent) => agent.id),
    ...REVIEWER_CATALOG.map((reviewer) => reviewer.id),
  ];

  for (const id of ids) {
    const filePath = path.join('tests', 'evaluation', `${id}.test.json`);
    assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);

    const fixture = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(fixture.id, id);
    assert.ok(Array.isArray(fixture.cases));
    assert.ok(fixture.cases.length > 0);
  }
});
