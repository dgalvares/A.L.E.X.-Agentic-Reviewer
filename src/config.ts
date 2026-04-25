import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';

export const FALLBACK_MODEL = 'gemini-2.5-pro';

const UserConfigSchema = z.object({
  geminiApiKey: z.string().optional(),
  model: z.string().optional(),
});

export type AlexUserConfig = {
  geminiApiKey?: string;
  model?: string;
};

let cachedUserConfig: AlexUserConfig | undefined;

export function getConfigPath(): string {
  return path.join(os.homedir(), '.alex', 'config.json');
}

export function readUserConfig(): AlexUserConfig {
  if (cachedUserConfig) return cachedUserConfig;

  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const validation = UserConfigSchema.safeParse(JSON.parse(raw));
    cachedUserConfig = validation.success ? validation.data : {};
    return cachedUserConfig;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      cachedUserConfig = {};
      return {};
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

  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW;
  const fd = fs.openSync(configPath, flags, 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8' });
  } finally {
    fs.closeSync(fd);
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
  if (!process.env.GEMINI_API_KEY && config.geminiApiKey) {
    process.env.GEMINI_API_KEY = config.geminiApiKey;
  }
  if (!process.env.ALEX_MODEL && config.model) {
    process.env.ALEX_MODEL = config.model;
  }
}
