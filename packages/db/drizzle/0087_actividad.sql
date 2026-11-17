-- El centro de actividad de las campañas (módulos 8 y 10 · campaña, decisiones 19-23): la última visita de cada cuenta
-- y la campaña de cada operación del historial (la de la fila de la campaña o la que la lleva), rellenada para lo de
-- antes con su primer cambio que la tenga
CREATE TABLE "campaign_visits" (
	"user_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_visits_user_id_campaign_id_pk" PRIMARY KEY("user_id","campaign_id")
);
--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_visits" ADD CONSTRAINT "campaign_visits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_visits" ADD CONSTRAINT "campaign_visits_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operations_campaign_id_created_at_index" ON "operations" USING btree ("campaign_id","created_at");--> statement-breakpoint
UPDATE "operations" o SET "campaign_id" = s."campaign_id" FROM (
  SELECT DISTINCT ON (c."operation_id") c."operation_id", (CASE WHEN c."table_name" = 'campaigns' THEN c."row_id"::text
    ELSE coalesce(c."after" ->> 'campaign_id', c."before" ->> 'campaign_id') END)::uuid AS "campaign_id"
  FROM "changes" c
  WHERE c."table_name" = 'campaigns' OR coalesce(c."after" ->> 'campaign_id', c."before" ->> 'campaign_id') IS NOT NULL
  ORDER BY c."operation_id", c."seq"
) s WHERE s."operation_id" = o."id" AND o."campaign_id" IS NULL;
