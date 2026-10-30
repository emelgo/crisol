ALTER TABLE "worlds" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "cover" jsonb;