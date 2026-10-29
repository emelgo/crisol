CREATE TABLE "invitation_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"token_hash" text NOT NULL,
	"secret_sealed" text NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joins" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invitation_links_campaignId_unique" UNIQUE("campaign_id"),
	CONSTRAINT "invitation_links_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitation_links_role" CHECK ("invitation_links"."role" in ('player'))
);
--> statement-breakpoint
ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_links" ADD CONSTRAINT "invitation_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;