"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { MODE_EVENT, type Mode } from "./mode-transition";

/** Link che cambia modalità: mostra subito la schermata di passaggio. */
export function ModeLink({ mode, onClick, ...props }: ComponentProps<typeof Link> & { mode: Mode }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !(e.metaKey || e.ctrlKey || e.shiftKey)) window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }));
      }}
    />
  );
}
