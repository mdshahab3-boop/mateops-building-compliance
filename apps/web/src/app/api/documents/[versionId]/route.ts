import { getPrincipal } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { getObjectBuffer, DOCUMENTS_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

// Streams a private source document through the app so MinIO never needs to be
// publicly reachable. RLS restricts rows to the caller's org.
export async function GET(_req: Request, { params }: { params: { versionId: string } }) {
  const p = await getPrincipal();
  if (!p || !p.organisationId) return new Response("Unauthorized", { status: 401 });

  const key = await withTenant(
    { organisationId: p.organisationId, userId: p.userId, isPlatformAdmin: false },
    async (c) =>
      (
        await c.query<{ storage_key: string }>("select storage_key from document_versions where id=$1", [
          params.versionId,
        ])
      ).rows[0]?.storage_key,
  );
  if (!key) return new Response("Not found", { status: 404 });

  const { body, contentType } = await getObjectBuffer(DOCUMENTS_BUCKET, key);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": contentType ?? "application/pdf",
      "content-disposition": "inline",
    },
  });
}
