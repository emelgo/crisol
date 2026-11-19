-- Los árboles, uno solo (como la genealogía de Everlore): sin forma «family» u «org». Un organigrama es un árbol con
-- líneas «dirige» y «miembro de»; los tipos de línea (ahora libres: padrastro, adopción, expareja, hermanos u otra con
-- su nombre) van en el jsonb de las líneas y los de antes siguen valiendo. Las pestañas conservan su nombre
ALTER TABLE "trees" DROP COLUMN "layout";
