-- El orden a mano de las etiquetas entre sus hermanas: clave fraccionaria, comparada con la collation "C" (como pages.position)
ALTER TABLE "tags" ADD COLUMN "position" text COLLATE "C";
