"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import { BrandBadge } from "@/components/Brand";

const initial: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initial);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandBadge />
        </div>
        <form action={formAction} className="card space-y-4 p-8">
          <h1 className="text-xl font-bold">Admin sign in</h1>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {state.error}
            </p>
          )}

          <div>
            <label className="label" htmlFor="orgSlug">Workspace</label>
            <input id="orgSlug" name="orgSlug" defaultValue="tmms" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" className="input" />
          </div>

          <SubmitButton />

          <p className="rounded-lg bg-tm-mist px-4 py-3 text-xs text-tm-ink/60">
            Demo login — workspace <b>tmms</b>, <b>admin@tmmanagementservices.com.au</b> / <b>TMdemo2026!</b>
          </p>
        </form>
      </div>
    </main>
  );
}
