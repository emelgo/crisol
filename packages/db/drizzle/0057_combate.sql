CREATE TABLE "combatants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"combat_id" uuid NOT NULL,
	"character_id" uuid,
	"creature_id" uuid,
	"initiative" double precision,
	"modifier" double precision,
	"group" text,
	"sort" integer,
	CONSTRAINT "combatants_combatId_characterId_unique" UNIQUE("combat_id","character_id"),
	CONSTRAINT "combatants_combatId_creatureId_unique" UNIQUE("combat_id","creature_id"),
	CONSTRAINT "combatants_one_actor" CHECK (("combatants"."character_id" is null) <> ("combatants"."creature_id" is null))
);
--> statement-breakpoint
CREATE TABLE "combats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"scene_id" uuid,
	"round" integer DEFAULT 0 NOT NULL,
	"turn_id" uuid,
	"skip_defeated" boolean DEFAULT true NOT NULL,
	CONSTRAINT "combats_campaignId_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_combat_id_combats_id_fk" FOREIGN KEY ("combat_id") REFERENCES "public"."combats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatants" ADD CONSTRAINT "combatants_creature_id_campaign_creatures_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."campaign_creatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combats" ADD CONSTRAINT "combats_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combats" ADD CONSTRAINT "combats_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combats" ADD CONSTRAINT "combats_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combats" ADD CONSTRAINT "combats_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combats" ADD CONSTRAINT "combats_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "combatants_combat_id_index" ON "combatants" USING btree ("combat_id");