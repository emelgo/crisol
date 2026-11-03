ALTER TABLE "documents" DROP CONSTRAINT "documents_kind";--> statement-breakpoint
ALTER TABLE "page_tabs" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "page_tabs" ADD CONSTRAINT "page_tabs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_kind" CHECK ("documents"."kind" in ('body', 'secret', 'note', 'tab'));