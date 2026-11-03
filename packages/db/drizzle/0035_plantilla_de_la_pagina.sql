-- La plantilla de cada página y su linaje (ADR-0009), con los índices de las tablas que se llenan solas
ALTER TABLE "pages" ADD COLUMN "template" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "template_line" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "pages_template_line" ON "pages" USING gin ("template_line");--> statement-breakpoint
CREATE INDEX "pages_properties" ON "pages" USING gin ("properties" jsonb_path_ops);