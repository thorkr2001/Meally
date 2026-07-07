"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";

const NO_SHELL_PREFIXES = ["/onboarding", "/plan", "/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShell = NO_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (noShell) {
    return <div className="w-full max-w-xl">{children}</div>;
  }

  return (
    <div className="flex w-full max-w-[1280px] overflow-hidden bg-shell-bg sm:rounded-[28px] sm:shadow-shell">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-8 sm:py-9 md:pb-9">{children}</main>
      <BottomNav />
    </div>
  );
}
