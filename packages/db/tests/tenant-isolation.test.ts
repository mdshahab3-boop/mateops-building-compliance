import { config } from "dotenv";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePools, withAdmin, withTenant, type TenantContext } from "../src/index.js";

config({ path: join(process.cwd(), "..", "..", ".env") });
config();

// These tests require a running Postgres with migrations applied and the
// app_user role present. Without connection strings they are skipped so the
// unit suite still runs in CI without infra.
const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_ADMIN_URL);
const suite = hasDb ? describe : describe.skip;

suite("tenant isolation (Row-Level Security)", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  let orgA = "";
  let orgB = "";

  const ctxFor = (org: string): TenantContext => ({
    organisationId: org,
    userId: null,
    isPlatformAdmin: false,
  });

  beforeAll(async () => {
    await withAdmin(async (c) => {
      const a = await c.query<{ id: string }>(
        "insert into organisations(name, slug) values ($1,$2) returning id",
        [`Org A ${suffix}`, `org-a-${suffix}`],
      );
      const b = await c.query<{ id: string }>(
        "insert into organisations(name, slug) values ($1,$2) returning id",
        [`Org B ${suffix}`, `org-b-${suffix}`],
      );
      orgA = a.rows[0]!.id;
      orgB = b.rows[0]!.id;
      await c.query("insert into properties(organisation_id, name) values ($1,$2)", [
        orgA,
        "A Tower",
      ]);
      await c.query("insert into properties(organisation_id, name) values ($1,$2)", [
        orgB,
        "B Tower",
      ]);
    });
  });

  afterAll(async () => {
    if (orgA && orgB) {
      await withAdmin(async (c) => {
        await c.query("delete from organisations where id = any($1::uuid[])", [
          [orgA, orgB],
        ]);
      });
    }
    await closePools();
  });

  it("a tenant sees only its own rows", async () => {
    const names = await withTenant(ctxFor(orgA), async (c) =>
      (await c.query<{ name: string }>("select name from properties")).rows.map(
        (r) => r.name,
      ),
    );
    expect(names).toEqual(["A Tower"]);
  });

  it("a tenant cannot read another org's rows even by explicit id", async () => {
    const rows = await withTenant(ctxFor(orgA), async (c) =>
      (
        await c.query("select * from properties where organisation_id = $1", [orgB])
      ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("a tenant cannot insert a row into another org (WITH CHECK)", async () => {
    await expect(
      withTenant(ctxFor(orgA), async (c) => {
        await c.query(
          "insert into properties(organisation_id, name) values ($1,$2)",
          [orgB, "cross-tenant"],
        );
      }),
    ).rejects.toThrow();
  });

  it("a platform admin can see all organisations", async () => {
    const count = await withTenant(
      { organisationId: null, userId: null, isPlatformAdmin: true },
      async (c) =>
        (
          await c.query("select id from organisations where id = any($1::uuid[])", [
            [orgA, orgB],
          ])
        ).rows.length,
    );
    expect(count).toBe(2);
  });

  it("app_user cannot read users.password_hash (column privilege)", async () => {
    await expect(
      withTenant(ctxFor(orgA), async (c) => {
        await c.query("select password_hash from users limit 1");
      }),
    ).rejects.toThrow();
  });
});
