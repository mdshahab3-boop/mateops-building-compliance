import type { AuthPrincipal, RoleAssignment } from "@scip/types";

/**
 * Minimal query surface so this module does not need to depend on the `pg`
 * types directly. Pass a pg PoolClient/Pool, or any compatible object.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface LoginCandidate {
  user_id: string;
  organisation_id: string | null;
  password_hash: string | null;
  status: string;
  is_platform_admin: boolean;
  full_name: string;
}

/** Find a login candidate via the SECURITY DEFINER function (cross-org safe). */
export async function findLoginCandidate(
  db: Queryable,
  email: string,
  organisationId: string | null,
): Promise<LoginCandidate | null> {
  const { rows } = await db.query<LoginCandidate>(
    "select * from auth_find_user_for_login($1, $2)",
    [email, organisationId],
  );
  return rows[0] ?? null;
}

export async function createSession(
  db: Queryable,
  args: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<string> {
  const { rows } = await db.query<{ auth_create_session: string }>(
    "select auth_create_session($1, $2, $3, $4, $5) as auth_create_session",
    [
      args.userId,
      args.tokenHash,
      args.expiresAt.toISOString(),
      args.ip ?? null,
      args.userAgent ?? null,
    ],
  );
  return rows[0]!.auth_create_session;
}

interface ResolveRow {
  user_id: string;
  organisation_id: string | null;
  is_platform_admin: boolean;
  full_name: string;
  email: string;
  roles: RoleAssignment[];
}

/** Resolve a session token hash to an AuthPrincipal, or null if invalid. */
export async function resolveSession(
  db: Queryable,
  tokenHash: string,
): Promise<AuthPrincipal | null> {
  const { rows } = await db.query<ResolveRow>(
    "select * from auth_resolve_session($1)",
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    organisationId: row.organisation_id,
    isPlatformAdmin: row.is_platform_admin,
    fullName: row.full_name,
    email: row.email,
    roles: row.roles ?? [],
  };
}

export async function revokeSession(
  db: Queryable,
  tokenHash: string,
): Promise<void> {
  await db.query("select auth_revoke_session($1)", [tokenHash]);
}

export async function setPassword(
  db: Queryable,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.query("select auth_set_password($1, $2)", [userId, passwordHash]);
}
