CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"state" "bytea" NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_kind" CHECK ("documents"."kind" in ('body', 'secret', 'note'))
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_page_id_index" ON "documents" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_one_body" ON "documents" USING btree ("page_id") WHERE "documents"."kind" = 'body';