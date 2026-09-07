import Link from "next/link";
import { BrandBadge } from "@/components/Brand";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <BrandBadge />
        <Link href="/admin/login" className="btn-ghost">
          Admin sign in
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-10 pb-20">
        <p className="text-tm-orange font-semibold">Shared Facilities Compliance</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight text-tm-ink sm:text-5xl">
          Contractor inductions that prove who was inducted, on what, and when.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-tm-ink/70">
          Turn your Site Induction, House Rules and Traffic Management Plan into a
          short guided induction. Contractors watch, answer a few questions, sign a
          declaration, and get a certificate — and security can verify compliance
          with a QR scan.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/login" className="btn-primary">
            Admin dashboard
          </Link>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[
            ["1. Watch", "A guided, narrated slideshow built from the building's real documents."],
            ["2. Confirm", "Short knowledge check, then contractor details and a signed declaration."],
            ["3. Verify", "An immutable certificate and a QR code security can scan on site."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <h3 className="font-bold text-tm-teal">{t}</h3>
              <p className="mt-2 text-sm text-tm-ink/70">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
