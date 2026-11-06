-- pgvector, en la imagen propia de Postgres (docker/postgres)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "search_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"world_id" uuid,
	"source" text NOT NULL,
	"file_id" uuid,
	"page" integer,
	"document_id" uuid,
	"page_id" uuid,
	"heading_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"hash" text NOT NULL,
	"embedding" vector(384),
	CONSTRAINT "search_chunks_source" CHECK ("search_chunks"."source" in ('book', 'page'))
);
--> statement-breakpoint
ALTER TABLE "search_chunks" ADD CONSTRAINT "search_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_chunks" ADD CONSTRAINT "search_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_chunks" ADD CONSTRAINT "search_chunks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_chunks_file_id_index" ON "search_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "search_chunks_document_id_index" ON "search_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "search_chunks_world_id_index" ON "search_chunks" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "search_chunks_pending" ON "search_chunks" USING btree ("id") WHERE "search_chunks"."embedding" is null;--> statement-breakpoint
CREATE INDEX "search_chunks_embedding" ON "search_chunks" USING hnsw ("embedding" vector_cosine_ops);