# Plantillas y colecciones en LegendKeeper

Módulo de Crisol: 2. Tipos de página, plantillas y consultas · Fecha: 2026-11-03 · Versión estudiada: web pública a
fecha de hoy

## Pregunta

Las mismas siete preguntas de la nota de Kanka (`research/kanka/tipos-y-relaciones.md`): plantillas de serie y
propias, qué pasa al cambiarlas, clases de campo y enlaces, listas inversas automáticas, el flujo de crear desde
plantilla, las quejas, y la API.

Se leyó la web pública: el centro de ayuda nuevo (legendkeeper.com/help, de octubre de 2026, artículos cortos con
vídeo), el changelog del blog (de la 0.7.6 de 2020 a la 0.21.0 del 27-10-2026) y la documentación para desarrolladores
(guía del SDK, guía de estilo y especificación OpenAPI, publicadas con la 0.20.0). De Reddit, solo lo que mostró el
buscador. Ni cuenta ni código. Grado de certeza:

- **[ayuda]**: centro de ayuda oficial.
- **[blog]**: changelog oficial.
- **[API]**: documentación para desarrolladores.
- **[foro]**: Reddit, visto en los extractos del buscador.
- **[inferido]**: deducido, sin comprobar.

Los artículos de la ayuda son casi solo títulos y pasos de una línea sobre un vídeo. Lo más preciso está en la
documentación de la API, que describe el modelo de datos.

## Lo que hacen

### El modelo, en breve

LegendKeeper no tiene tipos de página. Todo es una página en un árbol, con pestañas (texto, mapa, pizarra, línea
temporal) y una columna lateral de bloques [ayuda]. Lo que en otras apps es el tipo aquí es una convención: su guía de
estilo para integraciones recomienda una faceta de etiquetas para la clase (PNJ, Lugar, Objeto, Facción, Evento) y un
mismo icono y color para todas las páginas de una clase [API].

### 1. Plantillas de serie y propias

- **No hay plantillas de serie fijas** en la documentación. Las plantillas son contenido del proyecto. Los proyectos
  nuevos traen contenido de tutorial, que desde la 0.19 se puede rechazar [blog, inferido].
- **Una plantilla es una página.** Vive en una pestaña propia de plantillas (desde la 0.19, antes era una carpeta falsa
  del árbol) y se edita igual que cualquier página: texto, columna lateral, pestañas y subpáginas [ayuda, blog].
- **Nacen de dos formas**: convirtiendo una página que ya existe (botón derecho o arrastrándola a la pestaña) o en
  blanco, desde cero (desde 2020) [ayuda, blog]. Solo los administradores del proyecto crean plantillas [API].
- **Árboles de plantillas.** Una plantilla con subpáginas crea el árbol entero de una vez. Se quitó hace años y volvió en
  la 0.19 [blog, API].
- **Ámbito: el proyecto.** No hay plantillas de la cuenta. Para reutilizarlas entre proyectos, la comunidad comparte un
  proyecto con plantillas por Discord. El reparto oficial se prometió en 2020 y no se ha visto. En 2025 alguien pidió
  páginas globales que se sincronicen entre proyectos [blog, foro].

### 2. Al cambiar una plantilla

- **Crear desde plantilla es copiar.** La página nueva se lleva los campos, las propiedades de la columna lateral y los
  documentos con todo su contenido, con identidades nuevas. Un cambio posterior de la plantilla no llega a las páginas
  hechas [API].
- **Las menciones del contenido copiado siguen apuntando a las mismas páginas que en la plantilla** [API]. Si la
  plantilla menciona una página concreta, todas sus copias la mencionan.
- **Las colecciones que filtran por «esta página» se reapuntan solas** a la página nueva, gracias a un comodín [API].
- **Aplicar una plantilla a una página que ya existe** fue una petición antigua: rehacer la página rompía todos los
  enlaces que llegaban a ella [foro, 2021]. En la 0.19 llegó un apaño: vaciar el contenido de una página para aplicarle
  una plantilla [blog]. No mezcla, sustituye.

### 3. Clases de campo y enlaces

No hay esquema de campos. La columna lateral es una pila de bloques, y los mismos bloques caben en una ficha (infobox)
dentro del texto, desde la 0.19.1. Los bloques pasan de la columna al texto y al revés arrastrándolos [blog, API].

| Bloque | Para qué |
|---|---|
| Caja de texto | Texto con título |
| Clave y valor | Filas de etiqueta y valor. El valor es texto con formato y admite menciones |
| Imagen | Retrato o imagen principal |
| Medidor | Valor sobre un máximo: barra, indicador, estrellas, círculos o reserva de fichas. La ayuda lo propone para relojes de facción |
| Colección | Lista de páginas, fija o calculada (ver abajo) |
| Enlaces | Lista de páginas enlazadas |
| Incrustado | Vídeo, música, web |
| Mapa | Un mapa del proyecto, centrado en un pin |

