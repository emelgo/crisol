-- El clima de las campañas (módulos 8 y 10 · campaña, decisiones 11-15): su zona y su latitud, y los días cambiados a
-- mano por el máster (los demás se calculan con la semilla y no se guardan)
CREATE TABLE "campaign_weather" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" text NOT NULL,
	"day" integer NOT NULL,
	"condition" text NOT NULL,
	"low" integer NOT NULL,
	"high" integer NOT NULL,
	"wind" text NOT NULL,
	"wind_direction" text NOT NULL,
	CONSTRAINT "campaign_weather_day" UNIQUE("campaign_id","calendar_id","year","month","day")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "weather_zone" text DEFAULT 'temperate' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "latitude" double precision DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_weather" ADD CONSTRAINT "campaign_weather_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_weather" ADD CONSTRAINT "campaign_weather_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_weather" ADD CONSTRAINT "campaign_weather_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_weather" ADD CONSTRAINT "campaign_weather_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_weather" ADD CONSTRAINT "campaign_weather_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_weather_calendar_id_index" ON "campaign_weather" USING btree ("calendar_id");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_weather_zone" CHECK ("campaigns"."weather_zone" in ('temperate', 'arid', 'cold', 'tropical', 'mountain', 'coast', 'polar'));--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_latitude" CHECK ("campaigns"."latitude" between -90 and 90);