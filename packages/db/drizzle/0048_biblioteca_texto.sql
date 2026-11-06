CREATE TABLE "file_pages" (
	"file_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"text" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('es_unaccent'::regconfig, text)) STORED,
	CONSTRAINT "file_pages_file_id_page_pk" PRIMARY KEY("file_id","page")
);
--> statement-breakpoint
CREATE TABLE "file_texts" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"hash" text NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_texts_status" CHECK ("file_texts"."status" in ('pending', 'reading', 'done', 'empty', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_texts" ADD CONSTRAINT "file_texts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_pages_tsv" ON "file_pages" USING gin ("tsv");