import { z } from "zod";
import { ROLES } from "@scip/types";

// Shared request schemas used by both the API (server-side validation) and the
// admin UI (client-side hints). Server is always the source of truth.

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
  orgSlug: z.string().min(1).max(80).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createOrganisationSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and hyphens only"),
  abn: z.string().max(20).optional(),
});
export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

export const createPropertySchema = z.object({
  name: z.string().min(2).max(200),
  addressLine1: z.string().max(200).optional(),
  suburb: z.string().max(100).optional(),
  state: z.string().max(20).optional(),
  postcode: z.string().max(12).optional(),
  timezone: z.string().max(64).default("Australia/Sydney"),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const createContractorCompanySchema = z.object({
  name: z.string().min(2).max(200),
  abn: z.string().max(20).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
});
export type CreateContractorCompanyInput = z.infer<
  typeof createContractorCompanySchema
>;

export const inviteUserSchema = z.object({
  email: z.string().email().max(320),
  fullName: z.string().min(1).max(200),
  role: z.enum(ROLES),
  propertyId: z.string().uuid().optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
