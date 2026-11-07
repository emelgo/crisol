CREATE TABLE "foundry_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"package" text NOT NULL,
	"document_id" text NOT NULL,
	"scene_id" uuid,
	"page_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foundry_origins_worldId_kind_package_documentId_unique" UNIQUE("world_id","kind","package","document_id")
);
--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "prepared" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "pins" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD CONSTRAINT "foundry_origins_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD CONSTRAINT "foundry_origins_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD CONSTRAINT "foundry_origins_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foundry_origins_world_id_index" ON "foundry_origins" USING btree ("world_id");