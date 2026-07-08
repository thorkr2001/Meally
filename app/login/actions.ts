"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");

  const supabase = await createClient();

  // signInWithPassword() can throw (rather than return { error }) if the
  // Supabase Auth API itself is unreachable — a transient network blip
  // between Vercel and Supabase, not a wrong-password case. Without this,
  // that throws past this action into Next's generic error page instead of
  // a message the user can act on.
  let error;
  try {
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    redirect(`/login?error=connection&from=${encodeURIComponent(from)}`);
  }

  if (error) {
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  redirect(from || "/");
}
