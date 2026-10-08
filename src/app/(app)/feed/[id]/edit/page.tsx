import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PostComposer } from "@/components/post-composer";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { getPost } from "@/modules/social/service";
import { getStorage } from "@/modules/social/storage";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Modifica post" };
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const data = await getPost(user.id, id);
  if (!data) notFound();
  if (!data.post.isMine) redirect(`/feed/${id}`);
  const { post } = data;
  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/feed/${id}`} className="mb-4 inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Post
      </Link>
      <h1 className="num mb-6 text-5xl font-semibold leading-none">Modifica post</h1>
      <PostComposer
        postId={id}
        workout={{ id: post.workoutId, name: post.snapshot.name, date: fmtDate(post.snapshot.startedAt, user.timezone, { weekday: "long", day: "numeric", month: "long" }) }}
        initial={{ caption: post.caption, photoUrl: post.photoUrl }}
        photosEnabled={getStorage() !== null}
      />
    </div>
  );
}
