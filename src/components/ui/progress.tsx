export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2.5 overflow-hidden rounded-full bg-surface2 ${className}`}
    >
      <div className="h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
