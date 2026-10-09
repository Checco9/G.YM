/** Scheletro mostrato subito durante la navigazione, mentre il server prepara la pagina. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Caricamento" className="animate-pulse space-y-4">
      <div className="h-12 w-48 rounded-2xl bg-surface" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-surface" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-[22px] bg-surface" />
        <div className="h-40 rounded-[22px] bg-surface" />
        <div className="h-40 rounded-[22px] bg-surface md:col-span-2" />
      </div>
    </div>
  );
}
