"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeLink } from "./mode-link";
import { Icon, Logo, type IconName } from "./ui/icons";

const ITEMS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/diet", label: "Oggi", icon: "fork", exact: true },
  { href: "/diet/trends", label: "Andamento", icon: "chart" },
  { href: "/diet/foods", label: "Alimenti", icon: "apple" },
  { href: "/diet/goals", label: "Obiettivi", icon: "target" },
];

export function DietNav() {
  const path = usePathname();
  const active = (it: (typeof ITEMS)[number]) => (it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/"));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-bg px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-3">
          <Logo size={30} />
          <div>
            <div className="num text-[32px] font-bold leading-none">G.YM</div>
            <div className="mt-0.5 text-sm font-semibold text-muted">Dieta</div>
          </div>
        </div>
        <nav aria-label="Dieta" className="flex flex-col gap-1">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active(it) ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-2xl px-3 text-[17px] font-semibold transition-colors ${active(it) ? "bg-fg text-onfg" : "text-muted hover:bg-surface hover:text-fg"}`}
            >
              <Icon name={it.icon} />
              {it.label}
            </Link>
          ))}
        </nav>
        <ModeLink href="/home" mode="gym" className="mt-auto flex h-12 items-center gap-3 rounded-2xl bg-surface px-3 font-semibold hover:bg-surface2">
          <Icon name="swap" />
          Passa alla palestra
        </ModeLink>
      </aside>

      <nav aria-label="Dieta" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {ITEMS.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active(it) ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[12.5px] font-semibold ${active(it) ? "text-fg" : "text-muted"}`}
              >
                {active(it) && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-fg" />}
                <Icon name={it.icon} size={24} />
                {it.label}
              </Link>
            </li>
          ))}
          <li>
            <ModeLink href="/home" mode="gym" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[12.5px] font-semibold text-muted">
              <Icon name="gym" size={24} />
              Palestra
            </ModeLink>
          </li>
        </ul>
      </nav>
    </>
  );
}
