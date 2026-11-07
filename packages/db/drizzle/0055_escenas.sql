CREATE TABLE "campaign_tables" (
	"campaign_id" uuid PRIMARY KEY NOT NULL,
	"open_scene_id" uuid,
	"presented_scene_id" uuid,
	"screen_hidden" boolean DEFAULT false NOT NULL,
	"camera" jsonb DEFAULT '{"mode":"follow"}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	CONSTRAINT "scene_states_campaignId_sceneId_unique" UNIQUE("campaign_id","scene_id")
);
--> statement-breakpoint
CREATE TABLE "scene_tiles" (
	"scene_id" uuid NOT NULL,
	"version" uuid NOT NULL,
	"level" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"storage_key" text NOT NULL,
	"bytes" integer NOT NULL,
	CONSTRAINT "scene_tiles_scene_id_version_level_x_y_pk" PRIMARY KEY("scene_id","version","level","x","y")
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"tab_id" uuid NOT NULL,
	"file_id" uuid,
	"width" integer,
	"height" integer,
	"tiles" jsonb,
	"grid" jsonb NOT NULL,
	"initial_view" jsonb,
	"imported" jsonb,
	CONSTRAINT "scenes_tabId_unique" UNIQUE("tab_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD CONSTRAINT "campaign_tables_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD CONSTRAINT "campaign_tables_open_scene_id_scenes_id_fk" FOREIGN KEY ("open_scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD CONSTRAINT "campaign_tables_presented_scene_id_scenes_id_fk" FOREIGN KEY ("presented_scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_states" ADD CONSTRAINT "scene_states_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_states" ADD CONSTRAINT "scene_states_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_states" ADD CONSTRAINT "scene_states_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_states" ADD CONSTRAINT "scene_states_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_states" ADD CONSTRAINT "scene_states_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tiles" ADD CONSTRAINT "scene_tiles_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_tab_id_page_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."page_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_states_scene_id_index" ON "scene_states" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scenes_world_id_index" ON "scenes" USING btree ("world_id");