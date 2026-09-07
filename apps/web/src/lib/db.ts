import "server-only";
import {
  withTenant,
  withAppConnection,
  type TenantContext,
} from "@scip/db";

export { withTenant, withAppConnection };
export type { TenantContext };

/** Build a tenant context for an authenticated org user. */
export function orgContext(
  organisationId: string | null,
  userId: string | null,
  isPlatformAdmin = false,
): TenantContext {
  return { organisationId, userId, isPlatformAdmin };
}
