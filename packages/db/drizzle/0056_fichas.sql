CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"system_id" uuid,
	"name" text NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"character_id" uuid,
	"creature_id" uuid,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"size" double precision DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"faction" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"image" jsonb,
	CONSTRAINT "scene_tokens_campaignId_sceneId_characterId_unique" UNIQUE("campaign_id","scene_id","character_id"),
	CONSTRAINT "scene_tokens_campaignId_sceneId_creatureId_unique" UNIQUE("campaign_id","scene_id","creature_id"),
	CONSTRAINT "scene_tokens_one_actor" CHECK (("scene_tokens"."character_id" is null) <> ("scene_tokens"."creature_id" is null))
);
--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_tokens" ADD CONSTRAINT "scene_tokens_creature_id_campaign_creatures_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."campaign_creatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "encounters_world_id_index" ON "encounters" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "scene_tokens_scene_id_index" ON "scene_tokens" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_tokens_campaign_id_index" ON "scene_tokens" USING btree ("campaign_id");