[ayuda, API]

- **No hay número, fecha ni opciones como clase.** Todo valor de clave y valor es texto. Los filtros comparan como
  número si el texto lo parece [API].
- **Los enlaces no se limitan a un tipo**, porque no hay tipos [API].
- El medidor acepta sumas al escribir («+2») [blog].

### 4. Listas inversas: las colecciones

El bloque de colección lista páginas. Puede ser una lista fija o un **filtro** que la app recalcula cada vez que lo
dibuja. El filtro se arma en la app con un selector de origen, sin escribir consultas [API]. Por debajo es un árbol de
condiciones:

| Condición | Selecciona |
|---|---|
| Madre | Las hijas de una página, o de esta |
| Etiquetas | Con todas, alguna o ninguna de unas etiquetas |
| Propiedad | Las que tienen una fila de clave y valor con esa etiqueta y un valor que cumple una comparación (igual, mayor, contiene, empieza por, en una lista, expresión regular…). También por el valor o el máximo de un medidor |
| Mención | Las que tienen una fila de clave y valor que menciona una página, opcionalmente solo bajo una etiqueta dada |
| Enlaces entrantes | Las que enlazan a una página desde el texto, las propiedades o los pines |
| Texto | Las que encuentra la búsqueda de texto completo |
| Combinación | Y, o, no |

[API]

- **«Miembros de esta facción» es la condición de mención**: páginas con una fila «Facción» que menciona esta página.
  Funciona, pero se casa con el texto de la etiqueta de la fila [API].
- **El comodín «esta página»** vale en cualquier condición que pida una página. Por eso una colección dentro de una
  plantilla sigue funcionando en cada copia [API].
- **Orden**: las hijas, en el orden del árbol. Todo lo demás, por nombre [API].
- **Fallo silencioso**: el formato acepta tres clases de condición que la app no evalúa, y una colección que las use sale
  vacía, sin aviso [API].
- Hay además índices más simples: de subpáginas y de etiquetas, que se mantienen solos [ayuda].
- Ninguna lista viene dada: todas las configura el usuario, porque no hay tipos.

### 5. Crear una página desde plantilla

- **Página nueva**: se crea la página, se elige la plantilla en la pantalla de página en blanco y se le pone nombre
  [ayuda].
- **Modo rápido desde una mención**: al escribir una mención a un nombre que no existe, un signo extra abre la elección de
  plantilla, y la página nace ya con esa estructura sin salir del texto [ayuda].
- **Duplicar** una página, con o sin sus subpáginas, es la alternativa sin plantilla [ayuda].
- Por la API, el nombre por defecto es el de la plantilla sin la palabra «plantilla». Se puede elegir madre e incluir las
  subpáginas, con un tope de cien páginas por copia [API].

### 6. Límites y quejas visibles

- Aplicar plantillas a páginas existentes, pedido desde 2021, resuelto a medias en 2026 vaciando la página [foro, blog].
- Compartir plantillas entre proyectos: sin solución oficial [foro, blog].
- Un usuario quería que la plantilla «Pueblo» fijara también el icono y el color de sus pines en el mapa [foro].
- Al duplicar un proyecto o aplicar una plantilla se copiaban también las pestañas borradas (corregido en la 0.20)
  [blog].
- Las páginas tienen un tamaño máximo y, pasado, dejan de sincronizar. Desde la 0.20 avisan antes [blog].
- Sin tipos ni campos con clase, ordenar o comparar depende de que el texto esté bien escrito, y renombrar la etiqueta de
  una fila en una página la saca de las colecciones que filtran por ella [inferido].

### 7. API

- REST v3 y un SDK de TypeScript, desde la 0.20.0 (12-10-2026). Solo con plan de pago. Cada clave es de un proyecto y
  tiene papel de miembro o de administrador [blog, API].
- **Plantillas**: listar, guardar una página como plantilla (con o sin hijas) y crear una página desde plantilla. Las
  plantillas son páginas bajo una raíz reservada, y se leen y editan con las mismas operaciones. No salen en la búsqueda
  ni en las colecciones [API].
- **Propiedades**: se crean, leen, cambian y borran los bloques de la columna lateral y sus filas, y lo mismo las de una
  ficha dentro del texto [API].
- **Colecciones**: la API guarda y devuelve el filtro, pero no lo evalúa [API]. Un programa o una IA que quiera saber
  quién es miembro tiene que calcularlo por su cuenta.
