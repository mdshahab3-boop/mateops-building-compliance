"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrincipal, rolesOf } from "@/lib/auth";
import { can } from "@scip/auth";
import { withTenant } from "@/lib/db";
import { opaqueToken } from "@/lib/ids";
import type { AuthPrincipal } from "@scip/types";

// The transaction client type, derived from withTenant (avoids importing `pg`,
// which isn't a direct dependency of the web package).
type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

const DEFAULT_DECLARATION =
  "I confirm that I have watched and understood this induction, that the details " +
  "I have provided are true, and that I agree to comply with the site rules, " +
  "procedures and directions of Shared Facilities Management at all times while on site.";

const CONTENT_TYPES = ["general", "site_induction", "house_rules", "traffic_management", "emergency"];

export interface BuilderPayload {
  title: string;
  passScore: number;
  expiresAfterDays: number | null;
  declarationText: string;
  slides: { title: string; body: string; narration: string; sourcePage: number | null }[];
  questions: { prompt: string; options: { label: string; isCorrect: boolean }[] }[];
}

async function requireManage(): Promise<AuthPrincipal & { organisationId: string }> {
  const p = await getPrincipal();
  if (!p || !p.organisationId) redirect("/admin/login");
  if (!can(rolesOf(p), "induction:manage")) throw new Error("Not authorised");
  return p as AuthPrincipal & { organisationId: string };
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));

export async function createInduction(formData: FormData): Promise<void> {
  const p = await requireManage();
  const title = String(formData.get("title") ?? "").trim();
  const contentTypeRaw = String(formData.get("contentType") ?? "general");
  const contentType = CONTENT_TYPES.includes(contentTypeRaw) ? contentTypeRaw : "general";
  if (title.length < 2) throw new Error("Title required");

  const inductionId = await withTenant(
    { organisationId: p.organisationId, userId: p.userId, isPlatformAdmin: false },
    async (c) => {
      const prop = (await c.query<{ id: string }>("select id from properties order by created_at asc limit 1")).rows[0];
      if (!prop) throw new Error("Create a property first");
      const ind = (
        await c.query<{ id: string }>(
          `insert into inductions(organisation_id, property_id, title, content_type, is_mandatory)
           values ($1,$2,$3,$4,true) returning id`,
          [p.organisationId, prop.id, title, contentType],
        )
      ).rows[0]!.id;
      await c.query(
        `insert into induction_versions(organisation_id, induction_id, version_number, status, pass_score, declaration_text)
         values ($1,$2,1,'draft',80,$3)`,
        [p.organisationId, ind, DEFAULT_DECLARATION],
      );
      await c.query(
        `insert into qr_codes(organisation_id, property_id, induction_id, token, purpose)
         values ($1,$2,$3,$4,'enrol')`,
        [p.organisationId, prop.id, ind, opaqueToken(9)],
      );
      return ind;
    },
  );
  redirect(`/admin/inductions/${inductionId}`);
}

async function writeDraft(
  c: Tx,
  orgId: string,
  userId: string,
  inductionId: string,
  payload: BuilderPayload,
  publish: boolean,
): Promise<void> {
  const v = (
    await c.query<{ id: string; status: string }>(
      "select id, status from induction_versions where induction_id = $1 order by version_number desc limit 1",
      [inductionId],
    )
  ).rows[0];
  if (!v) throw new Error("Induction not found");
  if (v.status === "published" || v.status === "archived") {
    throw new Error("This version is published — create a new version to edit it.");
  }

  await c.query("update inductions set title = $2 where id = $1", [inductionId, payload.title.trim()]);
  await c.query(
    "update induction_versions set pass_score=$2, expires_after_days=$3, declaration_text=$4 where id=$1",
    [v.id, clampScore(payload.passScore), payload.expiresAfterDays, payload.declarationText],
  );

  await c.query("delete from induction_slides where induction_version_id = $1", [v.id]);
  let si = 0;
  for (const s of payload.slides) {
    await c.query(
      `insert into induction_slides(organisation_id, induction_version_id, sort_order, title, body, narration, source_page, reviewer_status)
       values ($1,$2,$3,$4,$5,$6,$7,'approved')`,
      [orgId, v.id, si++, s.title, s.body, s.narration, s.sourcePage],
    );
  }

  await c.query("delete from induction_questions where induction_version_id = $1", [v.id]);
  let qi = 0;
  for (const q of payload.questions) {
    const qid = (
      await c.query<{ id: string }>(
        `insert into induction_questions(organisation_id, induction_version_id, prompt, question_type, sort_order)
         values ($1,$2,$3,'single_choice',$4) returning id`,
        [orgId, v.id, q.prompt, qi++],
      )
    ).rows[0]!.id;
    let oi = 0;
    for (const o of q.options) {
      await c.query(
        `insert into induction_question_options(organisation_id, question_id, label, is_correct, sort_order)
         values ($1,$2,$3,$4,$5)`,
        [orgId, qid, o.label, o.isCorrect, oi++],
      );
    }
  }

  if (publish) {
    if (payload.slides.length < 1) throw new Error("Add at least one slide before publishing.");
    for (const q of payload.questions) {
      if (!q.prompt.trim()) throw new Error("Every question needs a prompt.");
      const filled = q.options.filter((o) => o.label.trim());
      if (filled.length < 2) throw new Error("Every question needs at least two answer options.");
      if (filled.filter((o) => o.isCorrect).length !== 1)
        throw new Error("Every question needs exactly one correct answer.");
    }
    await c.query("update induction_versions set status='archived' where induction_id=$1 and status='published'", [
      inductionId,
    ]);
    await c.query(
      "update induction_versions set status='published', published_by=$2, published_at=now(), effective_from=now() where id=$1",
      [v.id, userId],
    );
  }
}

