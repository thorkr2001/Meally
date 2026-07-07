export const NAV_TABS = [
  { href: "/today", label: "Today", icon: "dot" },
  { href: "/meal-plan", label: "Meal Plan", icon: "grid" },
  { href: "/profile", label: "Profile", icon: "ring" },
] as const;

export function NavIcon({ icon }: { icon: (typeof NAV_TABS)[number]["icon"] }) {
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
