CREATE TABLE "random_table_draws" (
	"campaign_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "random_table_draws_campaign_id_table_id_pk" PRIMARY KEY("campaign_id","table_id")
);
--> statement-breakpoint
CREATE TABLE "random_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"tab_id" uuid NOT NULL,
	"formula" text,
	"replacement" boolean DEFAULT true NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "random_tables_tabId_unique" UNIQUE("tab_id")
);
--> statement-breakpoint
ALTER TABLE "random_table_draws" ADD CONSTRAINT "random_table_draws_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_table_draws" ADD CONSTRAINT "random_table_draws_table_id_random_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."random_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_tables" ADD CONSTRAINT "random_tables_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_tables" ADD CONSTRAINT "random_tables_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_tables" ADD CONSTRAINT "random_tables_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_tables" ADD CONSTRAINT "random_tables_tab_id_page_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."page_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "random_tables_world_id_index" ON "random_tables" USING btree ("world_id");