export async function saveDraft(
  inductionId: string,
  payload: BuilderPayload,
): Promise<{ ok: boolean; error?: string }> {
  const p = await requireManage();
  try {
    await withTenant({ organisationId: p.organisationId, userId: p.userId, isPlatformAdmin: false }, (c) =>
      writeDraft(c, p.organisationId, p.userId, inductionId, payload, false),
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath(`/admin/inductions/${inductionId}`);
  return { ok: true };
}

export async function publishInduction(
  inductionId: string,
  payload: BuilderPayload,
): Promise<{ ok: boolean; error?: string }> {
  const p = await requireManage();
  try {
    await withTenant({ organisationId: p.organisationId, userId: p.userId, isPlatformAdmin: false }, (c) =>
      writeDraft(c, p.organisationId, p.userId, inductionId, payload, true),
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function newVersion(inductionId: string): Promise<void> {
  const p = await requireManage();
  await withTenant({ organisationId: p.organisationId, userId: p.userId, isPlatformAdmin: false }, async (c) => {
    const latest = (
      await c.query<{
        id: string;
        version_number: number;
        status: string;
        pass_score: number;
        expires_after_days: number | null;
        declaration_text: string | null;
        source_document_version_id: string | null;
      }>("select * from induction_versions where induction_id=$1 order by version_number desc limit 1", [inductionId])
    ).rows[0];
    if (!latest || latest.status !== "published") return; // an editable draft already exists
    const nv = (
      await c.query<{ id: string }>(
        `insert into induction_versions(organisation_id, induction_id, version_number, status, pass_score, expires_after_days, declaration_text, source_document_version_id)
         values ($1,$2,$3,'draft',$4,$5,$6,$7) returning id`,
        [
          p.organisationId,
          inductionId,
          latest.version_number + 1,
          latest.pass_score,
          latest.expires_after_days,
          latest.declaration_text,
          latest.source_document_version_id,
        ],
      )
    ).rows[0]!.id;
    await c.query(
      `insert into induction_slides(organisation_id, induction_version_id, sort_order, title, body, narration, source_document_id, source_page, safety_critical, reviewer_status)
       select organisation_id, $1, sort_order, title, body, narration, source_document_id, source_page, safety_critical, reviewer_status
       from induction_slides where induction_version_id = $2`,
      [nv, latest.id],
    );
    const qs = (
      await c.query<{ id: string; prompt: string; question_type: string; sort_order: number; explanation: string | null; safety_critical: boolean }>(
        "select id, prompt, question_type, sort_order, explanation, safety_critical from induction_questions where induction_version_id=$1 order by sort_order",
        [latest.id],
      )
    ).rows;
    for (const q of qs) {
      const nq = (
        await c.query<{ id: string }>(
          `insert into induction_questions(organisation_id, induction_version_id, prompt, question_type, sort_order, explanation, safety_critical)
           values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [p.organisationId, nv, q.prompt, q.question_type, q.sort_order, q.explanation, q.safety_critical],
        )
      ).rows[0]!.id;
      await c.query(
        `insert into induction_question_options(organisation_id, question_id, label, is_correct, sort_order)
         select organisation_id, $1, label, is_correct, sort_order from induction_question_options where question_id = $2`,
        [nq, q.id],
      );
    }
  });
  redirect(`/admin/inductions/${inductionId}`);
}
