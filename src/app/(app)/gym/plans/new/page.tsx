import type { Metadata } from "next";
import Link from "next/link";
import { PlanEditor } from "@/components/plan-editor";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { getExercises } from "@/modules/exercises/service";

export const metadata: Metadata = { title: "Nuova scheda" };
export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  const user = await requireUser();
  const exercises = await getExercises(user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/gym" className="mb-4 inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Schede
      </Link>
      <h1 className="num mb-6 text-5xl font-semibold leading-none">Nuova scheda</h1>
      <PlanEditor exercises={exercises} />
    </div>
  );
}
