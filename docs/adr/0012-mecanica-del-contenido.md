# ADR-0012: La mecánica del contenido y sus fuentes por concepto

Estado: propuesta con la spec de `srd-5e` · `docs/specs/srd-5e.md`

## Contexto

ADR-0011 hizo de un sistema un documento de datos: sus tipos, sus campos, sus fórmulas y sus tiradas. Su contenido
(clases, conjuros, objetos) son documentos de sus tipos, y un tipo de objeto puede dar bonos con una condición. Eso basta
para un 5e de prueba, no para el 5e entero automatizado que pidió Enrique:
- cada cosa tiene su propia mecánica, no la de su tipo: el Anillo de protección da +1 a la CA y a las salvaciones; Mago
  armadura fija la base de la CA; la Furia da resistencias y ventaja mientras está activa;
- hay usos que se gastan y se recuperan, cosas que conceden otras (acciones, conjuros, elecciones) y conjuros que
  escalan por nivel;
- las dos ediciones del SRD tienen versiones de lo mismo, y la campaña decide cuáles valen;
- el modelo tiene que valer para todo el 5e oficial (un futuro marketplace), no solo para el SRD.

Lo que dice el estudio de D&D Beyond (`research/dndbeyond/contenido-5e-y-mecanica.md`):
- **su mecánica son unas treinta familias de modificadores** con casos especiales para rasgos concretos, algunos que
  funcionan por su nombre, y condiciones escondidas en el subtipo o en el texto;
- **sus dos ediciones solo comparten el nombre**, de ahí listas dobles y referencias que conceden la versión equivocada;
- **las fuentes se eligen por personaje**, y el máster no las puede limitar en su campaña;
- **ellos mismos publican lo que no automatizan** y están pasando sus reglas de código a datos.

## Decisión

- **Una mecánica general en el formato, para cualquier sistema**: efectos (destino, operación, valor y condición como
  fórmulas, y su origen), recursos (máximo, cuándo y cuánto se recuperan), concesiones explícitas (acciones, conjuros,
  competencias, elecciones, documentos), escalado (por nivel del personaje, por espacio, por tabla), daño en partes y
  estados activables con duración. Nada funciona por su nombre: todo es dato. Se calcula con el mismo intérprete y el
  mismo presupuesto, en el servidor y en la web, y sale en el desglose.
- **Cada documento de contenido lleva su fuente y su concepto**: la fuente dice su edición, su editorial, su licencia y su
  atribución; el concepto une las versiones de lo mismo entre ediciones. Lo legado, lo más nuevo y las listas sin
  duplicados salen de ahí, y las referencias van al concepto.
- **La campaña elige**: las ediciones, lo legado, lo más nuevo y las reglas generales (ajustes con un valor por edición,
  que las fórmulas leen con `@ajustes`).
- **Un grado de automatización declarado** en cada documento: lo que no se automatiza se sabe y se lleva a mano.
- **El contenido de los sistemas de serie, en el código** (JSON en `packages/systems/src/catalog/`), como el documento
  del sistema; el de los sistemas de la cuenta, en la base de datos, como hasta ahora.

## Alternativas descartadas

- **Modificadores por familias, como D&D Beyond**: cada caso nuevo pide un tipo nuevo y código; con efectos generales
  sobre fórmulas, un libro nuevo es datos.
- **Un sistema por edición**: duplica las reglas y no deja mezclar, que es lo que pidió Enrique.
- **Las ediciones por personaje**: el máster no puede limitar su campaña, que es justo lo que a ellos les falta.

## Consecuencias

- El formato crece (efectos, recursos, concesiones, escalado, estados, fuentes y conceptos), con su validación y sus
  pruebas; los sistemas propios lo pueden usar igual.
- `evaluate` aplica los efectos de lo que lleva y de los estados activos, en un orden fijo, y lo enseña en el desglose.
- El contenido de serie pesa (unos 2.500 documentos en dos idiomas) y va en el repositorio; se carga en el servidor una
  vez, y a la web solo llega lo que se pide.
- `personajes` y `hoja` se apoyan en esto: el creador usa las concesiones y las elecciones; la hoja, los recursos, las
  acciones y los estados.
