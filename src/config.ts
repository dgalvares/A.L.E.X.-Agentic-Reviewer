import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';

export const FALLBACK_MODEL = 'gemini-2.5-pro';

const UserConfigSchema = z.object({
  geminiApiKey: z.string().optional(),
  model: z.string().optional(),
  agents: z.string().optional(),
  disabledAgents: z.string().optional(),
});

export type AlexUserConfig = {
  geminiApiKey?: string;
  model?: string;
  agents?: string;
  disabledAgents?: string;
};

let cachedUserConfig: AlexUserConfig | undefined;

export function getConfigPath(): string {
  return path.join(os.homedir(), '.alex', 'config.json');
}

export function readUserConfig(): AlexUserConfig {
  if (cachedUserConfig) return cachedUserConfig;

  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    const validation = UserConfigSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn(`Config invalid at ${getConfigPath()}; ignoring stored values.`);
      cachedUserConfig = {};
      return cachedUserConfig;
    }

    cachedUserConfig = validation.data;
    return cachedUserConfig;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      cachedUserConfig = {};
      return {};
    }

    if (error instanceof SyntaxError) {
      console.warn(`Config JSON invalid at ${getConfigPath()}; ignoring stored values.`);
      cachedUserConfig = {};
      return cachedUserConfig;
    }

    throw error;
  }
}

export function writeUserConfig(config: AlexUserConfig): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  try {
    if (fs.lstatSync(configPath).isSymbolicLink()) {
      throw new Error(`Refusing to write config through a symlink: ${configPath}`);
    }
  } catch (error: unknown) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  const tempPath = path.join(configDir, `.config.${process.pid}.${Date.now()}.tmp`);
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL;
  const fd = fs.openSync(tempPath, flags, 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8' });
    fs.closeSync(fd);
    fs.renameSync(tempPath, configPath);
  } catch (error: unknown) {
    try {
      fs.closeSync(fd);
    } catch {
      // Already closed.
    }
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Best effort cleanup.
    }
    throw error;
  } finally {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Best effort cleanup.
    }
  }
  cachedUserConfig = config;

  try {
    fs.chmodSync(configDir, 0o700);
    fs.chmodSync(configPath, 0o600);
  } catch {
    // Best effort on platforms/filesystems that do not support chmod.
  }
}

export function updateUserConfig(partial: AlexUserConfig): AlexUserConfig {
  const next = {
    ...readUserConfig(),
    ...partial,
  };
  writeUserConfig(next);
  return next;
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || readUserConfig().geminiApiKey;
}

export function getDefaultModel(): string {
  return process.env.ALEX_MODEL || readUserConfig().model || FALLBACK_MODEL;
}

export function applyStoredConfigToEnv(): void {
  const config = readUserConfig();
  if (process.env.GEMINI_API_KEY === undefined && config.geminiApiKey) {
    process.env.GEMINI_API_KEY = config.geminiApiKey;
  }
  if (process.env.ALEX_MODEL === undefined && config.model) {
    process.env.ALEX_MODEL = config.model;
  }
  if (process.env.ALEX_AGENTS === undefined && config.agents) {
    process.env.ALEX_AGENTS = config.agents;
  }
  if (process.env.ALEX_DISABLED_AGENTS === undefined && config.disabledAgents) {
    process.env.ALEX_DISABLED_AGENTS = config.disabledAgents;
  }
}
