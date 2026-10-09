import { sql } from "drizzle-orm";
import type { PostSnapshot } from "../modules/social/types";
import {
  jsonb,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Convenzioni
 * - RLS attiva su TUTTE le tabelle (`.enableRLS()`): se il database è su Supabase, l'API pubblica non può
 *   leggerle (nessuna policy = accesso negato). L'app si collega con il ruolo `postgres`, che bypassa l'RLS.
 *   Ogni nuova tabella deve avere `.enableRLS()`.
 * - Ogni tabella di proprietà dell'utente ha (direttamente o tramite padre) uno `user_id`.
 * - I pesi sono sempre in kg. La conversione è un tema di UI.
 * - Nessun dato derivato viene salvato (volume, PR, livelli, streak, valori attuali degli obiettivi).
 * - Le future funzionalità (amici, post, cibo, ...) si aggiungono con nuove tabelle e migrazioni,
 *   senza modificare quelle qui sotto.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const kg = (name: string) => numeric(name, { precision: 7, scale: 2, mode: "number" });

// ───────── Identità e sicurezza ─────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 del token presente nel cookie: il token in chiaro non è mai salvato. */
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
).enableRLS();

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  sex: text("sex", { enum: ["male", "female"] }),
  birthDate: date("birth_date"),
  heightCm: integer("height_cm"),
  timezone: text("timezone").notNull().default("Europe/Rome"),
  weeklyTarget: integer("weekly_target").notNull().default(3),
  /** Partecipa alla classifica locale (opt-in: di default nessuno vede i tuoi numeri). */
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ───────── Catalogo ─────────

export const muscleGroups = pgTable("muscle_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = esercizio di sistema, valorizzato = esercizio personale */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug"),
    name: text("name").notNull(),
    category: text("category", { enum: ["compound", "isolation", "bodyweight"] })
      .notNull()
      .default("compound"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("exercises_slug_uq").on(t.slug),
    index("exercises_owner_idx").on(t.ownerId),
  ],
).enableRLS();

export const exerciseMuscles = pgTable(
  "exercise_muscles",
  {
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    muscleId: text("muscle_id").notNull().references(() => muscleGroups.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["primary", "secondary"] }).notNull().default("primary"),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.muscleId] })],
).enableRLS();

/** Le regole dei livelli sono dati: soglia minima del rapporto 1RM / peso corporeo. */
export const strengthStandards = pgTable(
  "strength_standards",
  {
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    sex: text("sex", { enum: ["male", "female"] }).notNull(),
    level: text("level", { enum: ["beginner", "intermediate", "advanced", "elite"] }).notNull(),
    minRatio: numeric("min_ratio", { precision: 6, scale: 3, mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.sex, t.level] })],
).enableRLS();

// ───────── Schede ─────────

export const workoutPlans = pgTable(
  "workout_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workout_plans_user_idx").on(t.userId)],
).enableRLS();

export const workoutPlanExercises = pgTable(
  "workout_plan_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull().references(() => workoutPlans.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
    position: integer("position").notNull(),
    targetSets: integer("target_sets").notNull().default(3),
    targetReps: integer("target_reps").notNull().default(10),
  },
  (t) => [index("wpe_plan_idx").on(t.planId, t.position)],
).enableRLS();

// ───────── Allenamenti ─────────

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
    /** Copia del nome della scheda al momento dell'avvio: lo storico resta leggibile anche se la scheda cambia. */
    name: text("name").notNull(),
    status: text("status", { enum: ["in_progress", "completed"] }).notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("workouts_user_started_idx").on(t.userId, t.startedAt),
    index("workouts_user_status_idx").on(t.userId, t.status),
  ],
).enableRLS();

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
    position: integer("position").notNull(),
  },
  (t) => [index("we_workout_idx").on(t.workoutId, t.position), index("we_exercise_idx").on(t.exerciseId)],
).enableRLS();

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    weightKg: kg("weight_kg").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
  },
  (t) => [
    index("sets_we_idx").on(t.workoutExerciseId, t.position),
    check("sets_weight_nonneg", sql`${t.weightKg} >= 0`),
    check("sets_reps_nonneg", sql`${t.reps} >= 0`),
  ],
).enableRLS();

// ───────── Corpo ─────────

export const bodyWeightEntries = pgTable(
  "body_weight_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    measuredOn: date("measured_on").notNull(),
    weightKg: kg("weight_kg").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("bwe_user_date_idx").on(t.userId, t.measuredOn)],
).enableRLS();

