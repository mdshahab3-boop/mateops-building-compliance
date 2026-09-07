import pg from "pg";

const { Pool } = pg;

/**
 * The identity/tenant context applied to a request's database transaction.
 * Set via SET LOCAL so it is scoped to the transaction and never leaks across
 * pooled connections. RLS policies read these values.
 */
export interface TenantContext {
  organisationId: string | null;
  userId: string | null;
  isPlatformAdmin: boolean;
}

let appPool: pg.Pool | undefined;
let adminPool: pg.Pool | undefined;

/** Runtime pool: connects as the least-privilege `app_user`. RLS is enforced. */
export function getAppPool(): pg.Pool {
  if (!appPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    appPool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 10),
    });
  }
  return appPool;
}

/** Admin pool: connects as the owner/superuser. Used ONLY for migrations. */
export function getAdminPool(): pg.Pool {
  if (!adminPool) {
    const connectionString = process.env.DATABASE_ADMIN_URL;
    if (!connectionString) throw new Error("DATABASE_ADMIN_URL is not set");
    adminPool = new Pool({ connectionString, max: 5 });
  }
  return adminPool;
}

/**
 * Run `fn` inside a transaction with the tenant context applied. Every runtime
 * query MUST go through here so RLS can enforce isolation. `set_config(..., true)`
 * is the parameterised, transaction-local form of SET LOCAL.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.current_org_id', $1, true)", [
      ctx.organisationId ?? "",
    ]);
    await client.query("select set_config('app.current_user_id', $1, true)", [
      ctx.userId ?? "",
    ]);
    await client.query("select set_config('app.is_platform_admin', $1, true)", [
      ctx.isPlatformAdmin ? "true" : "false",
    ]);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Privileged access for the app role WITHOUT a tenant set — used only for the
 * SECURITY DEFINER auth functions (which enforce their own scope) and health
 * checks. Never use this for tenant business queries.
 */
export async function withAppConnection<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Owner/superuser access. Migrations and maintenance only. Bypasses RLS. */
export async function withAdmin<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAdminPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePools(): Promise<void> {
  const pending: Array<Promise<void>> = [];
  if (appPool) pending.push(appPool.end());
  if (adminPool) pending.push(adminPool.end());
  await Promise.all(pending);
  appPool = undefined;
  adminPool = undefined;
}
