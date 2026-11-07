CREATE TABLE "scene_explored" (
	"campaign_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_explored_campaign_id_scene_id_pk" PRIMARY KEY("campaign_id","scene_id")
);
--> statement-breakpoint
CREATE TABLE "scene_fog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"operation" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_lights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"bright" double precision DEFAULT 0 NOT NULL,
	"dim" double precision DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#ffe2a8' NOT NULL,
	"intensity" double precision DEFAULT 1 NOT NULL,
	"angle" double precision DEFAULT 360 NOT NULL,
	"rotation" double precision DEFAULT 0 NOT NULL,
	"walls" boolean DEFAULT true NOT NULL,
	"darkness" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"active_below_ambient" double precision
);
--> statement-breakpoint
CREATE TABLE "scene_walls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"ax" double precision NOT NULL,
	"ay" double precision NOT NULL,
	"bx" double precision NOT NULL,
	"by" double precision NOT NULL,
	"sight" text DEFAULT 'full' NOT NULL,
	"light" text DEFAULT 'full' NOT NULL,
	"move" text DEFAULT 'full' NOT NULL,
	"sound" text DEFAULT 'full' NOT NULL,
	"direction" text DEFAULT 'both' NOT NULL,
	"door" text,
	"locked" boolean DEFAULT false NOT NULL,
	"open" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD COLUMN "tile_fit" text DEFAULT 'whole' NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_states" ADD COLUMN "doors" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "darkness" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "automatic_vision" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_explored" ADD CONSTRAINT "scene_explored_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_explored" ADD CONSTRAINT "scene_explored_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_fog" ADD CONSTRAINT "scene_fog_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_fog" ADD CONSTRAINT "scene_fog_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_fog" ADD CONSTRAINT "scene_fog_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_fog" ADD CONSTRAINT "scene_fog_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_fog" ADD CONSTRAINT "scene_fog_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_lights" ADD CONSTRAINT "scene_lights_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_lights" ADD CONSTRAINT "scene_lights_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_lights" ADD CONSTRAINT "scene_lights_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_lights" ADD CONSTRAINT "scene_lights_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_walls" ADD CONSTRAINT "scene_walls_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_walls" ADD CONSTRAINT "scene_walls_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_walls" ADD CONSTRAINT "scene_walls_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_walls" ADD CONSTRAINT "scene_walls_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_fog_campaign_id_scene_id_index" ON "scene_fog" USING btree ("campaign_id","scene_id");--> statement-breakpoint
CREATE INDEX "scene_lights_scene_id_index" ON "scene_lights" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_walls_scene_id_index" ON "scene_walls" USING btree ("scene_id");