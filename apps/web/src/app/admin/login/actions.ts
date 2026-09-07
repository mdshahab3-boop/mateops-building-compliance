"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, startSession } from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const orgSlug = String(formData.get("orgSlug") ?? "tmms").trim();

  if (!email || !password) return { error: "Enter your email and password." };

  const result = await authenticate(email, password, orgSlug);
  if (!result) return { error: "Invalid workspace, email or password." };

  const h = headers();
  await startSession(result.userId, {
    ip: h.get("x-forwarded-for"),
    userAgent: h.get("user-agent"),
  });
  redirect("/admin");
}
