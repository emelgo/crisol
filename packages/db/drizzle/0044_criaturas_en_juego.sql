CREATE TABLE "campaign_creatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"number" integer,
	"unique" boolean DEFAULT false NOT NULL,
	"play" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_creatures" ADD CONSTRAINT "campaign_creatures_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatures" ADD CONSTRAINT "campaign_creatures_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatures" ADD CONSTRAINT "campaign_creatures_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatures" ADD CONSTRAINT "campaign_creatures_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_creatures_campaign_id_index" ON "campaign_creatures" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_creatures_unique" ON "campaign_creatures" USING btree ("campaign_id","key") WHERE "campaign_creatures"."unique";