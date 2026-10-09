import { DietNav } from "@/components/diet-nav";
import { requireUser } from "@/modules/auth/session";

/** Modalità Dieta: layout e codice separati dalla palestra, caricati solo quando serve. */
export default async function DietLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <DietNav />
      <div className="md:pl-60">
        <main className="page-pad mx-auto w-full max-w-5xl px-4 md:px-8" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
          {children}
        </main>
      </div>
    </>
  );
}
