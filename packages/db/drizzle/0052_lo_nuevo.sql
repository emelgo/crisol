CREATE TABLE "knowledge_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_news_one" UNIQUE("user_id","campaign_id","kind","target_id")
);
--> statement-breakpoint
ALTER TABLE "knowledge_news" ADD CONSTRAINT "knowledge_news_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_news" ADD CONSTRAINT "knowledge_news_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_news" ADD CONSTRAINT "knowledge_news_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_news_campaign_id_index" ON "knowledge_news" USING btree ("campaign_id");