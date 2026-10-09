import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PlanEditor } from "@/components/plan-editor";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { getExercises } from "@/modules/exercises/service";
import { getPlan } from "@/modules/workouts/service";

export const metadata: Metadata = { title: "Modifica scheda" };
export const dynamic = "force-dynamic";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const [plan, exercises] = await Promise.all([getPlan(user.id, id), getExercises(user.id)]);
  if (!plan) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/gym" className="mb-4 inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Schede
      </Link>
      <h1 className="num mb-6 text-5xl font-semibold leading-none">Modifica scheda</h1>
      <PlanEditor
        planId={plan.id}
        exercises={exercises}
        initial={{
          name: plan.name,
          notes: plan.notes,
          exercises: plan.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, targetSets: e.targetSets, targetReps: e.targetReps })),
        }}
      />
    </div>
  );
}
