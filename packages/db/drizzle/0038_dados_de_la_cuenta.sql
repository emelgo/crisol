-- Los dados de cada cuenta (docs/specs/dados.md): su color y si ver caer los de los demás
ALTER TABLE "user" ADD COLUMN "dice_color" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "dice_others" boolean DEFAULT true NOT NULL;