import crypto from 'node:crypto'

/**
 * Generate an opaque refresh token: 256 bits of CSPRNG entropy, base64url-encoded.
 * It is NOT a JWT — its contents are never read, only matched by hash.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Hash a refresh token with SHA-256 (hex). A 256-bit random token is already
 * high-entropy, so a fast hash is safe here and the result can be indexed
 * directly for `WHERE refresh_token_hash = ?` lookups.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Generate a random JWT id (jti) used to tie an access token to its session. */
export function generateJti(): string {
  return crypto.randomUUID()
}
