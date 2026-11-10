-- Las carpetas de la pestaña Actores de cada campaña (sin historial)
CREATE TABLE "actor_folder_items" (
	"campaign_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	CONSTRAINT "actor_folder_items_campaign_id_kind_actor_id_pk" PRIMARY KEY("campaign_id","kind","actor_id"),
	CONSTRAINT "actor_folder_items_kind" CHECK ("actor_folder_items"."kind" in ('character', 'creature'))
);
--> statement-breakpoint
CREATE TABLE "actor_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actor_folder_items" ADD CONSTRAINT "actor_folder_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_folder_items" ADD CONSTRAINT "actor_folder_items_folder_id_actor_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."actor_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_folders" ADD CONSTRAINT "actor_folders_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actor_folders_campaign_id_index" ON "actor_folders" USING btree ("campaign_id");