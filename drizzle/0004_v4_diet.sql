CREATE TABLE "diet_goals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kcal" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"water_ml" integer DEFAULT 2000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diet_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "food_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"logged_on" date NOT NULL,
	"meal" text NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"unit" text DEFAULT 'g' NOT NULL,
	"kcal" numeric(8, 2) NOT NULL,
	"protein" numeric(8, 2) NOT NULL,
	"carbs" numeric(8, 2) NOT NULL,
	"fat" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"slug" text,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"unit" text DEFAULT 'g' NOT NULL,
	"kcal" numeric(8, 2) NOT NULL,
	"protein" numeric(8, 2) NOT NULL,
	"carbs" numeric(8, 2) NOT NULL,
	"fat" numeric(8, 2) NOT NULL,
	"serving_size" numeric(8, 2),
	"serving_label" text,
	"barcode" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "water_logs" (
	"user_id" uuid NOT NULL,
	"logged_on" date NOT NULL,
	"ml" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "water_logs_user_id_logged_on_pk" PRIMARY KEY("user_id","logged_on")
);
--> statement-breakpoint
ALTER TABLE "water_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "diet_goals" ADD CONSTRAINT "diet_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_entries_user_day_idx" ON "food_entries" USING btree ("user_id","logged_on");--> statement-breakpoint
CREATE INDEX "food_entries_user_created_idx" ON "food_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_slug_uq" ON "foods" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "foods_owner_idx" ON "foods" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode");