import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PostComposer } from "@/components/post-composer";
import { Card, EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { getPostIdForWorkout, listShareableWorkouts } from "@/modules/social/service";
import { getStorage } from "@/modules/social/storage";
import { getWorkout } from "@/modules/workouts/service";
import { fmtDate } from "@/lib/format";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Nuovo post" };
export const dynamic = "force-dynamic";

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ workout?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const dateOpts = { weekday: "long", day: "numeric", month: "long" } as const;

  if (sp.workout && z.string().uuid().safeParse(sp.workout).success) {
    const existing = await getPostIdForWorkout(user.id, sp.workout);
    if (existing) redirect(`/feed/${existing}`);
    const w = await getWorkout(user.id, sp.workout);
    if (w && w.status === "completed") {
      return (
        <div className="mx-auto max-w-xl">
          <Link href="/feed" className="mb-4 inline-flex items-center gap-1 text-muted hover:text-fg">
            <Icon name="left" size={18} /> Feed
          </Link>
          <h1 className="num mb-6 text-5xl font-semibold leading-none">Nuovo post</h1>
          <PostComposer workout={{ id: w.id, name: w.name, date: fmtDate(w.startedAt, user.timezone, dateOpts) }} photosEnabled={getStorage() !== null} />
        </div>
      );
    }
  }

  const list = await listShareableWorkouts(user.id);
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/feed" className="mb-4 inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Feed
      </Link>
      <h1 className="num mb-2 text-5xl font-semibold leading-none">Nuovo post</h1>
      <p className="mb-6 text-muted">Scegli l'allenamento da condividere. Puoi farlo anche a distanza di giorni.</p>
      {list.length === 0 ? (
        <EmptyState title="Nessun allenamento da condividere" text="Termina un allenamento e potrai raccontarlo qui." />
      ) : (
        <div className="space-y-2">
          {list.map((w) => (
            <Link key={w.id} href={`/feed/new?workout=${w.id}`}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <div className="num text-2xl font-semibold">{w.name}</div>
                  <div className="text-sm text-muted">{fmtDate(w.startedAt, user.timezone, dateOpts)}</div>
                </div>
                <Icon name="right" className="text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
