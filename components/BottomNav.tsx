"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, NavIcon } from "@/components/navTabs";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex justify-around bg-sidebar px-2 py-2.5 md:hidden">
      {NAV_TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] ${
              active ? "font-semibold text-white" : "font-medium text-white/60"
            }`}
          >
            <NavIcon icon={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
