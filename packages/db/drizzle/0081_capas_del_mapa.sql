-- Las capas de los mapas (módulo 9): cada región, ruta o texto en una, con su orden; y cuánto se anda en un día
CREATE TABLE "map_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"map_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_elements" ADD COLUMN "layer_id" uuid;--> statement-breakpoint
ALTER TABLE "map_elements" ADD COLUMN "position" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "speeds" jsonb;--> statement-breakpoint
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_layers_map_id_index" ON "map_layers" USING btree ("map_id");--> statement-breakpoint
ALTER TABLE "map_elements" ADD CONSTRAINT "map_elements_layer_id_map_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."map_layers"("id") ON DELETE cascade ON UPDATE no action;