"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkTabs({ tabs }: { tabs: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Sezioni" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold leading-10 transition-colors ${
              active ? "bg-fg text-onfg" : "bg-surface text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
