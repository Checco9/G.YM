"use client";

import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import type { FeedPost } from "@/modules/social/types";
import { Button } from "./ui/button";
import { PostCard } from "./post-card";

export function FeedList({ initial, nextCursor, tz }: { initial: FeedPost[]; nextCursor: string | null; tz: string }) {
  const [posts, setPosts] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    setError(null);
    try {
      const r = await call<{ posts: FeedPost[]; nextCursor: string | null }>("GET", `/api/feed?cursor=${encodeURIComponent(cursor)}`);
      setPosts((p) => [...p, ...r.posts.filter((x) => !p.some((y) => y.id === x.id))]);
      setCursor(r.nextCursor);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} tz={tz} />
      ))}
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      {cursor && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={more} disabled={busy}>
            {busy ? "Caricamento…" : "Mostra altri post"}
          </Button>
        </div>
      )}
    </div>
  );
}
