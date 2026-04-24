import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLocalRules } from '../../dist/tools/rag_tools.js';

test('readLocalRules reads markdown and text files under .agents', async () => {
  const restoreCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-rag-'));

  try {
    fs.mkdirSync(path.join(tempDir, '.agents', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.agents', 'rules.md'), 'Regra de seguranca');
    fs.writeFileSync(path.join(tempDir, '.agents', 'nested', 'domain.txt'), 'Regra de dominio');
    fs.mkdirSync(path.join(tempDir, '.agents', 'dist'));
    fs.writeFileSync(path.join(tempDir, '.agents', 'dist', 'ignored.md'), 'Nao deve aparecer');

    process.chdir(tempDir);
    const result = await readLocalRules();

    assert.match(result, /rules\.md/);
    assert.match(result, /nested/);
    assert.match(result, /Regra de dominio/);
    assert.doesNotMatch(result, /Nao deve aparecer/);
  } finally {
    process.chdir(restoreCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readLocalRules filters results by query', async () => {
  const restoreCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-rag-'));

  try {
    fs.mkdirSync(path.join(tempDir, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.agents', 'security.md'), 'OAuth obrigatorio');
    fs.writeFileSync(path.join(tempDir, '.agents', 'style.md'), 'Nomes claros');

    process.chdir(tempDir);
    const result = await readLocalRules('oauth');

    assert.match(result, /security\.md/);
    assert.doesNotMatch(result, /style\.md/);
  } finally {
    process.chdir(restoreCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
