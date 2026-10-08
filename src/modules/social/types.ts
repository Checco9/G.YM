/** Istantanea dei numeri di un allenamento al momento del post: il feed non deve ricalcolare nulla. */
export type PostSnapshot = {
  name: string;
  startedAt: string;
  durationMin: number | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
  prCount: number;
  /** fino a 4 esercizi in evidenza (prima quelli con record) con la serie migliore */
  highlights: { name: string; weightKg: number; reps: number; pr: boolean }[];
};

/** Reazioni disponibili. Nel database si salva la chiave, non l'emoji. */
export const REACTIONS = {
  flex: "💪🏻",
  fire: "🔥",
  clap: "👏",
  trophy: "🏆",
  heart: "❤️",
} as const;
export type ReactionKey = keyof typeof REACTIONS;
export const REACTION_KEYS = Object.keys(REACTIONS) as [ReactionKey, ...ReactionKey[]];

export type FeedPost = {
  id: string;
  author: { id: string; name: string };
  isMine: boolean;
  caption: string;
  photoUrl: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  snapshot: PostSnapshot;
  workoutId: string;
  createdAt: string;
  commentCount: number;
  reactions: { key: ReactionKey; count: number; mine: boolean }[];
};

export type FeedComment = { id: string; author: { id: string; name: string }; body: string; createdAt: string; canDelete: boolean };
