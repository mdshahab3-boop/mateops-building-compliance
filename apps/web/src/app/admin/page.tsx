import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAdminOverview } from "@/lib/queries";
import { logoutAction } from "./actions";
import { BrandBadge } from "@/components/Brand";
import { QrImage } from "@/components/QrImage";
import { CopyLink } from "@/components/CopyLink";

export const dynamic = "force-dynamic";

const CONTENT_LABEL: Record<string, string> = {
  site_induction: "Site Induction",
  house_rules: "House Rules",
  traffic_management: "Traffic Plan",
  emergency: "Emergency",
  general: "General",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    passed: "bg-emerald-100 text-emerald-800",
    compliant: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-700",
    in_progress: "bg-amber-100 text-amber-800",
    abandoned: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default async function AdminDashboard() {
  const principal = await requireUser();
  const base = process.env.PUBLIC_URL ?? "http://localhost:3000";
  const overview = await getAdminOverview(principal.organisationId!, principal.userId);

  const totalCompletions =
    overview?.inductions.reduce((n, i) => n + i.completions, 0) ?? 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandBadge />
          <div className="flex items-center gap-4">
            <span className="text-sm text-tm-ink/60">{principal.fullName}</span>
            <form action={logoutAction}>
              <button className="btn-ghost px-3 py-2 text-sm">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-extrabold">{overview?.propertyName ?? "Dashboard"}</h1>
        <p className="mt-1 text-tm-ink/60">Contractor induction & compliance overview.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm text-tm-ink/60">Published inductions</p>
            <p className="mt-1 text-3xl font-extrabold text-tm-teal">{overview?.inductions.length ?? 0}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-tm-ink/60">Completed inductions</p>
            <p className="mt-1 text-3xl font-extrabold text-tm-teal">{totalCompletions}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-tm-ink/60">Recent activity</p>
            <p className="mt-1 text-3xl font-extrabold text-tm-teal">{overview?.recentCompletions.length ?? 0}</p>
          </div>
        </div>

        {/* Inductions */}
        <div className="mt-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Inductions & share links</h2>
            <p className="text-sm text-tm-ink/60">Send a link or show the QR — contractors complete it on their phone.</p>
          </div>
          <Link href="/admin/inductions/new" className="btn-primary text-sm">+ New induction</Link>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {overview?.inductions.map((ind) => {
            const url = `${base}/i/${ind.enrolToken ?? ""}`;
            return (
              <div key={ind.inductionId} className="card flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-tm-teal/10 px-2.5 py-0.5 text-xs font-semibold text-tm-teal">
                    {CONTENT_LABEL[ind.contentType] ?? ind.contentType}
                  </span>
                  <span className="text-xs text-tm-ink/40">v{ind.versionNumber}</span>
                </div>
                <h3 className="mt-3 font-bold leading-snug">{ind.title}</h3>
                <p className="mt-1 text-sm text-tm-ink/60">
                  {ind.slideCount} slides · {ind.questionCount} questions · {ind.completions} completed
                </p>
                <div className="mt-4 flex justify-center">
                  <QrImage value={url} size={150} />
                </div>
                <div className="mt-4">
                  {ind.enrolToken ? (
                    <CopyLink url={url} />
                  ) : (
                    <p className="text-xs text-red-600">No active link</p>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/admin/inductions/${ind.inductionId}`} className="btn-ghost flex-1 text-sm">
                    Edit
                  </Link>
                  {ind.enrolToken && (
                    <Link href={`/i/${ind.enrolToken}`} className="btn-accent flex-1 text-sm" target="_blank">
                      Preview ↗
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Completions */}
        <h2 className="mt-12 text-lg font-bold">Compliance records</h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-tm-ink/50">
                <th className="px-4 py-3 font-medium">Contractor</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Induction</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Completed</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recentCompletions.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-tm-ink/50">
                    No completions yet. Open an induction link above to try it.
                  </td>
                </tr>
              )}
              {overview?.recentCompletions.map((r) => (
                <tr key={r.verifyToken} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{r.contractorName}</td>
                  <td className="px-4 py-3 text-tm-ink/70">{r.company ?? "—"}</td>
                  <td className="px-4 py-3 text-tm-ink/70">{r.inductionTitle}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">{r.score ?? "—"}%</td>
                  <td className="px-4 py-3 text-tm-ink/70">
                    {r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-AU") : "—"}
                  </td>
                  <td className="px-4 py-3 text-tm-ink/70">
                    {r.validUntil ? new Date(r.validUntil).toLocaleDateString("en-AU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/verify/${r.verifyToken}`} className="text-tm-teal underline" target="_blank">
                      verify
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
