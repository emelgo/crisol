-- Los capítulos de los libros de un sistema (ADR-0025): texto corrido en Markdown, con su puesto en el libro
CREATE TABLE "system_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"system_id" uuid NOT NULL,
	"source" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"markdown" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_chapters" ADD CONSTRAINT "system_chapters_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_chapters" ADD CONSTRAINT "system_chapters_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_chapters" ADD CONSTRAINT "system_chapters_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_chapters_system_id_source_position_index" ON "system_chapters" USING btree ("system_id","source","position");