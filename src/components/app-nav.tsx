"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeLink } from "./mode-link";
import { Icon, Logo, type IconName } from "./ui/icons";

type Item = { href: string; label: string; icon: IconName; mode?: "diet" };

const MAIN: Item[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/gym", label: "Gym", icon: "gym" },
  { href: "/feed", label: "Feed", icon: "users" },
  { href: "/progress", label: "Progressi", icon: "chart" },
  { href: "/diet", label: "Dieta", icon: "fork", mode: "diet" },
];

export function AppNav({ name }: { name: string }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  const side = (it: Item) => {
    const cls = `flex h-12 items-center gap-3 rounded-2xl px-3 text-[17px] font-semibold transition-colors ${
      isActive(it.href) ? "bg-fg text-onfg" : "text-muted hover:bg-surface hover:text-fg"
    }`;
    return it.mode ? (
      <ModeLink key={it.href} href={it.href} mode={it.mode} className={cls}>
        <Icon name={it.icon} />
        {it.label}
      </ModeLink>
    ) : (
      <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? "page" : undefined} className={cls}>
        <Icon name={it.icon} />
        {it.label}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop: barra laterale */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-bg px-4 py-6 md:flex">
        <Link href="/home" aria-label="G.YM, vai alla Home" className="mb-8 flex items-center gap-2.5 px-3">
          <Logo size={30} />
          <span className="num text-[32px] font-bold leading-none">G.YM</span>
        </Link>
        <nav aria-label="Principale" className="flex flex-col gap-1">
          {MAIN.map(side)}
        </nav>
        <Link
          href="/profile"
          aria-current={isActive("/profile") ? "page" : undefined}
          className={`mt-auto flex h-12 items-center gap-3 rounded-2xl px-3 font-semibold ${isActive("/profile") ? "bg-fg text-onfg" : "text-muted hover:bg-surface hover:text-fg"}`}
        >
          <Icon name="user" />
          <span className="truncate">{name}</span>
        </Link>
      </aside>

      {/* Mobile: barra in basso */}
      <nav aria-label="Principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {MAIN.map((it) => {
            const cls = `relative flex h-16 flex-col items-center justify-center gap-0.5 text-[12.5px] font-semibold ${isActive(it.href) ? "text-fg" : "text-muted"}`;
            const inner = (
              <>
                {isActive(it.href) && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-fg" />}
                <Icon name={it.icon} size={24} />
                {it.label}
              </>
            );
            return (
              <li key={it.href}>
                {it.mode ? (
                  <ModeLink href={it.href} mode={it.mode} className={cls}>
                    {inner}
                  </ModeLink>
                ) : (
                  <Link href={it.href} aria-current={isActive(it.href) ? "page" : undefined} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
