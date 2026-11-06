CREATE TABLE "content_table_draws" (
	"campaign_id" uuid NOT NULL,
	"key" text NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "content_table_draws_campaign_id_key_pk" PRIMARY KEY("campaign_id","key")
);
--> statement-breakpoint
ALTER TABLE "system_content" ADD COLUMN "table" jsonb;--> statement-breakpoint
ALTER TABLE "world_content" ADD COLUMN "table" jsonb;--> statement-breakpoint
ALTER TABLE "content_table_draws" ADD CONSTRAINT "content_table_draws_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;