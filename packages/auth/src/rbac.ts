import type { Role } from "@scip/types";

/**
 * Single source of truth for what each role may do. Property-level scoping
 * (which property a building_manager/security is assigned to) is a SEPARATE
 * check performed in the app layer against user_roles.property_id.
 */
export const PERMISSIONS = [
  "org:manage",
  "property:manage",
  "property:read",
  "user:manage",
  "contractor:manage",
  "contractor:read",
  "company:manage",
  "induction:manage",
  "induction:publish",
  "induction:read",
  "attempt:complete",
  "certificate:read",
  "compliance:read",
  "compliance:export",
  "qr:verify",
  "audit:read",
  "plan:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_admin: PERMISSIONS, // everything
  org_admin: [
    "org:manage",
    "property:manage",
    "property:read",
    "user:manage",
    "contractor:manage",
    "contractor:read",
    "induction:manage",
    "induction:publish",
    "induction:read",
    "certificate:read",
    "compliance:read",
    "compliance:export",
    "qr:verify",
    "audit:read",
  ],
  building_manager: [
    "property:read",
    "contractor:manage",
    "contractor:read",
    "induction:read",
    "certificate:read",
    "compliance:read",
    "compliance:export",
    "qr:verify",
  ],
  security: ["qr:verify", "compliance:read"],
  contractor_company_admin: [
    "company:manage",
    "contractor:read",
    "certificate:read",
    "compliance:read",
  ],
  contractor_worker: ["attempt:complete", "certificate:read", "induction:read"],
};

/** Does ANY of the principal's roles grant `permission`? */
export function can(roles: readonly Role[], permission: Permission): boolean {
  if (roles.includes("platform_admin")) return true;
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

/** All permissions granted to a set of roles (deduplicated). */
export function permissionsFor(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return [...set];
}
