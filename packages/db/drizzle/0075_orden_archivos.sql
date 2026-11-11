-- El orden a mano de las carpetas y los archivos dentro de su carpeta: clave fraccionaria, comparada con la collation "C" (como pages.position)
ALTER TABLE "file_folders" ADD COLUMN "position" text COLLATE "C";--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "position" text COLLATE "C";
