DROP INDEX "search_chunks_pending";--> statement-breakpoint
ALTER TABLE "search_chunks" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "search_chunks" ADD COLUMN "failed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "search_chunks_pending" ON "search_chunks" USING btree ("id") WHERE "search_chunks"."embedding" is null and not "search_chunks"."failed";