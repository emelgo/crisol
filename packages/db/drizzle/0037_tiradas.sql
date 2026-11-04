-- Las tiradas de una campaña (ADR-0010): fuera del historial; n da el orden del registro
CREATE TABLE "dice_rolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"n" bigint GENERATED ALWAYS AS IDENTITY (sequence name "dice_rolls_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"campaign_id" uuid NOT NULL,
	"world_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"ai" boolean DEFAULT false NOT NULL,
	"formula" text NOT NULL,
	"label" text,
	"visibility" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dice_rolls_visibility" CHECK ("dice_rolls"."visibility" in ('all', 'self', 'master', 'hidden'))
);
--> statement-breakpoint
ALTER TABLE "dice_rolls" ADD CONSTRAINT "dice_rolls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dice_rolls" ADD CONSTRAINT "dice_rolls_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dice_rolls" ADD CONSTRAINT "dice_rolls_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dice_rolls_campaign_id_n_index" ON "dice_rolls" USING btree ("campaign_id","n");--> statement-breakpoint
CREATE INDEX "dice_rolls_user_id_created_at_index" ON "dice_rolls" USING btree ("user_id","created_at");