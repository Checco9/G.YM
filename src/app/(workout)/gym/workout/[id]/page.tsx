import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { WorkoutRunner } from "@/components/workout-runner";
import { requireUser } from "@/modules/auth/session";
import { getExercises } from "@/modules/exercises/service";
import { getWorkout, lastSetsFor } from "@/modules/workouts/service";

export const metadata: Metadata = { title: "Allenamento" };
export const dynamic = "force-dynamic";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const workout = await getWorkout(user.id, id);
  if (!workout) notFound();
  if (workout.status === "completed") redirect(`/gym/history/${id}`);

  const [exercises, prevMap] = await Promise.all([
    getExercises(user.id),
    lastSetsFor(user.id, workout.exercises.map((e) => e.exerciseId), id),
  ]);

  return (
    <WorkoutRunner
      workout={{
        id: workout.id,
        name: workout.name,
        startedAt: workout.startedAt.toISOString(),
        exercises: workout.exercises.map((e) => ({ id: e.id, exerciseId: e.exerciseId, name: e.name, sets: e.sets })),
      }}
      prev={Object.fromEntries(prevMap)}
      exercises={exercises}
    />
  );
}
