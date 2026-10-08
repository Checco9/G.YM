import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-[22px] bg-surface p-5 ${className}`} {...rest} />;
}

/** Numero grande con etichetta: il linguaggio visivo delle statistiche. */
export function Stat({
  label,
  value,
  unit,
  note,
  className = "",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-sm text-muted">{label}</div>
      <div className="num mt-0.5 flex items-baseline gap-1.5 text-[40px] font-semibold leading-none">
        {value}
        {unit && <span className="text-lg font-medium text-muted">{unit}</span>}
      </div>
      {note && <div className="mt-1.5 text-sm text-muted">{note}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between first:mt-0">
      <h2 className="num text-[26px] font-semibold leading-none">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line p-8 text-center">
      <div className="num text-2xl font-semibold">{title}</div>
      {text && <p className="mx-auto mt-1.5 max-w-sm text-muted">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
