CREATE TABLE "wiki_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"world_id" uuid NOT NULL,
	"tabs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bookmarks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_preferences_userId_worldId_unique" UNIQUE("user_id","world_id")
);
--> statement-breakpoint
ALTER TABLE "wiki_preferences" ADD CONSTRAINT "wiki_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_preferences" ADD CONSTRAINT "wiki_preferences_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;