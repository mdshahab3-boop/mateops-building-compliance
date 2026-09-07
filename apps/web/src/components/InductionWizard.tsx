"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InductionRun } from "@/lib/queries";
import { submitInduction } from "@/app/i/[token]/actions";
import { SignaturePad } from "@/components/SignaturePad";
import { BrandBadge } from "@/components/Brand";

type Step = "intro" | "slides" | "quiz" | "details" | "sign";
const STEP_LABELS: Record<Step, string> = {
  intro: "Start",
  slides: "Watch",
  quiz: "Questions",
  details: "Your details",
  sign: "Sign",
};
const ORDER: Step[] = ["intro", "slides", "quiz", "details", "sign"];

export function InductionWizard({ token, run }: { token: string; run: InductionRun }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [slideIdx, setSlideIdx] = useState(0);
  const [maxSlide, setMaxSlide] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [details, setDetails] = useState({ fullName: "", company: "", phone: "", vehicleRego: "" });
  const [signatureName, setSignatureName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failScore, setFailScore] = useState<number | null>(null);
  const speakingRef = useRef(false);

  const stepIndex = ORDER.indexOf(step);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (speakingRef.current) {
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onend = () => {
      speakingRef.current = false;
      setSpeaking(false);
    };
    speakingRef.current = true;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }
  function stopSpeak() {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }

  const allAnswered = run.questions.every((q) => answers[q.id]);
  const detailsValid = details.fullName.trim().length > 1;
  const canSign = signatureName.trim().length > 1 && signatureData.length > 0 && agreed;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitInduction({
        token,
        fullName: details.fullName,
        company: details.company,
        phone: details.phone,
        vehicleRego: details.vehicleRego,
        answers,
        signatureName,
        signatureDataUrl: signatureData,
      });
      if (!res.ok) {
        setError(res.error);
      } else if (res.passed) {
        router.push(`/verify/${res.verifyToken}?welcome=1`);
        return;
      } else {
        setFailScore(res.score);
        setStep("quiz");
      }
    } catch {
      setError("Something went wrong submitting your induction. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <BrandBadge />
        </div>
      </header>

      {/* progress */}
      <div className="mx-auto max-w-2xl px-5 pt-5">
        <div className="flex items-center gap-1.5">
          {ORDER.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-tm-teal" : "bg-black/10"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-tm-ink/50">
          Step {stepIndex + 1} of {ORDER.length} · {STEP_LABELS[step]}
        </p>
      </div>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {/* INTRO */}
        {step === "intro" && (
          <div className="card p-6">
            <span className="rounded-full bg-tm-orange/10 px-3 py-1 text-xs font-semibold text-tm-orange">
              {run.propertyName}
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">{run.inductionTitle}</h1>
            <p className="mt-3 text-tm-ink/70">
              Before you work on site you need to complete this short induction. You&apos;ll watch
              {" "}{run.slides.length} quick slides, answer {run.questions.length} questions, enter your
              details and sign. It takes about 5 minutes.
            </p>
            <button className="btn-primary mt-6 w-full" onClick={() => setStep("slides")}>
              Start induction
            </button>
          </div>
        )}

        {/* SLIDES */}
        {step === "slides" && (
          <div className="card p-6">
            <div className="flex items-center justify-between text-sm text-tm-ink/50">
              <span>Slide {slideIdx + 1} of {run.slides.length}</span>
              <button
                onClick={() => speak(run.slides[slideIdx]?.narration ?? run.slides[slideIdx]?.body ?? "")}
                className="font-medium text-tm-teal"
              >
                {speaking ? "⏹ Stop voice" : "▶ Play voice"}
              </button>
            </div>

            <div className="mt-4 min-h-[220px]">
              <h2 className="text-xl font-bold text-tm-teal">{run.slides[slideIdx]?.title}</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-tm-ink/80">
                {run.slides[slideIdx]?.body}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                className="btn-ghost"
                disabled={slideIdx === 0}
                onClick={() => {
                  stopSpeak();
                  setSlideIdx((i) => Math.max(0, i - 1));
                }}
              >
                Back
              </button>
              {slideIdx < run.slides.length - 1 ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    stopSpeak();
                    const next = slideIdx + 1;
                    setSlideIdx(next);
                    setMaxSlide((m) => Math.max(m, next));
                  }}
                >
                  Next slide
                </button>
              ) : (
                <button className="btn-accent" onClick={() => { stopSpeak(); setStep("quiz"); }}>
                  Continue to questions
                </button>
              )}
            </div>
          </div>
        )}

        {/* QUIZ */}
        {step === "quiz" && (
          <div className="space-y-4">
            {failScore !== null && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                You scored {failScore}%. Please review your answers — you need {run.passScore}% to pass.
              </p>
            )}
            <div className="card p-6">
              <h2 className="text-xl font-bold">Knowledge check</h2>
              <p className="mt-1 text-sm text-tm-ink/60">Choose the best answer for each question.</p>
              <div className="mt-5 space-y-6">
                {run.questions.map((q, qi) => (
                  <div key={q.id}>
                    <p className="font-semibold">{qi + 1}. {q.prompt}</p>
                    <div className="mt-2 space-y-2">
                      {q.options.map((o) => (
                        <label
                          key={o.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                            answers[q.id] === o.id
                              ? "border-tm-teal bg-tm-teal/5"
                              : "border-black/10 hover:bg-tm-mist"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === o.id}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                            className="accent-tm-teal"
                          />
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-between gap-3">
                <button className="btn-ghost" onClick={() => setStep("slides")}>Rewatch slides</button>
                <button className="btn-primary" disabled={!allAnswered} onClick={() => setStep("details")}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DETAILS */}
        {step === "details" && (
          <div className="card p-6">
            <h2 className="text-xl font-bold">Your details</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Full name *</label>
                <input className="input" value={details.fullName}
                  onChange={(e) => setDetails({ ...details, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">Company</label>
                <input className="input" value={details.company}
                  onChange={(e) => setDetails({ ...details, company: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mobile</label>
                  <input className="input" value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Vehicle rego</label>
                  <input className="input" value={details.vehicleRego}
                    onChange={(e) => setDetails({ ...details, vehicleRego: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-between gap-3">
              <button className="btn-ghost" onClick={() => setStep("quiz")}>Back</button>
              <button className="btn-primary" disabled={!detailsValid} onClick={() => setStep("sign")}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* SIGN */}
        {step === "sign" && (
          <div className="card p-6">
            <h2 className="text-xl font-bold">Declaration & signature</h2>
            <p className="mt-3 rounded-lg bg-tm-mist p-4 text-sm leading-relaxed text-tm-ink/80">
              {run.declarationText}
            </p>

            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" checked={agreed} className="mt-1 accent-tm-teal"
                onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have read and agree to the declaration above.</span>
            </label>

            <div className="mt-4">
              <label className="label">Type your full name</label>
              <input className="input" value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)} />
            </div>

            <div className="mt-4">
              <label className="label">Signature</label>
              <SignaturePad onChange={setSignatureData} />
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
            )}

            <div className="mt-6 flex justify-between gap-3">
              <button className="btn-ghost" onClick={() => setStep("details")}>Back</button>
              <button className="btn-accent" disabled={!canSign || submitting} onClick={handleSubmit}>
                {submitting ? "Submitting…" : "Complete induction"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
