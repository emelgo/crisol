-- Las notas del jugador (docs/specs/notas-jugador.md): páginas de Markdown propias de cada jugador en su campaña
CREATE TABLE "player_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"position" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"icon" text,
	"markdown" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_parent_id_player_notes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."player_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_notes_campaign_id_user_id_index" ON "player_notes" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE INDEX "player_notes_parent_id_index" ON "player_notes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "player_notes_deleted_at_index" ON "player_notes" USING btree ("deleted_at");