import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('user config stores API key and model under the user home', async () => {
  const originalHome = process.env.USERPROFILE;
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalModel = process.env.ALEX_MODEL;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-home-'));

  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ALEX_MODEL;
    process.env.USERPROFILE = tempHome;

    const configModule = await import(`../../dist/config.js?case=${Date.now()}`);
    configModule.updateUserConfig({
      geminiApiKey: 'test-key',
      model: 'gemini-test-model',
    });

    assert.equal(configModule.getGeminiApiKey(), 'test-key');
    assert.equal(configModule.getDefaultModel(), 'gemini-test-model');
    assert.equal(fs.existsSync(configModule.getConfigPath()), true);
  } finally {
    if (originalHome === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalHome;
    }
    if (originalGemini === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGemini;
    }
    if (originalModel === undefined) {
      delete process.env.ALEX_MODEL;
    } else {
      process.env.ALEX_MODEL = originalModel;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
