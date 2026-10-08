import { requireUser } from "@/modules/auth/session";

/** Layout a tutto schermo, senza navigazione: serve a non distrarre durante l'allenamento. */
export default async function WorkoutLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <main className="mx-auto w-full max-w-5xl px-4 md:px-8">{children}</main>;
}