- **Guía de estilo para integraciones**: dice qué valores elegir para que lo escrito por la API parezca hecho en la app
  (facetas de etiquetas, un icono por clase, la ficha arriba, colecciones con título solo si aporta) [API].
- No se vio MCP oficial.

## Compromisos y límites

La flexibilidad es total: cualquier página es una plantilla y cualquier bloque cabe en cualquier sitio. El precio es que
no hay tipos ni campos con clase. Las colecciones compensan con un filtro potente, pero se apoyan en el texto de las
etiquetas y en las etiquetas de página, que el usuario puede escribir de mil maneras. Las plantillas no evolucionan: son
fotocopias. Que la API no evalúe las colecciones deja a las integraciones sin lo más útil.

## Qué nos llevamos a Crisol

- **La condición de mención es nuestra «Miembros»**, y su selector visual confirma que se puede hacer sin lenguaje de
  consultas. Lo nuestro es más firme: «páginas de plantilla [PNJ] cuyo campo [Facción] es esta página», atado a la clave
  del campo y no al texto de la etiqueta.
- **«Esta página» como valor propio** del desplegable, para que los bloques de las plantillas funcionen en cada página
  creada. Es lo que hace que sus colecciones viajen en las plantillas.
- **Calcular en el servidor y dárselo al MCP.** Su API no evalúa las colecciones. Nuestro `leer_pagina` (o una
  herramienta propia) devuelve las filas ya calculadas.
- **Nunca una tabla vacía en silencio.** Si la configuración de una tabla no vale (el campo ya no existe, la plantilla se
  borró), se dice en el bloque.
- **Las plantillas no llevan enlaces a páginas concretas.** En LegendKeeper una mención en la plantilla apunta a la misma
  página en todas las copias. Las nuestras son de la cuenta y sirven a varios mundos, así que un enlace a una página de un
  mundo no tiene sentido en ellas.
- **Elegir plantilla al crear desde una mención.** Su modo rápido (mención a un nombre nuevo y elegir plantilla sin
  salir del texto) es bueno para escribir de corrido: se menciona a «Varn», que aún no existe, y nace como PNJ.
- **El medidor es nuestro reloj de segmentos**, y ya tenemos medidores en el panel. El campo «reloj» puede ser ese
  bloque con los segmentos y el valor guardados como datos del campo.
- **Las plantillas no salen en la búsqueda ni en las tablas.** En Crisol no son páginas del mundo, así que sale solo,
  pero conviene que la spec lo diga.
- **Aplicar plantilla a una página existente**, mejor que su «vaciar y aplicar»: añadir lo que falte sin borrar nada.
- **Árboles de plantillas** (un Lugar con sus subpáginas de serie): idea para más adelante, fuera del módulo 2.
- **Guía de estilo para la IA.** Su guía para integraciones es una buena pauta para las instrucciones de nuestro MCP:
  qué plantilla usar para cada cosa y cómo rellenar los campos.

## Fuentes

Centro de ayuda:

- https://www.legendkeeper.com/help/
- https://www.legendkeeper.com/help/how-to-create-a-page-from-a-template-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-browse-templates-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-make-your-own-template-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-create-a-page-from-a-template-with-mentions-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-add-key-value-properties-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-add-an-infobox-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-track-stats-with-meters-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-list-pages-by-tag-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-list-a-page-s-sub-pages-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-duplicate-a-page-in-legendkeeper/

Changelog y blog:

- https://www.legendkeeper.com/changelog/
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-6-templates/
- https://www.legendkeeper.com/changelog/legendkeeper-0-19-0-0-2/
- https://www.legendkeeper.com/changelog/legendkeeper-0-19-1/
- https://www.legendkeeper.com/changelog/legendkeeper-0-20-0-1/
- https://www.legendkeeper.com/changelog/legendkeeper-0-21-0/
- https://legendkeeper.com/how-to-make-templates-in-legendkeeper

Desarrolladores:

- https://www.legendkeeper.com/developers/
- https://www.legendkeeper.com/developers/guide/ (apartados de plantillas, propiedades, filas de clave y valor, fichas y
  filtros de colección)
- https://www.legendkeeper.com/developers/style/
- https://www.legendkeeper.com/api/v3/openapi.json

Comunidad (extractos del buscador):

- https://libredd.it/r/legendkeeper/comments/ptlp07/where_can_i_get_templates_for_my_legendkeeper/
- https://axebps-redlib.hf.space/r/legendkeeper/comments/1ikl77q/feature_request_global_pages_that_sync_across
- https://axebps-redlib.hf.space/r/legendkeeper (pregunta sobre pines por plantilla)
