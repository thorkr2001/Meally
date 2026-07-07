import Link from "next/link";
import { signup } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirm?: string }>;
}) {
  const params = await searchParams;

  if (params.confirm) {
    return (
      <div className="rounded-[28px] bg-white px-11 py-12 shadow-shell">
        <span className="font-display text-base font-bold text-ink">Meally</span>
        <h1 className="mt-2 font-display text-[28px] font-bold text-ink">Check your email</h1>
        <p className="mt-2 text-sm text-ink-soft">
          We sent you a confirmation link. Click it, then come back and log in.
        </p>
        <Link
          href="/login"
          className="mt-6 block w-full rounded-2xl bg-primary px-4 py-3.5 text-center text-[15px] font-bold text-white hover:bg-primary-hover"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] bg-white px-11 py-12 shadow-shell">
      <span className="font-display text-base font-bold text-ink">Meally</span>
      <h1 className="mt-2 font-display text-[28px] font-bold text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-ink-soft">Get your own personalized nutrition and meal plan.</p>

      {params.error && <p className="mt-4 text-sm font-medium text-coral-text">{params.error}</p>}

      <form action={signup} className="mt-6 flex flex-col gap-4">
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
            minLength={6}
            className="rounded-xl border-[1.5px] border-border-light px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
        </label>
        <SubmitButton
          pendingText="Creating account..."
          className="mt-2 w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-white hover:bg-primary-hover"
        >
          Sign up
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary-hover">
          Log in
        </Link>
      </p>
    </div>
  );
}
