CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"target_value" numeric(10, 2) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "body_weight_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "muscle_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "strength_standards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workout_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workout_plan_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workout_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "leaderboard_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenges_user_idx" ON "challenges" USING btree ("user_id","ends_on");