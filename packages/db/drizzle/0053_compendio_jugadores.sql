ALTER TABLE "campaigns" ADD COLUMN "hidden_types" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_creatures" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;