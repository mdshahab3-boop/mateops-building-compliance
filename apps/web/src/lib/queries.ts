import "server-only";
import { withTenant, withAppConnection } from "@scip/db";

export interface RunSlide {
  id: string;
  title: string | null;
  body: string | null;
  narration: string | null;
}
export interface RunQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
}
export interface InductionRun {
  orgId: string;
  propertyId: string;
  inductionId: string;
  versionId: string;
  propertyName: string;
  inductionTitle: string;
  contentType: string;
  passScore: number;
  declarationText: string;
  slides: RunSlide[];
  questions: RunQuestion[];
}

/** Resolve an enrol token to a fully-loaded induction run (no correct answers). */
export async function getInductionByEnrolToken(
  token: string,
): Promise<InductionRun | null> {
  const resolved = await withAppConnection(async (c) =>
    (
      await c.query<{ organisation_id: string; property_id: string; induction_id: string }>(
        "select * from public_resolve_enrol_token($1)",
        [token],
      )
    ).rows[0],
  );
  if (!resolved) return null;
  const orgId = resolved.organisation_id;

  return withTenant({ organisationId: orgId, userId: null, isPlatformAdmin: false }, async (c) => {
    const version = (
      await c.query<{
        id: string;
        pass_score: number;
        declaration_text: string | null;
        induction_title: string;
        content_type: string;
        property_name: string;
      }>(
        `select v.id, v.pass_score, v.declaration_text,
                i.title as induction_title, i.content_type,
                p.name as property_name
         from induction_versions v
         join inductions i on i.id = v.induction_id
         join properties p on p.id = i.property_id
         where i.id = $1 and v.status = 'published'
         order by v.version_number desc
         limit 1`,
        [resolved.induction_id],
      )
    ).rows[0];
    if (!version) return null;

    const slides = (
      await c.query<RunSlide>(
        `select id, title, body, narration from induction_slides
         where induction_version_id = $1 order by sort_order asc`,
        [version.id],
      )
    ).rows;

    const questionRows = (
      await c.query<{ id: string; prompt: string }>(
        `select id, prompt from induction_questions
         where induction_version_id = $1 order by sort_order asc`,
        [version.id],
      )
    ).rows;

    const questions: RunQuestion[] = [];
    for (const q of questionRows) {
      const options = (
        await c.query<{ id: string; label: string }>(
          `select id, label from induction_question_options
           where question_id = $1 order by sort_order asc`,
          [q.id],
        )
      ).rows;
      questions.push({ id: q.id, prompt: q.prompt, options });
    }

    return {
      orgId,
      propertyId: resolved.property_id,
      inductionId: resolved.induction_id,
      versionId: version.id,
      propertyName: version.property_name,
      inductionTitle: version.induction_title,
      contentType: version.content_type,
      passScore: version.pass_score,
      declarationText: version.declaration_text ?? "",
      slides,
      questions,
    };
  });
}

export interface VerificationView {
  status: string;
  contractorName: string;
  company: string | null;
  propertyName: string;
  inductionTitle: string;
  versionNumber: number;
  score: number | null;
  completedAt: string | null;
  validUntil: string | null;
  certificateNumber: string | null;
  verifyToken: string;
}

/** Resolve a verification token to the minimal compliance view (public). */
export async function getVerification(token: string): Promise<VerificationView | null> {
  const resolved = await withAppConnection(async (c) =>
    (
      await c.query<{ organisation_id: string; attempt_id: string }>(
        "select * from public_resolve_verify_token($1)",
        [token],
      )
    ).rows[0],
  );
  if (!resolved) return null;
  const orgId = resolved.organisation_id;

  return withTenant({ organisationId: orgId, userId: null, isPlatformAdmin: false }, async (c) => {
    const row = (
      await c.query<VerificationView>(
        `select
           a.status,
           ct.full_name as "contractorName",
           cc.name as company,
           p.name as "propertyName",
           i.title as "inductionTitle",
           v.version_number as "versionNumber",
           a.score,
           a.completed_at as "completedAt",
           cert.valid_until as "validUntil",
           cert.certificate_number as "certificateNumber",
           a.verification_token as "verifyToken"
         from induction_attempts a
         join contractors ct on ct.id = a.contractor_id
         left join contractor_companies cc on cc.id = ct.contractor_company_id
         join induction_versions v on v.id = a.induction_version_id
         join inductions i on i.id = v.induction_id
         join properties p on p.id = i.property_id
         left join certificates cert on cert.attempt_id = a.id
         where a.id = $1`,
        [resolved.attempt_id],
      )
    ).rows[0];
    return row ?? null;
  });
}

export interface AdminOverview {
  propertyName: string;
  inductions: {
    inductionId: string;
    title: string;
    contentType: string;
    versionNumber: number;
    slideCount: number;
    questionCount: number;
    enrolToken: string | null;
    completions: number;
  }[];
  recentCompletions: {
    verifyToken: string;
    contractorName: string;
    company: string | null;
    inductionTitle: string;
    status: string;
    score: number | null;
    completedAt: string | null;
    validUntil: string | null;
  }[];
}

/** Admin dashboard data for the org's (single, in this demo) property. */
export async function getAdminOverview(orgId: string, userId: string): Promise<AdminOverview | null> {
  return withTenant({ organisationId: orgId, userId, isPlatformAdmin: false }, async (c) => {
    const property = (
      await c.query<{ name: string }>("select name from properties order by created_at asc limit 1")
    ).rows[0];
    if (!property) return null;

    const inductions = (
      await c.query<AdminOverview["inductions"][number]>(
        `select
           i.id as "inductionId",
           i.title,
           i.content_type as "contentType",
           v.version_number as "versionNumber",
           (select count(*)::int from induction_slides s where s.induction_version_id = v.id) as "slideCount",
           (select count(*)::int from induction_questions q where q.induction_version_id = v.id) as "questionCount",
           (select token from qr_codes qc where qc.induction_id = i.id and qc.purpose='enrol' and qc.is_active limit 1) as "enrolToken",
           (select count(*)::int from induction_attempts a where a.induction_version_id = v.id and a.status='passed') as "completions"
         from inductions i
         join lateral (
           select * from induction_versions v2
           where v2.induction_id = i.id and v2.status='published'
           order by v2.version_number desc limit 1
         ) v on true
         where i.status='active'
         order by i.created_at asc`,
      )
    ).rows;

    const recentCompletions = (
      await c.query<AdminOverview["recentCompletions"][number]>(
        `select
           a.verification_token as "verifyToken",
           ct.full_name as "contractorName",
           cc.name as company,
           i.title as "inductionTitle",
           a.status,
           a.score,
           a.completed_at as "completedAt",
           cert.valid_until as "validUntil"
         from induction_attempts a
         join contractors ct on ct.id = a.contractor_id
         left join contractor_companies cc on cc.id = ct.contractor_company_id
         join induction_versions v on v.id = a.induction_version_id
         join inductions i on i.id = v.induction_id
         left join certificates cert on cert.attempt_id = a.id
         where a.completed_at is not null
         order by a.completed_at desc
         limit 25`,
      )
    ).rows;

    return { propertyName: property.name, inductions, recentCompletions };
  });
}
