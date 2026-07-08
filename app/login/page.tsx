import Link from "next/link";
import { login } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="rounded-[28px] bg-white px-11 py-12 shadow-shell">
      <span className="font-display text-base font-bold text-ink">Meally</span>
      <h1 className="mt-2 font-display text-[28px] font-bold text-ink">Log in</h1>
      <p className="mt-2 text-sm text-ink-soft">Welcome back.</p>

      {params.error === "connection" && (
        <p className="mt-4 text-sm font-medium text-coral-text">
          Couldn&apos;t connect. Check your internet connection and try again.
        </p>
      )}
      {params.error && params.error !== "connection" && (
        <p className="mt-4 text-sm font-medium text-coral-text">
          Wrong email or password. Try again.
        </p>
      )}

      <form action={login} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="from" value={params.from ?? "/"} />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          Email
          <input
            type="email"
            name="email"
            required
            autoFocus
            className="rounded-xl border-[1.5px] border-border-light px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          Password
          <input
            type="password"
            name="password"
            required
            className="rounded-xl border-[1.5px] border-border-light px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
        </label>
        <SubmitButton
          pendingText="Logging in..."
          className="mt-2 w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-white hover:bg-primary-hover"
        >
          Log in
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-ink-soft">
        No account yet?{" "}
        <Link href="/signup" className="font-semibold text-primary-hover">
          Sign up
        </Link>
      </p>
    </div>
  );
}
