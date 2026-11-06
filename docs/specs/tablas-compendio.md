# Spec: tablas-compendio (módulo 4)

Estado: **construido** (2026-11-06, rama `modulo-4/tablas`; ver § «Construido»). Cuarta capacidad del módulo 4 (`docs/specs/modulo-4.md`). Estudio:
`research/foundry/avances-y-tablas.md` § 3 (las tablas del núcleo de Foundry) y `research/foundry/compendio.md`
propuesta 11.

## Objetivo

Que las tablas aleatorias **sean entradas del compendio**, como en Foundry: las que trae un sistema (las de un zip de
Foundry, convertidas de verdad y no como texto), las del sistema de la cuenta y las del mundo. Se tiran desde la
campaña, en el servidor y a su registro, con su estado (lo sacado, en las que no repiten), y sus resultados pueden
llevar a otra entrada del compendio o a otra tabla.

Hoy: las tablas de la wiki son una pestaña «Tabla» de una página (módulo 3) y las de un zip de Foundry llegan como el
texto de una entrada «Tabla», que se tira leyendo su tabla en Markdown (`rollContentTable`).

## Requisitos

- **Un tipo de entrada propio de Crisol, «Tabla»**, en todos los sistemas, sin que el sistema lo declare: nombre,
  descripción, fórmula (sin ella, 1dN por los pesos), si lo sacado vuelve a salir y sus filas (rango, texto con
  tiradas, y a dónde lleva: una entrada del compendio o otra tabla, que se tira también, hasta 5 niveles).
- **El mismo motor** que la pestaña «Tabla» de la wiki: las dos se tiran igual y sacan el mismo resultado
  estructurado. La pestaña sigue en la wiki.
- **Tirar en la campaña**: desde el compendio (la tabla abierta, «Tirar») y desde un enlace en la wiki. Va al registro
  con su visibilidad (la del máster, oculta por defecto). En las que no repiten, lo sacado queda marcado por campaña y
  se reinicia.
- **Traer de Foundry**: los compendios de tablas pasan a tablas de verdad (rangos, pesos, fórmula, reemplazo, los
  resultados de texto y los que apuntan a un documento del mismo zip, y las tablas anidadas); lo que apunte fuera,
  como texto.
- **Las tablas del texto** de una entrada (la Bolsa de trucos) se siguen tirando como hoy.
- **Crear y cambiar** una tabla del mundo o de un sistema de la cuenta con el editor de filas de la pestaña «Tabla».
- **La IA**: `tirar_tabla_compendio` tira también estas (por su clave), y crearlas y cambiarlas va por
  `guardar_contenido`.

## Decisiones (propuestas, por confirmar al ver las pantallas)

1. **«Tabla» es de Crisol, no del sistema**: así cualquier sistema (y el vacío) puede tener tablas, y la IA no tiene
   que declararlas.
2. **Pasar las tablas de un sistema ya importado** (las 58 del texto y las de un zip): al volver a importar; no se
   migran solas.
3. **Los jugadores** tiran las tablas que ven (las del sistema); las del mundo, con el módulo 5.

## Construido (2026-11-06)

Como se propuso, con dos precisiones al construirlo: **las filas que se pisan salen juntas** (como en Foundry, donde
una tirada da todas las filas que abarcan su total: así funcionan «Standard Languages» o «Teleport Mishap» del dnd5e),
así que en una tabla del compendio no es un problema; y una fila **lleva a una entrada por su clave** (si esa entrada es
una tabla, se tira también), en lugar de distinguir página y tabla como la pestaña de la wiki. Lo sacado lo reinicia
el máster, y se olvida al quitar la tabla del mundo. Tras la revisión: una tirada no repite dentro de sí misma, no
vuelve a una tabla de su camino y da como mucho 100 resultados; una anidada agotada deja la fila de arriba; la IA tira
oculta por defecto; una fórmula que no se entiende o una fila al revés no se guardan (de Foundry, la fórmula se quita
con una nota); y una «Tabla» de antes, con su tabla en el texto, se tira por su clave. Queda: elegir a qué entrada lleva una fila desde el editor (hoy, con la IA o de Foundry), tirar desde un
enlace en la wiki, y el enlace del registro a la entrada que salió (la tirada ya la guarda, `content`).

## Pruebas

- `packages/systems`: el tipo «Tabla» validado, tirar con pesos, sin reemplazo y anidadas (con su tope), convertir una
  tabla de Foundry.
- Servidor: tirar con permisos y visibilidad, el estado por campaña y reiniciarlo.
- Web: la tabla en el compendio, tirarla y ver lo que sale marcado; el editor.
- E2E: el máster tira en una tabla del mundo sin reemplazo dos veces y no le sale lo mismo; la reinicia.

## Fuera

Las barajas de cartas (los paquetes de cartas de Foundry), los resultados que dan objetos solos a un personaje y las
macros.
