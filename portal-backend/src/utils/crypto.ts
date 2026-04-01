import crypto from 'node:crypto';

/** Generate a cryptographically random hex token. */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** SHA-256 hash for storing refresh tokens (not passwords — use bcrypt for those). */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
