import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CommentSection } from "@/components/comment-section";
import { PostActions } from "@/components/post-actions";
import { PostCard } from "@/components/post-card";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { getPost } from "@/modules/social/service";

export const metadata: Metadata = { title: "Post" };
export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const data = await getPost(user.id, id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/feed" className="inline-flex items-center gap-1 text-muted hover:text-fg">
          <Icon name="left" size={18} /> Feed
        </Link>
        {data.post.isMine && <PostActions postId={id} />}
      </div>
      <PostCard post={data.post} tz={user.timezone} detail />
      <CommentSection postId={id} initial={data.comments} me={{ id: user.id, name: user.displayName }} />
    </div>
  );
}
