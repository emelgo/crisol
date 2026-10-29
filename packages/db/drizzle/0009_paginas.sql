CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" uuid NOT NULL,
	"parent_id" uuid,
	"position" text COLLATE "C" NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"properties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"sheet" jsonb,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pages_world_id_parent_id_index" ON "pages" USING btree ("world_id","parent_id");--> statement-breakpoint
CREATE INDEX "pages_parent_id_index" ON "pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "pages_deleted_at_index" ON "pages" USING btree ("deleted_at");