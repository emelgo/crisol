-- El sonido de un zip de Foundry (docs/specs/sonido-foundry.md): pistas con dirección y el origen de listas y audios
ALTER TABLE "sound_tracks" DROP CONSTRAINT "sound_tracks_one_source";--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD COLUMN "playlist_id" uuid;--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD CONSTRAINT "foundry_origins_playlist_id_sound_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."sound_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundry_origins" ADD CONSTRAINT "foundry_origins_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_tracks" ADD CONSTRAINT "sound_tracks_one_source" CHECK (num_nonnulls("sound_tracks"."file_id", "sound_tracks"."youtube_id", "sound_tracks"."url") <= 1);