/** Interruttore accessibile. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-fg" : "bg-surface2"}`}
    >
      <span className={`absolute top-1 size-6 rounded-full transition-all ${checked ? "left-7 bg-onfg" : "left-1 bg-muted"}`} />
    </button>
  );
}
