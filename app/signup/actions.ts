"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();

  // signUp() can throw (rather than return { error }) if the Supabase Auth
  // API itself is unreachable — a transient network blip between Vercel and
  // Supabase — rather than a normal validation failure.
  let data, error;
  try {
    ({ data, error } = await supabase.auth.signUp({ email, password }));
  } catch {
    redirect("/signup?error=Couldn't connect. Check your internet connection and try again.");
  }

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Email confirmation is enabled in the Supabase project: signUp succeeds
  // but returns no session until the user clicks the confirmation link.
  if (!data.session) {
    redirect("/signup?confirm=1");
  }

  redirect("/");
}
