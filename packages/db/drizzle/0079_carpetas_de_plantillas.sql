-- Carpetas para ordenar las plantillas (ADR-0024), como las de archivos; los puestos, con collation "C" (como 0075)
CREATE TABLE "template_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"position" text COLLATE "C",
	"color" text,
	"icon" text
);
--> statement-breakpoint
ALTER TABLE "page_templates" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "page_templates" ADD COLUMN "position" text COLLATE "C";--> statement-breakpoint
ALTER TABLE "template_folders" ADD CONSTRAINT "template_folders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_folders" ADD CONSTRAINT "template_folders_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_folders" ADD CONSTRAINT "template_folders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_folders" ADD CONSTRAINT "template_folders_parent_id_template_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."template_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_folders_organization_id_index" ON "template_folders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "template_folders_parent_id_index" ON "template_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_folders_name" ON "template_folders" USING btree ("organization_id",coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_folder_id_template_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."template_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_templates_folder_id_index" ON "page_templates" USING btree ("folder_id");