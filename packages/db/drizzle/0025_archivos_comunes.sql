DROP INDEX "files_name";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "world_id" DROP NOT NULL;--> statement-breakpoint
-- La organización de cada archivo: la de su mundo (los que ya hay son todos de un mundo)
ALTER TABLE "files" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "files" SET "organization_id" = "worlds"."organization_id" FROM "worlds" WHERE "worlds"."id" = "files"."world_id";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_organization_id_index" ON "files" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_common_name" ON "files" USING btree ("organization_id",lower("name")) WHERE "files"."world_id" is null and "files"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "files_name" ON "files" USING btree ("world_id",lower("name")) WHERE "files"."world_id" is not null and "files"."deleted_at" is null;