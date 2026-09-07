import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generate an opaque session token. The raw value is returned to the caller to
 * place in an httpOnly cookie; only its hash is ever stored.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hash of a token, as stored in `sessions.token_hash`. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex token hashes. */
export function tokenHashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sessionExpiry(ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 12)): Date {
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}
