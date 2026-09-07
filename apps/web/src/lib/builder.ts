import "server-only";
import { withTenant } from "./db";

export interface EditSlide {
  title: string;
  body: string;
  narration: string;
  sourcePage: number | null;
}
export interface EditOption {
  label: string;
  isCorrect: boolean;
}
export interface EditQuestion {
  prompt: string;
  options: EditOption[];
}
export interface EditView {
  induction: { id: string; title: string; contentType: string };
  versionNumber: number;
  status: string;
  isEditable: boolean;
  hasPublished: boolean;
  passScore: number;
  expiresAfterDays: number | null;
  declarationText: string;
  document: { title: string; versionId: string } | null;
  slides: EditSlide[];
  questions: EditQuestion[];
}

/**
 * Load an induction's latest version for editing. The latest version is
 * editable unless it is already published/archived (then the UI offers
 * "create a new version"). Published versions are never mutated.
 */
export async function getInductionForEdit(
  orgId: string,
  userId: string,
  inductionId: string,
): Promise<EditView | null> {
  return withTenant({ organisationId: orgId, userId, isPlatformAdmin: false }, async (c) => {
    const ind = (
      await c.query<{ id: string; title: string; content_type: string }>(
        "select id, title, content_type from inductions where id = $1",
        [inductionId],
      )
    ).rows[0];
    if (!ind) return null;

    const version = (
      await c.query<{
        id: string;
        version_number: number;
        status: string;
        pass_score: number;
        expires_after_days: number | null;
        declaration_text: string | null;
        source_document_version_id: string | null;
      }>(
        `select id, version_number, status, pass_score, expires_after_days,
                declaration_text, source_document_version_id
         from induction_versions where induction_id = $1
         order by version_number desc limit 1`,
        [inductionId],
      )
    ).rows[0];
    if (!version) return null;

    const hasPublished =
      ((
        await c.query(
          "select 1 from induction_versions where induction_id = $1 and status = 'published' limit 1",
          [inductionId],
        )
      ).rowCount ?? 0) > 0;

    let document: EditView["document"] = null;
    if (version.source_document_version_id) {
      const doc = (
        await c.query<{ title: string }>(
          `select d.title from document_versions dv join documents d on d.id = dv.document_id
           where dv.id = $1`,
          [version.source_document_version_id],
        )
      ).rows[0];
      if (doc) document = { title: doc.title, versionId: version.source_document_version_id };
    }

    const slides = (
      await c.query<EditSlide>(
        `select title, body, narration, source_page as "sourcePage"
         from induction_slides where induction_version_id = $1 order by sort_order`,
        [version.id],
      )
    ).rows.map((s) => ({
      title: s.title ?? "",
      body: s.body ?? "",
      narration: s.narration ?? "",
      sourcePage: s.sourcePage,
    }));

    const qrows = (
      await c.query<{ id: string; prompt: string }>(
        "select id, prompt from induction_questions where induction_version_id = $1 order by sort_order",
        [version.id],
      )
    ).rows;
    const questions: EditQuestion[] = [];
    for (const q of qrows) {
      const options = (
        await c.query<EditOption>(
          `select label, is_correct as "isCorrect" from induction_question_options
           where question_id = $1 order by sort_order`,
          [q.id],
        )
      ).rows;
      questions.push({ prompt: q.prompt, options });
    }

    return {
      induction: { id: ind.id, title: ind.title, contentType: ind.content_type },
      versionNumber: version.version_number,
      status: version.status,
      isEditable: version.status !== "published" && version.status !== "archived",
      hasPublished,
      passScore: version.pass_score,
      expiresAfterDays: version.expires_after_days,
      declarationText: version.declaration_text ?? "",
      document,
      slides,
      questions,
    };
  });
}
