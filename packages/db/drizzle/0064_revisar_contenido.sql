-- Pendiente de revisar (ADR-0021): lo que propone la IA desde un PDF no se ve hasta aceptarlo
ALTER TABLE "system_content" ADD COLUMN "review" jsonb;