import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DeleteWorkoutButton } from "@/components/delete-workout-button";
import { PrList, WorkoutExercises, WorkoutHeading, WorkoutStats } from "@/components/workout-detail";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { loadHistory } from "@/modules/stats/repository";
import { buildWorkoutDetail, getWorkoutNotes } from "@/modules/stats/service";
import { z } from "zod";
import { LinkButton } from "@/components/ui/button";
import { getPostIdForWorkout } from "@/modules/social/service";

export const metadata: Metadata = { title: "Dettaglio allenamento" };
export const dynamic = "force-dynamic";

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const [history, notes, postId] = await Promise.all([loadHistory(user.id), getWorkoutNotes(user.id, id), getPostIdForWorkout(user.id, id)]);
  const detail = buildWorkoutDetail(history, id, notes);
  if (!detail) notFound();

  return (
    <div className="space-y-5">
      <Link href="/gym/history" className="inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Storico
      </Link>
      <WorkoutHeading w={detail} tz={user.timezone} />
      <LinkButton href={postId ? `/feed/${postId}` : `/feed/new?workout=${id}`} variant="secondary" icon={postId ? "users" : "share"} className="w-full md:w-auto">
        {postId ? "Vedi il post nel feed" : "Condividi nel feed"}
      </LinkButton>
      <WorkoutStats w={detail} />
      <PrList prs={detail.prs} />
      <WorkoutExercises w={detail} />
      <DeleteWorkoutButton id={detail.id} />
    </div>
  );
}
