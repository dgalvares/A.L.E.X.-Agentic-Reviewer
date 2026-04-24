import path from 'path';

const BLOCKED_EXTENSIONS = ['.env', '.pem', '.key', '.pfx', '.sqlite', '.db', '.p12', '.crt', '.cer', '.pub'];
const BLOCKED_BASENAMES = ['.env', '.npmrc', '.netrc', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];

export function isBlockedSensitivePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();

  return BLOCKED_EXTENSIONS.includes(ext) ||
    BLOCKED_BASENAMES.some(blocked => baseName === blocked || baseName.startsWith('.env'));
}
