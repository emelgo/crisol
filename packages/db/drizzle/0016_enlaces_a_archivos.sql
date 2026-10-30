CREATE TABLE "file_embeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"source_page_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"file_id" uuid,
	"name" text NOT NULL,
	"name_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_embeds" ADD CONSTRAINT "file_embeds_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_embeds" ADD CONSTRAINT "file_embeds_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_embeds" ADD CONSTRAINT "file_embeds_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_embeds" ADD CONSTRAINT "file_embeds_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_embeds_source_document_id_index" ON "file_embeds" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "file_embeds_file_id_index" ON "file_embeds" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_embeds_unresolved" ON "file_embeds" USING btree ("world_id","name_key") WHERE "file_embeds"."file_id" is null;