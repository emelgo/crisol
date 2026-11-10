-- Fichas asignadas (docs/specs/mover-jugadores.md): los jugadores que mueven una criatura en juego
ALTER TABLE "campaign_creatures" ADD COLUMN "controlled_by" text[] DEFAULT '{}'::text[] NOT NULL;