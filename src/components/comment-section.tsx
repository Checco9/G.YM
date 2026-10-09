"use client";

import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import type { FeedComment } from "@/modules/social/types";
import { Avatar } from "./post-card";
import { Button, IconButton } from "./ui/button";

export function CommentSection({ postId, initial, me }: { postId: string; initial: FeedComment[]; me: { id: string; name: string } }) {
  const [list, setList] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const r = await call<{ id: string; createdAt: string }>("POST", `/api/posts/${postId}/comments`, { body: text });
      setList((l) => [...l, { id: r.id, author: me, body: text, createdAt: r.createdAt, canDelete: true }]);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const before = list;
    setList(list.filter((c) => c.id !== id));
    try {
      await call("DELETE", `/api/comments/${id}`);
    } catch {
      setList(before);
    }
  }

  return (
    <section aria-label="Commenti" className="space-y-4">
      <h2 className="num text-2xl font-semibold">{list.length === 0 ? "Nessun commento" : `${list.length} ${list.length === 1 ? "commento" : "commenti"}`}</h2>
      <ul className="space-y-3">
        {list.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} size={36} />
            <div className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.author.name}</span>
                <span className="flex items-center text-xs text-muted" suppressHydrationWarning>
                  {timeAgo(new Date(c.createdAt))}
                  {c.canDelete && <IconButton icon="trash" label="Elimina commento" onClick={() => remove(c.id)} className="-mr-2 size-9" />}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={1}
          placeholder="Scrivi un commento"
          aria-label="Scrivi un commento"
          className="min-h-12 flex-1 resize-none rounded-2xl bg-surface2 px-4 py-3 outline-none ring-1 ring-transparent placeholder:text-muted/70 focus:ring-fg"
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          Invia
        </Button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
