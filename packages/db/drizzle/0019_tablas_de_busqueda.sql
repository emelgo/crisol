CREATE TABLE "search_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"heading" text,
	"heading_id" text,
	"body" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('es_unaccent'::regconfig, coalesce(heading, '')), 'A') || setweight(to_tsvector('es_unaccent'::regconfig, body), 'B')) STORED
);
--> statement-breakpoint
CREATE TABLE "search_words" (
	"world_id" uuid NOT NULL,
	"word" text NOT NULL,
	CONSTRAINT "search_words_world_id_word_pk" PRIMARY KEY("world_id","word")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('es_unaccent'::regconfig, crisol_page_text(title, properties)), 'A')) STORED;--> statement-breakpoint
ALTER TABLE "search_sections" ADD CONSTRAINT "search_sections_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_sections" ADD CONSTRAINT "search_sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_sections" ADD CONSTRAINT "search_sections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_words" ADD CONSTRAINT "search_words_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_sections_document_id_index" ON "search_sections" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "search_sections_world_id_index" ON "search_sections" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "search_sections_tsv" ON "search_sections" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "search_words_trgm" ON "search_words" USING gin ("word" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pages_search" ON "pages" USING gin ("search_tsv");