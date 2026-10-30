CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"hash" text NOT NULL,
	"storage_key" text NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_kind" CHECK ("files"."kind" in ('image', 'pdf', 'other'))
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_world_id_index" ON "files" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_name" ON "files" USING btree ("world_id",lower("name")) WHERE "files"."deleted_at" is null;