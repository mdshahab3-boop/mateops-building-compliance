import Link from "next/link";
import { notFound } from "next/navigation";
import { getVerification } from "@/lib/queries";
import { BrandBadge } from "@/components/Brand";
import { QrImage } from "@/components/QrImage";

export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { welcome?: string };
}) {
  const v = await getVerification(params.token);
  if (!v) notFound();

  const base = process.env.PUBLIC_URL ?? "http://localhost:3000";
  const verifyUrl = `${base}/verify/${v.verifyToken}`;
  const compliant = v.status === "passed";
  const expired = v.validUntil ? new Date(v.validUntil) < new Date() : false;
  const welcome = searchParams.welcome === "1";

  return (
    <main className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <BrandBadge />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        {welcome && (
          <div className="mb-6 rounded-2xl bg-emerald-600 p-6 text-center text-white">
            <p className="text-3xl">✓</p>
            <h1 className="mt-1 text-2xl font-extrabold">Induction complete</h1>
            <p className="mt-1 text-white/90">You&apos;re now inducted. Show this certificate at sign-in.</p>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className={`px-6 py-4 text-white ${compliant && !expired ? "bg-tm-teal" : "bg-red-600"}`}>
            <p className="text-sm font-medium uppercase tracking-wide opacity-90">Compliance status</p>
            <p className="text-2xl font-extrabold">
              {compliant && !expired ? "COMPLIANT" : expired ? "EXPIRED" : "NOT COMPLIANT"}
            </p>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
            <dl className="space-y-3 text-sm">
              <Row label="Contractor" value={v.contractorName} />
              <Row label="Company" value={v.company ?? "—"} />
              <Row label="Property" value={v.propertyName} />
              <Row label="Induction" value={`${v.inductionTitle} (v${v.versionNumber})`} />
              <Row label="Score" value={v.score != null ? `${v.score}%` : "—"} />
              <Row label="Completed" value={fmt(v.completedAt)} />
              <Row label="Valid until" value={fmt(v.validUntil)} />
              <Row label="Certificate #" value={v.certificateNumber ?? "—"} />
            </dl>
            <div className="flex flex-col items-center gap-2">
              <QrImage value={verifyUrl} size={140} />
              <span className="text-xs text-tm-ink/50">Scan to verify</span>
            </div>
          </div>

          {v.certificateNumber && (
            <div className="border-t border-black/5 px-6 py-4">
              <Link href={`/c/${v.verifyToken}`} className="btn-primary w-full" target="_blank">
                Download certificate (PDF)
              </Link>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-tm-ink/40">
          Verified via T&M Management Services · {verifyUrl}
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-black/5 pb-2 last:border-0">
      <dt className="text-tm-ink/50">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
