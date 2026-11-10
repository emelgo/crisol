-- La sala (ADR-0022): la pausa, el modo de movimiento y los echados de la Mesa de cada campaña
ALTER TABLE "campaign_tables" ADD COLUMN "paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD COLUMN "movement" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_tables" ADD COLUMN "kicked" text[] DEFAULT '{}'::text[] NOT NULL;