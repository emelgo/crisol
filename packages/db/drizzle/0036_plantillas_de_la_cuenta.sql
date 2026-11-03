-- Las plantillas de página de una cuenta (ADR-0009): las de serie no tienen fila
CREATE TABLE "page_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"based_on" text,
	"line" text[] NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"panel" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skeleton" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_templates_organization_id_index" ON "page_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "page_templates_line" ON "page_templates" USING gin ("line");