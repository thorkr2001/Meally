"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, NavIcon } from "@/components/navTabs";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden w-[220px] flex-shrink-0 flex-col gap-8 bg-sidebar px-5 py-8 md:flex">
      <div className="font-display text-[22px] font-bold text-white">Meally</div>
      <nav className="flex flex-col gap-1.5">
        {NAV_TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm ${
                active ? "bg-nav-active font-semibold text-white" : "font-medium text-white/70 hover:text-white"
              }`}
            >
              <NavIcon icon={tab.icon} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
