CREATE TABLE "system_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid NOT NULL,
	"path" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"license" text NOT NULL,
	"credit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_content" ADD COLUMN "img" text;--> statement-breakpoint
ALTER TABLE "world_content" ADD COLUMN "img" text;--> statement-breakpoint
ALTER TABLE "system_images" ADD CONSTRAINT "system_images_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "system_images_system_id_path_index" ON "system_images" USING btree ("system_id","path");