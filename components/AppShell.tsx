"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

const NO_SHELL_PREFIXES = ["/onboarding", "/plan"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShell = NO_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (noShell) {
    return <div className="w-full max-w-xl">{children}</div>;
  }

  return (
    <div className="flex w-full max-w-[1280px] overflow-hidden rounded-[28px] bg-shell-bg shadow-shell">
      <Sidebar />
      <main className="min-w-0 flex-1 px-8 py-9 sm:px-11">{children}</main>
    </div>
  );
}
