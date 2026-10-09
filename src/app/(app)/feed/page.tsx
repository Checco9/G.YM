import type { Metadata } from "next";
import { FeedList } from "@/components/feed-list";
import { EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { requireUser } from "@/modules/auth/session";
import { getFeedPage } from "@/modules/social/service";

export const metadata: Metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireUser();
  const { posts, nextCursor } = await getFeedPage(user.id);
  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="num text-5xl font-semibold leading-none">Feed</h1>
        <LinkButton href="/feed/new" icon="plus" size="sm">
          Nuovo post
        </LinkButton>
      </div>
      {posts.length === 0 ? (
        <EmptyState
          title="Ancora nessun post"
          text="Condividi un allenamento con una foto e due righe: gli altri potranno commentare e lasciarti una reazione."
          action={<LinkButton href="/feed/new" icon="plus">Crea il primo post</LinkButton>}
        />
      ) : (
        <FeedList initial={posts} nextCursor={nextCursor} tz={user.timezone} />
      )}
    </div>
  );
}
