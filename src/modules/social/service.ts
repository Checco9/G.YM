import { and, desc, eq, inArray, sql, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { comments, postReactions, posts, profiles, workouts } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import { loadHistory } from "@/modules/stats/repository";
import { buildWorkoutDetail } from "@/modules/stats/service";
import { buildSnapshot } from "./domain/snapshot";
import { commentSchema, createPostSchema, reactionSchema, updatePostSchema } from "./schemas";
import { getStorage } from "./storage";
import { REACTION_KEYS, type FeedComment, type FeedPost, type ReactionKey } from "./types";

const FEED_PAGE = 10;
const CURSOR_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}(:\d{2})?\|[0-9a-f-]{36}$/;

const photoUrl = (path: string | null) => (path ? (getStorage()?.url(path) ?? null) : null);

// ───────── Lettura ─────────

type Row = {
  id: string;
  userId: string;
  authorName: string;
  caption: string;
  photoPath: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  snapshot: FeedPost["snapshot"];
  workoutId: string;
  createdAt: Date;
  createdRaw: string;
  commentCount: number;
};

const postColumns = {
  id: posts.id,
  userId: posts.userId,
  authorName: profiles.displayName,
  caption: posts.caption,
  photoPath: posts.photoPath,
  photoWidth: posts.photoWidth,
  photoHeight: posts.photoHeight,
  snapshot: posts.snapshot,
  workoutId: posts.workoutId,
  createdAt: posts.createdAt,
  // il cursore usa il timestamp testuale con i microsecondi: con un Date JS (millisecondi) si perderebbero righe
  createdRaw: sql<string>`${posts.createdAt}::text`,
  commentCount: sql<number>`(select count(*)::int from comments c where c.post_id = ${posts.id})`,
};

async function withReactions(viewerId: string, rows: Row[]): Promise<FeedPost[]> {
  const counts = rows.length
    ? await db()
        .select({
          postId: postReactions.postId,
          key: postReactions.key,
          count: sql<number>`count(*)::int`,
          mine: sql<boolean>`bool_or(${postReactions.userId} = ${viewerId})`,
        })
        .from(postReactions)
        .where(inArray(postReactions.postId, rows.map((r) => r.id)))
        .groupBy(postReactions.postId, postReactions.key)
    : [];
  return rows.map((r) => ({
    id: r.id,
    author: { id: r.userId, name: r.authorName },
    isMine: r.userId === viewerId,
    caption: r.caption,
    photoUrl: photoUrl(r.photoPath),
    photoWidth: r.photoWidth,
    photoHeight: r.photoHeight,
    snapshot: r.snapshot,
    workoutId: r.workoutId,
    createdAt: r.createdAt.toISOString(),
    commentCount: r.commentCount,
    reactions: REACTION_KEYS.map((key) => {
      const c = counts.find((x) => x.postId === r.id && x.key === key);
      return { key, count: c?.count ?? 0, mine: c?.mine ?? false };
    }),
  }));
}

/** Una pagina del feed, dal più recente. Solo 2 query, qualunque sia il numero di post. */
export async function getFeedPage(viewerId: string, cursor?: string | null) {
  if (cursor && !CURSOR_RE.test(cursor)) throw badRequest("Cursore non valido");
  const [ts, id] = cursor ? cursor.split("|") : [null, null];
  const rows = (await db()
    .select(postColumns)
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.userId))
    .where(cursor ? sql`(${posts.createdAt}, ${posts.id}) < (${ts}::timestamptz, ${id}::uuid)` : undefined)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(FEED_PAGE + 1)) as Row[];
  const more = rows.length > FEED_PAGE;
  const page = rows.slice(0, FEED_PAGE);
  const last = page[page.length - 1];
  return {
    posts: await withReactions(viewerId, page),
    nextCursor: more && last ? `${last.createdRaw}|${last.id}` : null,
  };
}

export async function getPost(viewerId: string, postId: string): Promise<{ post: FeedPost; comments: FeedComment[] } | null> {
  const [rows, list] = await Promise.all([
    db()
      .select(postColumns)
      .from(posts)
      .innerJoin(profiles, eq(profiles.userId, posts.userId))
      .where(eq(posts.id, postId))
      .limit(1) as unknown as Promise<Row[]>,
    db()
      .select({ id: comments.id, userId: comments.userId, name: profiles.displayName, body: comments.body, createdAt: comments.createdAt })
      .from(comments)
      .innerJoin(profiles, eq(profiles.userId, comments.userId))
      .where(eq(comments.postId, postId))
      .orderBy(asc(comments.createdAt))
      .limit(300),
  ]);
  if (!rows.length) return null;
  const [post] = await withReactions(viewerId, rows);
  return {
    post,
    comments: list.map((c) => ({
      id: c.id,
      author: { id: c.userId, name: c.name },
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      canDelete: c.userId === viewerId || post.author.id === viewerId,
    })),
  };
}

