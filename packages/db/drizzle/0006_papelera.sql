ALTER TABLE "campaigns" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "campaigns_deleted_at_index" ON "campaigns" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "worlds_deleted_at_index" ON "worlds" USING btree ("deleted_at");