-- El registro de la partida (ADR-0022): los mensajes, los susurros y lo enseñado de cada campaña
CREATE TABLE "campaign_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"world_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"ai" boolean DEFAULT false NOT NULL,
	"kind" text DEFAULT 'message' NOT NULL,
	"style" text DEFAULT 'ooc' NOT NULL,
	"speaker" jsonb DEFAULT '{"kind":"user"}'::jsonb NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"whisper" text[],
	"shown" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_messages_kind" CHECK ("campaign_messages"."kind" in ('message', 'shown')),
	CONSTRAINT "campaign_messages_style" CHECK ("campaign_messages"."style" in ('ic', 'ooc', 'emote'))
);
--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_messages_campaign_id_created_at_index" ON "campaign_messages" USING btree ("campaign_id","created_at");