/** Allenamenti conclusi che l'utente non ha ancora condiviso (gli ultimi 20). */
export async function listShareableWorkouts(userId: string) {
  return db()
    .select({ id: workouts.id, name: workouts.name, startedAt: workouts.startedAt })
    .from(workouts)
    .leftJoin(posts, eq(posts.workoutId, workouts.id))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), sql`${posts.id} is null`))
    .orderBy(desc(workouts.startedAt))
    .limit(20);
}

export async function getPostIdForWorkout(userId: string, workoutId: string): Promise<string | null> {
  const [r] = await db().select({ id: posts.id }).from(posts).where(and(eq(posts.workoutId, workoutId), eq(posts.userId, userId))).limit(1);
  return r?.id ?? null;
}

// ───────── Scrittura ─────────

function assertOwnPhoto(user: SessionUser, photo: { path: string } | null | undefined) {
  if (photo && !photo.path.startsWith(`${user.id}/`)) throw forbidden("Foto non valida");
  if (photo && !getStorage()) throw badRequest("Le foto non sono attive su questa installazione");
}

export async function createPost(user: SessionUser, input: unknown) {
  const d = createPostSchema.parse(input);
  assertOwnPhoto(user, d.photo);
  await rateLimit(`post:${user.id}`, 30, 3600);

  // lo storico è memoizzato per richiesta; il calcolo dello snapshot avviene una sola volta, qui
  const history = await loadHistory(user.id);
  const detail = buildWorkoutDetail(history, d.workoutId, null);
  if (!detail) throw notFound("Allenamento non trovato");

  const [row] = await db()
    .insert(posts)
    .values({
      userId: user.id,
      workoutId: d.workoutId,
      caption: d.caption,
      photoPath: d.photo?.path ?? null,
      photoWidth: d.photo?.width ?? null,
      photoHeight: d.photo?.height ?? null,
      snapshot: buildSnapshot(detail),
    })
    .onConflictDoNothing({ target: posts.workoutId })
    .returning({ id: posts.id });
  if (!row) throw conflict("Hai già condiviso questo allenamento");
  return { id: row.id };
}

export async function updatePost(user: SessionUser, postId: string, input: unknown) {
  const d = updatePostSchema.parse(input);
  assertOwnPhoto(user, d.photo);
  const [cur] = await db().select({ userId: posts.userId, photoPath: posts.photoPath }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!cur) throw notFound("Post non trovato");
  if (cur.userId !== user.id) throw forbidden();

  const photoChange = d.photo === undefined ? {} : d.photo === null ? { photoPath: null, photoWidth: null, photoHeight: null } : { photoPath: d.photo.path, photoWidth: d.photo.width, photoHeight: d.photo.height };
  await db().update(posts).set({ caption: d.caption, updatedAt: new Date(), ...photoChange }).where(eq(posts.id, postId));
  if (d.photo !== undefined && cur.photoPath && cur.photoPath !== d.photo?.path) await getStorage()?.remove([cur.photoPath]);
}

export async function deletePost(user: SessionUser, postId: string) {
  const [cur] = await db().delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, user.id))).returning({ photoPath: posts.photoPath });
  if (!cur) throw notFound("Post non trovato");
  if (cur.photoPath) await getStorage()?.remove([cur.photoPath]);
}

async function assertPostExists(postId: string) {
  const [p] = await db().select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!p) throw notFound("Post non trovato");
}

export async function addComment(user: SessionUser, postId: string, input: unknown) {
  const { body } = commentSchema.parse(input);
  await rateLimit(`comment:${user.id}`, 30, 600);
  await assertPostExists(postId);
  const [row] = await db().insert(comments).values({ postId, userId: user.id, body }).returning({ id: comments.id, createdAt: comments.createdAt });
  return { id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function deleteComment(user: SessionUser, commentId: string) {
  const [c] = await db()
    .select({ userId: comments.userId, postOwner: posts.userId })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!c) throw notFound("Commento non trovato");
  if (c.userId !== user.id && c.postOwner !== user.id) throw forbidden();
  await db().delete(comments).where(eq(comments.id, commentId));
}

export async function setReaction(user: SessionUser, postId: string, input: unknown) {
  const { key, on } = reactionSchema.parse(input);
  await rateLimit(`react:${user.id}`, 120, 600);
  if (on) {
    await assertPostExists(postId);
    await db().insert(postReactions).values({ postId, userId: user.id, key }).onConflictDoNothing();
  } else {
    await db().delete(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.userId, user.id), eq(postReactions.key, key)));
  }
}

export type { ReactionKey };
