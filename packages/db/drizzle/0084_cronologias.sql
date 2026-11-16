-- Las cronologías de los mundos (módulo 8, decisiones 4-10 de docs/specs/modulo-8.md): las cronologías (con su
-- calendario y su filtro), los grupos y los eventos sueltos; y dos marcas más de lo que sabe cada campaña: un evento y
-- una cronología
CREATE TABLE "chronologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"calendar_id" uuid,
	"filter" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"date" jsonb NOT NULL,
	"color" text,
	"image" jsonb,
	"icon" text,
	"description" text DEFAULT '' NOT NULL,
	"group_id" uuid,
	"page_id" uuid,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"position" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge" DROP CONSTRAINT "knowledge_kind";--> statement-breakpoint
ALTER TABLE "chronologies" ADD CONSTRAINT "chronologies_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronologies" ADD CONSTRAINT "chronologies_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronologies" ADD CONSTRAINT "chronologies_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronologies" ADD CONSTRAINT "chronologies_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_group_id_timeline_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."timeline_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_groups" ADD CONSTRAINT "timeline_groups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_groups" ADD CONSTRAINT "timeline_groups_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_groups" ADD CONSTRAINT "timeline_groups_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chronologies_world_id_index" ON "chronologies" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "timeline_events_world_id_index" ON "timeline_events" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "timeline_events_page_id_index" ON "timeline_events" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "timeline_events_calendar" ON "timeline_events" USING btree (("date"->>'calendarId'));--> statement-breakpoint
CREATE INDEX "timeline_groups_world_id_index" ON "timeline_groups" USING btree ("world_id");--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_kind" CHECK ("knowledge"."kind" in ('page', 'secret', 'tab', 'pin', 'element', 'content', 'event', 'chronology'));