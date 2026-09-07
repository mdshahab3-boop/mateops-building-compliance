import { describe, expect, it } from "vitest";
import { can, permissionsFor } from "../src/rbac.js";

describe("RBAC permission matrix", () => {
  it("platform_admin can do everything", () => {
    expect(can(["platform_admin"], "plan:manage")).toBe(true);
    expect(can(["platform_admin"], "qr:verify")).toBe(true);
    expect(can(["platform_admin"], "induction:publish")).toBe(true);
  });

  it("security may only verify and read compliance", () => {
    expect(can(["security"], "qr:verify")).toBe(true);
    expect(can(["security"], "compliance:read")).toBe(true);
    expect(can(["security"], "induction:manage")).toBe(false);
    expect(can(["security"], "contractor:manage")).toBe(false);
    expect(can(["security"], "compliance:export")).toBe(false);
  });

  it("contractor_worker cannot manage inductions but can complete attempts", () => {
    expect(can(["contractor_worker"], "induction:manage")).toBe(false);
    expect(can(["contractor_worker"], "attempt:complete")).toBe(true);
    expect(can(["contractor_worker"], "certificate:read")).toBe(true);
  });

  it("org_admin can publish inductions but is not a platform admin", () => {
    expect(can(["org_admin"], "induction:publish")).toBe(true);
    expect(can(["org_admin"], "compliance:export")).toBe(true);
    expect(can(["org_admin"], "plan:manage")).toBe(false);
  });

  it("building_manager can export compliance but not publish inductions", () => {
    expect(can(["building_manager"], "compliance:export")).toBe(true);
    expect(can(["building_manager"], "induction:publish")).toBe(false);
  });

  it("combines permissions across multiple roles", () => {
    expect(can(["security", "building_manager"], "compliance:export")).toBe(true);
  });

  it("permissionsFor returns a deduplicated list", () => {
    const perms = permissionsFor(["security", "security", "building_manager"]);
    expect(new Set(perms).size).toBe(perms.length);
    expect(perms).toContain("qr:verify");
  });
});
