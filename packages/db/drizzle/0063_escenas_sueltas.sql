-- Escenas sueltas (ADR-0020): sin pestaña de página, con su nombre
ALTER TABLE "scenes" ALTER COLUMN "tab_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "name" text;