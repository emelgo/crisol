ALTER TABLE "scene_tiles" DROP CONSTRAINT "scene_tiles_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "scene_explored" DROP CONSTRAINT "scene_explored_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "scene_tiles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;