-- La capa de clima de la Mesa (módulos 8 y 10 · campaña, decisión 16): su modo por campaña (como hoy, a mano o
-- ninguna) e «Interior» por escena, que la apaga
ALTER TABLE "campaign_tables" ADD COLUMN "weather_layer" jsonb DEFAULT '{"mode":"today"}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "interior" boolean DEFAULT false NOT NULL;