ALTER TABLE "page_templates" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "worlds_templates" ON "worlds" USING btree ("organization_id") WHERE "worlds"."purpose" = 'templates';