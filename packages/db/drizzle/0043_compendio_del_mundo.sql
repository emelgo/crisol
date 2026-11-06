CREATE TABLE "world_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"concept" text,
	"mechanics" jsonb,
	"ref" jsonb,
	"origin" jsonb
);
--> statement-breakpoint
ALTER TABLE "world_content" ADD CONSTRAINT "world_content_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_content" ADD CONSTRAINT "world_content_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_content" ADD CONSTRAINT "world_content_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_content" ADD CONSTRAINT "world_content_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "world_content_world_id_system_id_key_index" ON "world_content" USING btree ("world_id","system_id","key");--> statement-breakpoint
CREATE INDEX "world_content_world_id_system_id_type_index" ON "world_content" USING btree ("world_id","system_id","type");