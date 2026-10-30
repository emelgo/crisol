CREATE TABLE "page_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"source_page_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"target_page_id" uuid,
	"target_title" text NOT NULL,
	"target_key" text NOT NULL,
	"anchor" text
);
--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_page_id_pages_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_links_source_document_id_index" ON "page_links" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "page_links_target_page_id_index" ON "page_links" USING btree ("target_page_id");--> statement-breakpoint
CREATE INDEX "page_links_unresolved" ON "page_links" USING btree ("world_id","target_key") WHERE "page_links"."target_page_id" is null;