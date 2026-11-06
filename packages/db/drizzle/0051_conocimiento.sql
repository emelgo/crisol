CREATE TABLE "knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"campaign_id" uuid,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"known" boolean NOT NULL,
	"characters" uuid[],
	CONSTRAINT "knowledge_one" UNIQUE NULLS NOT DISTINCT("world_id","campaign_id","kind","target_id"),
	CONSTRAINT "knowledge_kind" CHECK ("knowledge"."kind" in ('page', 'secret', 'tab', 'pin', 'element', 'content'))
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "knows_world" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge" ADD CONSTRAINT "knowledge_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_campaign_id_index" ON "knowledge" USING btree ("campaign_id");