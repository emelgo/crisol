CREATE TABLE "file_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"world_id" uuid,
	"parent_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_parent_id_file_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."file_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_folders_world_id_index" ON "file_folders" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "file_folders_organization_id_index" ON "file_folders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "file_folders_parent_id_index" ON "file_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_folders_name" ON "file_folders" USING btree (coalesce("world_id", "organization_id"),coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_file_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."file_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_folder_id_index" ON "files" USING btree ("folder_id");