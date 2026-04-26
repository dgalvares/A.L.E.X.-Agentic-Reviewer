import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('user config stores API key and model under the user home', async () => {
  const originalHome = process.env.USERPROFILE;
  const originalPosixHome = process.env.HOME;
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalModel = process.env.ALEX_MODEL;
  const originalAgents = process.env.ALEX_AGENTS;
  const originalDisabledAgents = process.env.ALEX_DISABLED_AGENTS;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-home-'));

  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ALEX_MODEL;
    delete process.env.ALEX_AGENTS;
    delete process.env.ALEX_DISABLED_AGENTS;
    process.env.USERPROFILE = tempHome;
    process.env.HOME = tempHome;

    const configModule = await import(`../../dist/config.js?case=${Date.now()}`);
    configModule.updateUserConfig({
      geminiApiKey: 'test-key',
      model: 'gemini-test-model',
      agents: 'default,test-strategist',
      disabledAgents: 'docs-maintainer',
    });

    assert.equal(configModule.getGeminiApiKey(), 'test-key');
    assert.equal(configModule.getDefaultModel(), 'gemini-test-model');
    assert.equal(fs.existsSync(configModule.getConfigPath()), true);

    configModule.applyStoredConfigToEnv();
    assert.equal(process.env.ALEX_AGENTS, 'default,test-strategist');
    assert.equal(process.env.ALEX_DISABLED_AGENTS, 'docs-maintainer');
  } finally {
    if (originalHome === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalHome;
    }
    if (originalPosixHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalPosixHome;
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
    if (originalAgents === undefined) {
      delete process.env.ALEX_AGENTS;
    } else {
      process.env.ALEX_AGENTS = originalAgents;
    }
    if (originalDisabledAgents === undefined) {
      delete process.env.ALEX_DISABLED_AGENTS;
    } else {
      process.env.ALEX_DISABLED_AGENTS = originalDisabledAgents;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('stored config does not override explicit empty agent env vars', async () => {
  const originalHome = process.env.USERPROFILE;
  const originalPosixHome = process.env.HOME;
  const originalAgents = process.env.ALEX_AGENTS;
  const originalDisabledAgents = process.env.ALEX_DISABLED_AGENTS;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-home-'));

  try {
    process.env.USERPROFILE = tempHome;
    process.env.HOME = tempHome;
    process.env.ALEX_AGENTS = '';
    process.env.ALEX_DISABLED_AGENTS = '';

    const configModule = await import(`../../dist/config.js?case=empty-${Date.now()}`);
    configModule.updateUserConfig({
      agents: 'all',
      disabledAgents: 'docs-maintainer',
    });
    configModule.applyStoredConfigToEnv();

    assert.equal(process.env.ALEX_AGENTS, '');
    assert.equal(process.env.ALEX_DISABLED_AGENTS, '');
  } finally {
    if (originalHome === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalHome;
    }
    if (originalPosixHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalPosixHome;
    }
    if (originalAgents === undefined) {
      delete process.env.ALEX_AGENTS;
    } else {
      process.env.ALEX_AGENTS = originalAgents;
    }
    if (originalDisabledAgents === undefined) {
      delete process.env.ALEX_DISABLED_AGENTS;
    } else {
      process.env.ALEX_DISABLED_AGENTS = originalDisabledAgents;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('corrupted user config is ignored instead of crashing startup', async () => {
  const originalHome = process.env.USERPROFILE;
  const originalPosixHome = process.env.HOME;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-home-'));

  try {
    process.env.USERPROFILE = tempHome;
    process.env.HOME = tempHome;

    const configPath = path.join(tempHome, '.alex', 'config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, '{not valid json', 'utf8');

    const configModule = await import(`../../dist/config.js?case=corrupted-${Date.now()}`);
    assert.deepEqual(configModule.readUserConfig(), {});
  } finally {
    if (originalHome === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalHome;
    }
    if (originalPosixHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalPosixHome;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
