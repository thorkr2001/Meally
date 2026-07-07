"use client";

export function ResetButton({ profileId, action }: { profileId: string; action: (formData: FormData) => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Reset all data and start onboarding over? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="profileId" value={profileId} />
      <button
        type="submit"
        className="w-full rounded-2xl border-[1.5px] border-dashed border-coral/60 px-4 py-3 text-[13px] font-semibold text-coral-text hover:bg-coral/5"
      >
        Reset app &amp; start over
      </button>
    </form>
  );
}
