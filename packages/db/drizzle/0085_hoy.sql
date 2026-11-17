-- El «hoy» de cada campaña (módulos 8 y 10 · campaña, decisiones 5-9): su fecha canónica, nula hasta que el máster
-- la pone; y las entradas del sistema en el registro (un cambio de fecha, un viaje, el clima cambiado a mano)
ALTER TABLE "campaign_messages" DROP CONSTRAINT "campaign_messages_kind";--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "today" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD COLUMN "event" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_kind" CHECK ("campaign_messages"."kind" in ('message', 'shown', 'event'));