"use client";

import Link from "next/link";
import { useState } from "react";
import { call } from "@/lib/client-api";
import { fmtDate, fmtDuration, fmtSet, fmtVolume, timeAgo } from "@/lib/format";
import { REACTIONS, type FeedPost, type ReactionKey } from "@/modules/social/types";
import { Icon } from "./ui/icons";

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="num flex shrink-0 items-center justify-center rounded-full bg-surface2 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function PostCard({ post, tz, detail = false }: { post: FeedPost; tz: string; detail?: boolean }) {
  const [reactions, setReactions] = useState(post.reactions);
  const [imgOk, setImgOk] = useState(true);
  const s = post.snapshot;

  /** Aggiornamento immediato; se il server rifiuta si torna indietro. */
  async function toggle(key: ReactionKey) {
    const before = reactions;
    const cur = reactions.find((r) => r.key === key)!;
    setReactions(reactions.map((r) => (r.key === key ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)));
    try {
      await call("PUT", `/api/posts/${post.id}/reactions`, { key, on: !cur.mine });
    } catch {
      setReactions(before);
    }
  }

  return (
    <article className="rounded-[22px] bg-surface p-4 md:p-5" aria-label={`Post di ${post.author.name}`}>
      <header className="flex items-center gap-3">
        <Avatar name={post.author.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold">
            {post.author.name}
            {post.isMine && <span className="ml-2 text-sm font-normal text-muted">tu</span>}
          </div>
          <div className="text-sm text-muted" suppressHydrationWarning>
            {timeAgo(new Date(post.createdAt))}
          </div>
        </div>
      </header>

      {post.caption && <p className="mt-3 whitespace-pre-wrap break-words text-[17px] leading-snug">{post.caption}</p>}

      {post.photoUrl && imgOk && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface2">
          {/* immagine servita dalla CDN di Supabase: dimensioni note, caricamento pigro, nessun salto di layout */}
          <img
            src={post.photoUrl}
            alt={`Foto di ${post.author.name} dell'allenamento ${s.name}`}
            width={post.photoWidth ?? undefined}
            height={post.photoHeight ?? undefined}
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="mx-auto max-h-[560px] w-full object-cover"
            style={post.photoWidth && post.photoHeight ? { aspectRatio: `${post.photoWidth} / ${post.photoHeight}` } : undefined}
          />
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-surface2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="num truncate text-[26px] font-semibold leading-tight">{s.name}</div>
            <div className="text-sm text-muted">{fmtDate(s.startedAt, tz, { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
          {s.prCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fg px-2.5 py-1 text-xs font-bold text-onfg">
              <Icon name="trophy" size={14} />
              {s.prCount === 1 ? "1 record" : `${s.prCount} record`}
            </span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Durata", fmtDuration(s.durationMin)],
            ["Serie", String(s.setCount)],
            ["Volume", fmtVolume(s.volume)],
          ].map(([k, v]) => (
            <div key={k}>
              <dd className="num text-2xl font-semibold leading-none">{v}</dd>
              <dt className="mt-0.5 text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        {s.highlights.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-3">
            {s.highlights.map((h) => (
              <li key={h.name} className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[15px]">
                  {h.pr && <Icon name="trophy" size={14} />}
                  <span className="truncate">{h.name}</span>
                </span>
                <span className="num shrink-0 text-lg">{fmtSet(h.weightKg, h.reps)}</span>
              </li>
            ))}
            {s.exerciseCount > s.highlights.length && <li className="text-sm text-muted">e altri {s.exerciseCount - s.highlights.length} esercizi</li>}
          </ul>
        )}
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {reactions.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => toggle(r.key)}
            aria-pressed={r.mine}
            aria-label={`Reazione ${REACTIONS[r.key]}${r.count ? `, ${r.count}` : ""}`}
            className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-xl transition-transform active:scale-90 ${
              r.mine ? "bg-fg text-onfg" : "bg-surface2"
            }`}
          >
            <span>{REACTIONS[r.key]}</span>
            {r.count > 0 && <span className="num text-lg font-semibold">{r.count}</span>}
          </button>
        ))}
        {!detail && (
          <Link
            href={`/feed/${post.id}`}
            className="ml-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-muted hover:text-fg"
          >
            <Icon name="comment" size={20} />
            {post.commentCount > 0 ? `${post.commentCount} ${post.commentCount === 1 ? "commento" : "commenti"}` : "Commenta"}
          </Link>
        )}
      </footer>
    </article>
  );
}
