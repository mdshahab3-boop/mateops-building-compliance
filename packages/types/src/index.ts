// Shared domain vocabulary. Keep in sync with the CHECK constraints in
// packages/db/migrations.

export const ROLES = [
  "platform_admin",
  "org_admin",
  "building_manager",
  "security",
  "contractor_company_admin",
  "contractor_worker",
] as const;
export type Role = (typeof ROLES)[number];

export const INDUCTION_VERSION_STATUSES = [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
] as const;
export type InductionVersionStatus = (typeof INDUCTION_VERSION_STATUSES)[number];

export const ATTEMPT_STATUSES = [
  "in_progress",
  "passed",
  "failed",
  "abandoned",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const COMPLIANCE_STATUSES = [
  "compliant",
  "pending",
  "expiring",
  "expired",
  "reinduction_required",
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const CONTRACTOR_DOC_TYPES = [
  "insurance_public_liability",
  "insurance_workers_comp",
  "license",
  "swms",
  "whs_plan",
  "other",
] as const;
export type ContractorDocType = (typeof CONTRACTOR_DOC_TYPES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** A role optionally scoped to a specific property (building_manager/security). */
export interface RoleAssignment {
  role: Role;
  property_id: string | null;
}

/** The authenticated principal resolved from a session. */
export interface AuthPrincipal {
  userId: string;
  organisationId: string | null;
  isPlatformAdmin: boolean;
  fullName: string;
  email: string;
  roles: RoleAssignment[];
}
