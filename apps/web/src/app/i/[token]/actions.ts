"use server";

import { withTenant, withAppConnection } from "@/lib/db";
import { opaqueToken, certificateNumber, contentHash } from "@/lib/ids";

export interface SubmitInput {
  token: string;
  fullName: string;
  company: string;
  phone: string;
  vehicleRego: string;
  answers: Record<string, string>; // questionId -> optionId
  signatureName: string;
  signatureDataUrl: string;
}

export type SubmitResult =
  | { ok: true; passed: true; score: number; verifyToken: string }
  | { ok: true; passed: false; score: number }
  | { ok: false; error: string };

export async function submitInduction(input: SubmitInput): Promise<SubmitResult> {
  if (!input.fullName.trim() || !input.signatureName.trim()) {
    return { ok: false, error: "Please provide your name and signature." };
  }

  const resolved = await withAppConnection(async (c) =>
    (
      await c.query<{ organisation_id: string; property_id: string; induction_id: string }>(
        "select * from public_resolve_enrol_token($1)",
        [input.token],
      )
    ).rows[0],
  );
  if (!resolved) return { ok: false, error: "This induction link is invalid or expired." };

  const orgId = resolved.organisation_id;

  return withTenant(
    { organisationId: orgId, userId: null, isPlatformAdmin: false },
    async (c): Promise<SubmitResult> => {
      const version = (
        await c.query<{
          id: string;
          pass_score: number;
          declaration_text: string | null;
          expires_after_days: number | null;
        }>(
          `select v.id, v.pass_score, v.declaration_text, v.expires_after_days
           from induction_versions v
           join inductions i on i.id = v.induction_id
           where i.id = $1 and v.status = 'published'
           order by v.version_number desc limit 1`,
          [resolved.induction_id],
        )
      ).rows[0];
      if (!version) return { ok: false, error: "This induction is not currently published." };

      // Correct option ids per question (server-side grading).
      const correctRows = (
        await c.query<{ question_id: string; option_id: string }>(
          `select q.id as question_id, o.id as option_id
           from induction_questions q
           join induction_question_options o on o.question_id = q.id
           where q.induction_version_id = $1 and o.is_correct = true`,
          [version.id],
        )
      ).rows;
      const totalQuestions = (
        await c.query<{ n: number }>(
          "select count(*)::int as n from induction_questions where induction_version_id = $1",
          [version.id],
        )
      ).rows[0]!.n;
      const correctByQuestion = new Map<string, string>();
      for (const r of correctRows) correctByQuestion.set(r.question_id, r.option_id);

      // Company (find or create) + contractor.
      let companyId: string | null = null;
      if (input.company.trim()) {
        const existing = (
          await c.query<{ id: string }>(
            "select id from contractor_companies where organisation_id = $1 and lower(name) = lower($2) limit 1",
            [orgId, input.company.trim()],
          )
        ).rows[0];
        companyId =
          existing?.id ??
          (
            await c.query<{ id: string }>(
              "insert into contractor_companies(organisation_id, name) values ($1,$2) returning id",
              [orgId, input.company.trim()],
            )
          ).rows[0]!.id;
      }

      const contractorId = (
        await c.query<{ id: string }>(
          `insert into contractors(organisation_id, contractor_company_id, full_name, phone)
           values ($1,$2,$3,$4) returning id`,
          [orgId, companyId, input.fullName.trim(), input.phone.trim() || null],
        )
      ).rows[0]!.id;

      const attemptId = (
        await c.query<{ id: string }>(
          `insert into induction_attempts
             (organisation_id, property_id, contractor_id, induction_version_id, status, progress, started_at)
           values ($1,$2,$3,$4,'in_progress',$5, now()) returning id`,
          [
            orgId,
            resolved.property_id,
            contractorId,
            version.id,
            JSON.stringify({ vehicleRego: input.vehicleRego.trim() || null }),
          ],
        )
      ).rows[0]!.id;

      let correctCount = 0;
      for (const [questionId, correctOptionId] of correctByQuestion) {
        const chosen = input.answers[questionId] ?? null;
        const isCorrect = chosen === correctOptionId;
        if (isCorrect) correctCount++;
        await c.query(
          `insert into induction_answers(organisation_id, attempt_id, question_id, selected_option_ids, is_correct)
           values ($1,$2,$3,$4::uuid[],$5)`,
          [orgId, attemptId, questionId, chosen ? [chosen] : [], isCorrect],
        );
      }

      const score = totalQuestions === 0 ? 100 : Math.round((correctCount / totalQuestions) * 100);
      const passed = score >= version.pass_score;

      if (!passed) {
        await c.query(
          "update induction_attempts set status='failed', score=$2, passed=false, completed_at=now() where id=$1",
          [attemptId, score],
        );
        return { ok: true, passed: false, score };
      }

      const verifyToken = opaqueToken();
      await c.query(
        "update induction_attempts set status='passed', score=$2, passed=true, completed_at=now(), verification_token=$3 where id=$1",
        [attemptId, score, verifyToken],
      );

      await c.query(
        `insert into declarations(organisation_id, attempt_id, declaration_text, induction_version_id)
         values ($1,$2,$3,$4)`,
        [orgId, attemptId, version.declaration_text ?? "", version.id],
      );
      await c.query(
        `insert into signatures(organisation_id, attempt_id, signed_name, storage_key)
         values ($1,$2,$3,$4)`,
        [orgId, attemptId, input.signatureName.trim(), input.signatureDataUrl.slice(0, 200000)],
      );

      const validUntil =
        version.expires_after_days != null
          ? new Date(Date.now() + version.expires_after_days * 86400000)
          : null;
      const certNumber = certificateNumber();
      const hash = contentHash([
        contractorId,
        version.id,
        certNumber,
        validUntil?.toISOString(),
      ]);
      const certId = (
        await c.query<{ id: string }>(
          `insert into certificates
             (organisation_id, property_id, contractor_id, induction_version_id, attempt_id,
              certificate_number, content_hash, valid_until)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [orgId, resolved.property_id, contractorId, version.id, attemptId, certNumber, hash, validUntil],
        )
      ).rows[0]!.id;

      await c.query(
        `insert into compliance_records
           (organisation_id, property_id, contractor_id, induction_id, current_version_id,
            latest_attempt_id, certificate_id, status, valid_until)
         values ($1,$2,$3,$4,$5,$6,$7,'compliant',$8)
         on conflict (contractor_id, induction_id) do update set
           current_version_id = excluded.current_version_id,
           latest_attempt_id = excluded.latest_attempt_id,
           certificate_id = excluded.certificate_id,
           status = 'compliant',
           valid_until = excluded.valid_until,
           updated_at = now()`,
        [orgId, resolved.property_id, contractorId, resolved.induction_id, version.id, attemptId, certId, validUntil],
      );

      return { ok: true, passed: true, score, verifyToken };
    },
  );
}
