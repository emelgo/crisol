-- Los sonidos del mapa (docs/specs/sonido-mapa.md): los de cada escena (del mundo) y cuáles tiene apagados cada campaña
CREATE TABLE "scene_sounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"file_id" uuid,
	"track_id" uuid,
	"url" text,
	"radius" double precision DEFAULT 6 NOT NULL,
	"volume" double precision DEFAULT 1 NOT NULL,
	"easing" boolean DEFAULT true NOT NULL,
	"walls" text DEFAULT 'block' NOT NULL,
	"dark_only" boolean DEFAULT false NOT NULL,
	CONSTRAINT "scene_sounds_one_source" CHECK (num_nonnulls("scene_sounds"."file_id", "scene_sounds"."track_id", "scene_sounds"."url") <= 1)
);
--> statement-breakpoint
ALTER TABLE "scene_states" ADD COLUMN "sounds" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_sounds" ADD CONSTRAINT "scene_sounds_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_sounds" ADD CONSTRAINT "scene_sounds_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_sounds" ADD CONSTRAINT "scene_sounds_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_sounds" ADD CONSTRAINT "scene_sounds_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_sounds" ADD CONSTRAINT "scene_sounds_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_sounds" ADD CONSTRAINT "scene_sounds_track_id_sound_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."sound_tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_sounds_scene_id_index" ON "scene_sounds" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_sounds_file_id_index" ON "scene_sounds" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "scene_sounds_track_id_index" ON "scene_sounds" USING btree ("track_id");