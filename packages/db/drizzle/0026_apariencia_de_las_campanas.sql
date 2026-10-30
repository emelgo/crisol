ALTER TABLE "campaigns" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cover" jsonb;