// ───────── Obiettivi ─────────

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["exercise_weight", "body_weight", "workout_count", "exercise_1rm", "streak_weeks", "total_volume"],
    }).notNull(),
    exerciseId: uuid("exercise_id").references(() => exercises.id),
    title: text("title").notNull(),
    // volumi e conteggi possono superare i 99.999: colonna più larga di `kg`
    startValue: numeric("start_value", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    targetValue: numeric("target_value", { precision: 12, scale: 2, mode: "number" }).notNull(),
    deadline: date("deadline"),
    createdAt: createdAt(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
).enableRLS();

// ───────── Gamification (V2) ─────────
// XP, livello account e badge NON sono salvati: sono derivati dallo storico (modules/gamification).

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["workouts", "volume", "sets", "prs"] }).notNull(),
    title: text("title").notNull(),
    targetValue: numeric("target_value", { precision: 10, scale: 2, mode: "number" }).notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("challenges_user_idx").on(t.userId, t.endsOn)],
).enableRLS();

// ───────── Community (V3) ─────────
// Nessun sistema di amicizie: siamo in pochi, il feed è visibile a tutti gli iscritti.

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Un post per allenamento. Se l'allenamento viene eliminato, sparisce anche il post. */
    workoutId: uuid("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    caption: text("caption").notNull().default(""),
    /** Percorso nello storage (`<userId>/<uuid>.jpg`); l'URL si ricava, non si salva. */
    photoPath: text("photo_path"),
    photoWidth: integer("photo_width"),
    photoHeight: integer("photo_height"),
    snapshot: jsonb("snapshot").$type<PostSnapshot>().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("posts_workout_uq").on(t.workoutId),
    index("posts_feed_idx").on(t.createdAt.desc(), t.id.desc()),
    index("posts_user_idx").on(t.userId),
  ],
).enableRLS();

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt), index("comments_user_idx").on(t.userId)],
).enableRLS();

/** Una riga per (post, utente, reazione): si può mettere più di una reazione diversa. */
export const postReactions = pgTable(
  "post_reactions",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.key] }), index("reactions_post_idx").on(t.postId)],
).enableRLS();

// ───────── Dieta (V4) ─────────

const nutri = (name: string) => numeric(name, { precision: 8, scale: 2, mode: "number" });

/**
 * Catalogo alimenti. Valori per 100 g (o 100 ml se `unit` = ml).
 * ownerId nullo = catalogo di sistema, valorizzato = alimento creato dall'utente.
 */
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug"),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category"),
    unit: text("unit", { enum: ["g", "ml"] }).notNull().default("g"),
    kcal: nutri("kcal").notNull(),
    protein: nutri("protein").notNull(),
    carbs: nutri("carbs").notNull(),
    fat: nutri("fat").notNull(),
    /** Porzione tipica in g/ml (es. 60 per "1 uovo") */
    servingSize: nutri("serving_size"),
    servingLabel: text("serving_label"),
    /** Per il futuro lettore di codici a barre */
    barcode: text("barcode"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("foods_slug_uq").on(t.slug), index("foods_owner_idx").on(t.ownerId), index("foods_barcode_idx").on(t.barcode)],
).enableRLS();

/**
 * Diario alimentare. I valori nutrizionali sono salvati per la quantità registrata: modificare o
 * eliminare un alimento non altera i giorni passati e il riepilogo di un giorno è una semplice somma.
 */
export const foodEntries = pgTable(
  "food_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Giorno nel fuso orario dell'utente */
    loggedOn: date("logged_on").notNull(),
    meal: text("meal", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: nutri("quantity").notNull(),
    unit: text("unit", { enum: ["g", "ml", "porzione"] }).notNull().default("g"),
    kcal: nutri("kcal").notNull(),
    protein: nutri("protein").notNull(),
    carbs: nutri("carbs").notNull(),
    fat: nutri("fat").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("food_entries_user_day_idx").on(t.userId, t.loggedOn), index("food_entries_user_created_idx").on(t.userId, t.createdAt)],
).enableRLS();

/** Acqua: un totale per utente e per giorno. */
export const waterLogs = pgTable(
  "water_logs",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    loggedOn: date("logged_on").notNull(),
    ml: integer("ml").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.loggedOn] })],
).enableRLS();

export const dietGoals = pgTable("diet_goals", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  kcal: integer("kcal").notNull(),
  proteinG: integer("protein_g").notNull(),
  carbsG: integer("carbs_g").notNull(),
  fatG: integer("fat_g").notNull(),
  waterMl: integer("water_ml").notNull().default(2000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
