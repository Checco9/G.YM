"use client";

import { useEffect, type ReactNode } from "react";
import { IconButton } from "./button";

/** Bottom sheet su mobile, finestra centrata su desktop. Esc o tap fuori per chiudere. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="fade-in absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-surface md:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="num text-2xl font-semibold">{title}</h2>
          <IconButton icon="x" label="Chiudi" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && (
          <div className="px-5 pt-2" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
