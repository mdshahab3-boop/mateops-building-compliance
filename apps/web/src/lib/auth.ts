import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withAppConnection } from "@scip/db";
import {
  resolveSession,
  createSession,
  hashToken,
  generateSessionToken,
  sessionExpiry,
  revokeSession,
  findLoginCandidate,
  verifyPassword,
} from "@scip/auth";
import type { AuthPrincipal, Role } from "@scip/types";

const COOKIE = "scip_session";

/** Resolve the current principal from the session cookie, or null. */
export async function getPrincipal(): Promise<AuthPrincipal | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return withAppConnection((c) => resolveSession(c, hashToken(token)));
}

export async function requireUser(): Promise<AuthPrincipal> {
  const principal = await getPrincipal();
  if (!principal) redirect("/admin/login");
  return principal;
}

/** Roles a principal holds (platform_admin implied for platform admins). */
export function rolesOf(principal: AuthPrincipal): Role[] {
  const roles = principal.roles.map((r) => r.role);
  if (principal.isPlatformAdmin && !roles.includes("platform_admin")) {
    roles.push("platform_admin");
  }
  return roles;
}

/** Create a session for a user and set the cookie. Returns nothing. */
export async function startSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const raw = generateSessionToken();
  const expiresAt = sessionExpiry();
  await withAppConnection((c) =>
    createSession(c, {
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    }),
  );
  cookies().set(COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Verify credentials scoped to an organisation slug. Returns the user id on
 * success, or null. Does not create a session (call startSession separately).
 */
export async function authenticate(
  email: string,
  password: string,
  orgSlug: string,
): Promise<{ userId: string } | null> {
  return withAppConnection(async (c) => {
    const org = (
      await c.query<{ id: string | null }>("select auth_find_org_by_slug($1) as id", [orgSlug])
    ).rows[0]?.id;
    if (!org) return null;
    const candidate = await findLoginCandidate(c, email, org);
    if (!candidate || candidate.status !== "active") return null;
    const ok = await verifyPassword(candidate.password_hash, password);
    return ok ? { userId: candidate.user_id } : null;
  });
}

export async function endSession(): Promise<void> {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    await withAppConnection((c) => revokeSession(c, hashToken(token)));
  }
  cookies().delete(COOKIE);
}
