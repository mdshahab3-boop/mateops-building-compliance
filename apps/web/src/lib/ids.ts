import { createHash, randomBytes } from "node:crypto";

/** Opaque URL-safe token (verification links, etc.). */
export function opaqueToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

/** Human-facing certificate number, e.g. TM-CS-4F9A2C1B. */
export function certificateNumber(): string {
  return "TM-CS-" + randomBytes(4).toString("hex").toUpperCase();
}

/** Tamper-evidence hash for a certificate's core facts. */
export function contentHash(parts: (string | number | null | undefined)[]): string {
  return createHash("sha256").update(parts.map((p) => String(p ?? "")).join("|")).digest("hex");
}
