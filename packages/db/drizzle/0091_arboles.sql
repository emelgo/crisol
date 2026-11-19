-- Los árboles genealógicos y los organigramas, como pestaña de una página (bloque B de los ajustes tras los módulos 8
-- a 10): sus nodos (una página o solo un nombre) y sus líneas, en dos listas. Y las cronologías, ya pestañas (0090),
-- dejan su nombre y su orden: son los de su pestaña
CREATE TABLE "trees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"tab_id" uuid NOT NULL,
	"layout" text DEFAULT 'family' NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "trees_tabId_unique" UNIQUE("tab_id")
);
--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_tab_id_page_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."page_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trees_world_id_index" ON "trees" USING btree ("world_id");--> statement-breakpoint
ALTER TABLE "chronologies" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "chronologies" DROP COLUMN "position";