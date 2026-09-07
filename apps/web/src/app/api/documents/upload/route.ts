import { randomUUID, createHash } from "node:crypto";
import { getPrincipal, rolesOf } from "@/lib/auth";
import { can } from "@scip/auth";
import { withTenant } from "@/lib/db";
import { putObject, DOCUMENTS_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

const KIND_BY_CONTENT: Record<string, string> = {
  site_induction: "site_induction",
  house_rules: "house_rules",
  traffic_management: "traffic_management",
  emergency: "emergency",
  general: "other",
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const p = await getPrincipal();
  if (!p || !p.organisationId) return json({ error: "Unauthorized" }, 401);
  if (!can(rolesOf(p), "induction:manage")) return json({ error: "Forbidden" }, 403);

  const form = await req.formData();
  const file = form.get("file");
  const inductionId = String(form.get("inductionId") ?? "");
  if (!(file instanceof File)) return json({ error: "No file provided" }, 400);
  if (file.type !== "application/pdf") return json({ error: "PDF files only" }, 415);

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 25 * 1024 * 1024) return json({ error: "File too large (max 25 MB)" }, 413);

  const key = `org/${p.organisationId}/documents/${randomUUID()}.pdf`;
  await putObject(DOCUMENTS_BUCKET, key, buf, "application/pdf");
  const hash = createHash("sha256").update(buf).digest("hex");

  try {
    const result = await withTenant(
      { organisationId: p.organisationId, userId: p.userId, isPlatformAdmin: false },
      async (c) => {
        const ind = (
          await c.query<{ property_id: string; content_type: string }>(
            "select property_id, content_type from inductions where id=$1",
            [inductionId],
          )
        ).rows[0];
        if (!ind) throw new Error("Induction not found");
        const v = (
          await c.query<{ id: string; status: string }>(
            "select id, status from induction_versions where induction_id=$1 order by version_number desc limit 1",
            [inductionId],
          )
        ).rows[0];
        if (!v || v.status === "published" || v.status === "archived") {
          throw new Error("This version is not editable");
        }
        const docId = (
          await c.query<{ id: string }>(
            `insert into documents(organisation_id, property_id, title, doc_kind, created_by)
             values ($1,$2,$3,$4,$5) returning id`,
            [p.organisationId, ind.property_id, file.name, KIND_BY_CONTENT[ind.content_type] ?? "other", p.userId],
          )
        ).rows[0]!.id;
        const dvId = (
          await c.query<{ id: string }>(
            `insert into document_versions(organisation_id, document_id, version_number, storage_key, content_hash, uploaded_by)
             values ($1,$2,1,$3,$4,$5) returning id`,
            [p.organisationId, docId, key, hash, p.userId],
          )
        ).rows[0]!.id;
        await c.query("update induction_versions set source_document_version_id=$2 where id=$1", [v.id, dvId]);
        return { versionId: dvId, title: file.name };
      },
    );
    return json(result, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
