-- Capítulos solo para quien dirige (ADR-0033): los jugadores de una campaña con su libro no los leen
ALTER TABLE "system_chapters" ADD COLUMN "master" boolean DEFAULT false NOT NULL;