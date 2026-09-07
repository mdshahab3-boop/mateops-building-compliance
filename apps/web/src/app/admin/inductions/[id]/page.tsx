import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getInductionForEdit } from "@/lib/builder";
import { InductionBuilder } from "@/components/InductionBuilder";
import { newVersion } from "../actions";
import { BrandBadge } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: { id: string } }) {
  const p = await requireUser();
  const data = await getInductionForEdit(p.organisationId!, p.userId, params.id);
  if (!data) notFound();

  if (data.isEditable) {
    return <InductionBuilder initial={data} />;
  }

  // Latest version is published — read-only. Offer a new editable version.
  const createNewVersion = newVersion.bind(null, params.id);
  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <BrandBadge />
          <Link href="/admin" className="btn-ghost px-3 py-2 text-sm">← Dashboard</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          Published · version {data.versionNumber}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold">{data.induction.title}</h1>
        <p className="mt-1 text-sm text-tm-ink/60">
          {data.slides.length} slides · {data.questions.length} questions · pass mark {data.passScore}%
        </p>
        <p className="mt-4 rounded-lg bg-tm-mist p-4 text-sm text-tm-ink/70">
          Published versions are locked so existing certificates stay valid. To change the content,
          create a new version — it starts as a copy you can edit, then publish as version {data.versionNumber + 1}.
        </p>
        <form action={createNewVersion} className="mt-6">
          <button type="submit" className="btn-primary">Create a new version to edit</button>
        </form>
      </main>
    </div>
  );
}
