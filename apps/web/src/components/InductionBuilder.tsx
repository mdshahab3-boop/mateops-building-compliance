"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveDraft, publishInduction, type BuilderPayload } from "@/app/admin/inductions/actions";
import type { EditView } from "@/lib/builder";
import { BrandBadge } from "@/components/Brand";

type Slide = BuilderPayload["slides"][number];
type Question = BuilderPayload["questions"][number];

export function InductionBuilder({ initial }: { initial: EditView }) {
  const router = useRouter();
  const id = initial.induction.id;

  const [title, setTitle] = useState(initial.induction.title);
  const [passScore, setPassScore] = useState(initial.passScore);
  const [expiry, setExpiry] = useState<string>(
    initial.expiresAfterDays == null ? "" : String(initial.expiresAfterDays),
  );
  const [declaration, setDeclaration] = useState(initial.declarationText);
  const [slides, setSlides] = useState<Slide[]>(
    initial.slides.length ? initial.slides : [{ title: "", body: "", narration: "", sourcePage: null }],
  );
  const [questions, setQuestions] = useState<Question[]>(initial.questions);
  const [doc, setDoc] = useState(initial.document);

  const [busy, setBusy] = useState<"save" | "publish" | "upload" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function payload(): BuilderPayload {
    return {
      title,
      passScore,
      expiresAfterDays: expiry.trim() === "" ? null : Number(expiry),
      declarationText: declaration,
      slides,
      questions,
    };
  }

  async function onUpload(file: File) {
    setBusy("upload");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("inductionId", id);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setMsg({ kind: "err", text: data.error ?? "Upload failed" });
      else {
        setDoc({ title: data.title, versionId: data.versionId });
        setMsg({ kind: "ok", text: `Uploaded ${data.title}` });
      }
    } catch {
      setMsg({ kind: "err", text: "Upload failed" });
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    setBusy("save");
    setMsg(null);
    const r = await saveDraft(id, payload());
    setBusy(null);
    setMsg(r.ok ? { kind: "ok", text: "Draft saved" } : { kind: "err", text: r.error ?? "Save failed" });
  }

  async function onPublish() {
    setBusy("publish");
    setMsg(null);
    const r = await publishInduction(id, payload());
    setBusy(null);
    if (r.ok) router.push("/admin");
    else setMsg({ kind: "err", text: r.error ?? "Publish failed" });
  }

  // --- slide helpers ---
  const setSlide = (i: number, patch: Partial<Slide>) =>
    setSlides((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addSlide = () => setSlides((s) => [...s, { title: "", body: "", narration: "", sourcePage: null }]);
  const removeSlide = (i: number) => setSlides((s) => s.filter((_, j) => j !== i));
  const moveSlide = (i: number, d: -1 | 1) =>
    setSlides((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  // --- question helpers ---
  const setQ = (i: number, patch: Partial<Question>) =>
    setQuestions((q) => q.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addQuestion = () =>
    setQuestions((q) => [
      ...q,
      { prompt: "", options: [{ label: "", isCorrect: true }, { label: "", isCorrect: false }] },
    ]);
  const removeQuestion = (i: number) => setQuestions((q) => q.filter((_, j) => j !== i));
  const setOption = (qi: number, oi: number, patch: Partial<Question["options"][number]>) =>
    setQ(qi, { options: questions[qi]!.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) });
  const setCorrect = (qi: number, oi: number) =>
    setQ(qi, { options: questions[qi]!.options.map((o, j) => ({ ...o, isCorrect: j === oi })) });
  const addOption = (qi: number) =>
    setQ(qi, { options: [...questions[qi]!.options, { label: "", isCorrect: false }] });
  const removeOption = (qi: number, oi: number) =>
    setQ(qi, { options: questions[qi]!.options.filter((_, j) => j !== oi) });

  return (
    <div className="min-h-screen pb-28">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <BrandBadge />
          <Link href="/admin" className="btn-ghost px-3 py-2 text-sm">← Dashboard</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <span className="rounded-full bg-tm-teal/10 px-2.5 py-0.5 text-xs font-semibold text-tm-teal">
            Version {initial.versionNumber} · draft
          </span>
          <h1 className="mt-2 text-2xl font-extrabold">Edit induction</h1>
          <p className="text-sm text-tm-ink/60">Build the slides and quiz, then publish. Publishing creates an immutable version.</p>
        </div>

        {/* Settings */}
        <section className="card space-y-4 p-6">
          <h2 className="font-bold">Details</h2>
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Pass mark (%)</label>
              <input className="input" type="number" min={0} max={100} value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Valid for (days, blank = no expiry)</label>
              <input className="input" type="number" min={0} value={expiry}
                onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Declaration text</label>
            <textarea className="input min-h-24" value={declaration} onChange={(e) => setDeclaration(e.target.value)} />
          </div>
        </section>

        {/* Source PDF */}
        <section className="card space-y-3 p-6">
          <h2 className="font-bold">Source document (PDF)</h2>
          <p className="text-sm text-tm-ink/60">
            Upload the building&apos;s PDF (Site Induction, House Rules, Traffic Plan…). It&apos;s stored securely and
            attached to this induction as the source of truth.
          </p>
          {doc && (
            <a href={`/api/documents/${doc.versionId}`} target="_blank" className="text-tm-teal underline">
              📄 {doc.title} — view
            </a>
          )}
          <label className="btn-ghost w-fit cursor-pointer text-sm">
            {busy === "upload" ? "Uploading…" : doc ? "Replace PDF" : "Upload PDF"}
            <input type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        </section>

        {/* Slides */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Slides ({slides.length})</h2>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={addSlide}>+ Add slide</button>
          </div>
          {slides.map((s, i) => (
            <div key={i} className="card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-tm-ink/50">Slide {i + 1}</span>
                <div className="flex gap-1 text-sm">
                  <button className="rounded px-2 py-1 hover:bg-tm-mist" onClick={() => moveSlide(i, -1)}>↑</button>
                  <button className="rounded px-2 py-1 hover:bg-tm-mist" onClick={() => moveSlide(i, 1)}>↓</button>
                  <button className="rounded px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => removeSlide(i)}>Delete</button>
                </div>
              </div>
              <input className="input" placeholder="Slide title" value={s.title}
                onChange={(e) => setSlide(i, { title: e.target.value })} />
              <textarea className="input min-h-24" placeholder="Slide text shown to the contractor" value={s.body}
                onChange={(e) => setSlide(i, { body: e.target.value })} />
              <textarea className="input min-h-16" placeholder="Narration (spoken by 'Play voice') — optional" value={s.narration}
                onChange={(e) => setSlide(i, { narration: e.target.value })} />
            </div>
          ))}
        </section>

        {/* Questions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Knowledge check ({questions.length})</h2>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={addQuestion}>+ Add question</button>
          </div>
          {questions.length === 0 && (
            <p className="text-sm text-tm-ink/50">No questions yet. Add at least one so completion isn&apos;t just &quot;watched&quot;.</p>
          )}
          {questions.map((q, qi) => (
            <div key={qi} className="card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-tm-ink/50">Question {qi + 1}</span>
                <button className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50" onClick={() => removeQuestion(qi)}>Delete</button>
              </div>
              <input className="input" placeholder="Question prompt" value={q.prompt}
                onChange={(e) => setQ(qi, { prompt: e.target.value })} />
              <div className="space-y-2">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${qi}`} checked={o.isCorrect} onChange={() => setCorrect(qi, oi)}
                      className="accent-tm-teal" title="Mark correct" />
                    <input className="input flex-1" placeholder={`Option ${oi + 1}`} value={o.label}
                      onChange={(e) => setOption(qi, oi, { label: e.target.value })} />
                    {q.options.length > 2 && (
                      <button className="rounded px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => removeOption(qi, oi)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button className="text-sm font-medium text-tm-teal" onClick={() => addOption(qi)}>+ Add option</button>
              <p className="text-xs text-tm-ink/40">Select the radio next to the correct answer.</p>
            </div>
          ))}
        </section>
      </main>

      {/* sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="text-sm">
            {msg && (
              <span className={msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}>{msg.text}</span>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost" disabled={busy !== null} onClick={onSave}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button className="btn-accent" disabled={busy !== null} onClick={onPublish}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
