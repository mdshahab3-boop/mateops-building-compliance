import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createInduction } from "../actions";
import { BrandBadge } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function NewInductionPage() {
  await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <BrandBadge />
          <Link href="/admin" className="btn-ghost px-3 py-2 text-sm">← Dashboard</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-extrabold">New induction</h1>
        <p className="mt-1 text-sm text-tm-ink/60">
          Give it a name and type. You&apos;ll add the PDF, slides and questions next.
        </p>
        <form action={createInduction} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="input" placeholder="e.g. Shared Facilities Site Induction" required />
          </div>
          <div>
            <label className="label" htmlFor="contentType">Type</label>
            <select id="contentType" name="contentType" className="input" defaultValue="site_induction">
              <option value="site_induction">Site Induction</option>
              <option value="house_rules">House Rules</option>
              <option value="traffic_management">Traffic Management Plan</option>
              <option value="emergency">Emergency Procedures</option>
              <option value="general">General</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">Create &amp; open builder</button>
        </form>
      </main>
    </div>
  );
}
