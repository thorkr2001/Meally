"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today", icon: "dot" },
  { href: "/meal-plan", label: "Meal Plan", icon: "grid" },
  { href: "/profile", label: "Profile", icon: "ring" },
] as const;

function NavIcon({ icon }: { icon: (typeof TABS)[number]["icon"] }) {
  if (icon === "dot") return <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-current" />;
  if (icon === "grid") {
    return (
      <span className="grid h-[10px] w-[10px] shrink-0 grid-cols-2 gap-[2px]">
        <span className="rounded-[1px] bg-current" />
        <span className="rounded-[1px] bg-current" />
        <span className="rounded-[1px] bg-current" />
        <span className="rounded-[1px] bg-current" />
      </span>
    );
  }
  return <span className="h-[11px] w-[11px] shrink-0 rounded-full border-[1.8px] border-current" />;
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex w-[220px] flex-shrink-0 flex-col gap-8 bg-sidebar px-5 py-8">
      <div className="font-display text-[22px] font-bold text-white">Meally</div>
      <nav className="flex flex-col gap-1.5">
        {TABS.map((tab) => {
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
