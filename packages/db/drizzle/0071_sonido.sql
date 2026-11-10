-- El sonido (docs/specs/sonido.md): las listas del mundo con sus pistas y lo que suena en cada campaña
CREATE TABLE "sound_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"mode" text NOT NULL,
	"fade" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"playlist_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"file_id" uuid,
	"youtube_id" text,
	"duration" double precision NOT NULL,
	"volume" double precision DEFAULT 1 NOT NULL,
	"loop" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sound_tracks_one_source" CHECK (num_nonnulls("sound_tracks"."file_id", "sound_tracks"."youtube_id") <= 1)
);
--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD COLUMN "sound" jsonb;--> statement-breakpoint
ALTER TABLE "sound_playlists" ADD CONSTRAINT "sound_playlists_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_playlists" ADD CONSTRAINT "sound_playlists_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_playlists" ADD CONSTRAINT "sound_playlists_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD CONSTRAINT "sound_tracks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD CONSTRAINT "sound_tracks_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD CONSTRAINT "sound_tracks_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD CONSTRAINT "sound_tracks_playlist_id_sound_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."sound_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD CONSTRAINT "sound_tracks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sound_playlists_world_id_index" ON "sound_playlists" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "sound_tracks_playlist_id_index" ON "sound_tracks" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "sound_tracks_file_id_index" ON "sound_tracks" USING btree ("file_id");