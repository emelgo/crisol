# Spec: conocimiento (módulo 5)

Estado: **en marcha** (2026-11-06). Primera capacidad del módulo 5 (`docs/specs/modulo-5.md`). Entrevista:
`docs/modulos.md` § «### 5. Visibilidad por campaña». ADR-0017. Estudios: `research/foundry/visibilidad-y-revelar.md`,
`research/{legendkeeper,worldanvil,kanka}/visibilidad.md`, y de antes `research/foundry/journal.md` y
`research/foundry/usuarios-y-permisos.md`.

## Objetivo

Que **los jugadores lean la wiki del mundo**, pero solo lo que sabe su campaña. Hasta ahora la wiki es solo del
máster. Lo que se sabe va **por campaña**, con excepciones **por personaje** («esto solo lo sabe la pícara»), y cada
campaña empieza sabiendo lo que el mundo marca como conocido, nada, o lo mismo que otra campaña del mundo.

El servidor filtra **todo** lo que lee un jugador: nada se le manda para esconderlo en su navegador (al revés que
Foundry, `research/foundry/journal.md`). Quitarle algo surte efecto al momento.

Para quién: el máster, que marca lo que se sabe y comprueba lo que ve cada uno; el jugador, que lee desde su campaña;
y la IA de los dos.

## Cómo se decide si un jugador ve una página

- **Dos capas**: la del **mundo** (lo que sabe todo el mundo; solo «todos» o «nadie») y la de **cada campaña** (todos
  sus jugadores, unos personajes o nadie).
- Cada página puede llevar, en cada capa, una marca: **la conocen** (con su público) o **no la conocen**. Sin marca,
  hereda.
- Para un jugador de una campaña: se sube desde la página hacia arriba y **manda la primera marca que se encuentre**;
  en una misma página, la de la campaña manda sobre la del mundo. Si la campaña empezó «de cero», la capa del mundo no
  cuenta. Sin ninguna marca hasta arriba: **solo el máster** (una página nueva es del máster).
- **Herencia viva**: marcar una página marca a sus subpáginas mientras no tengan la suya. Mover una página cambia lo
  que hereda. La interfaz dice siempre de dónde viene («Por «Aldoria»», «Lo sabe el mundo»).
- **Por personaje**: «la conocen» con unos personajes la ve la cuenta de sus dueños. Un jugador ve lo de todos sus
  personajes de la campaña. Si un personaje cambia de dueño, lo que sabía pasa con él.
- **El máster** (el del mundo y el propietario de la cuenta) lo ve todo, siempre.

## Requisitos

### Marcar (el máster)

- En la página, **«Quién la conoce»**: lo que ve ahora cada campaña del mundo y por qué, y los cambios:
  - **en el mundo**: «Lo sabe todo el mundo» / «No lo sabe nadie» / «Como su madre»;
  - **en una campaña**: «Lo sabe toda la campaña» / «Lo saben…» (elegir personajes) / «No lo sabe» / «Como diga el
    mundo o su madre».
- Desde el árbol, lo mismo con el botón derecho en una página, y la página lleva una marca discreta si la ve alguna
  campaña.
- Cada cambio es una **operación del historial** (`setKnowledge`), con su frase («Dio a conocer «Aldoria» a «La
  compañía del alba»») y se deshace.
- **Campos y bloques ocultos**: un campo de las propiedades o un bloque del panel se marca **«Oculto»** (con un ojo
  tachado; en lo del mundo no se dice «máster», `docs/diseno.md`) y no le llega a ningún jugador, aunque vea la página.
  No se revela uno a uno: para eso está el secreto (`revelar`).

### Cómo empieza una campaña

- Al crearla: **«Al empezar, los jugadores saben…»**: «Lo que sabe el mundo» (por defecto), «Nada» o «Lo mismo que
  «Otra campaña»». Lo último copia las marcas de esa campaña una vez; después cada una va por su lado.
- Se cambia en los ajustes de la campaña («Parte de lo que sabe el mundo», sí o no). Las campañas que ya existen parten
  del mundo.

### El jugador lee la wiki

- En la barra de su campaña, **«Mundo»**: la wiki con lo que sabe. Abre la portada del mundo si la ve; si no, la
  primera página que ve; si no ve nada, «Aún no sabéis nada de este mundo».
- **Lo que ve**, todo filtrado en el servidor:
  - **el árbol**, solo con lo que ve; una subpágina que ve bajo una madre que no ve cuelga de la primera antecesora
    que ve (o arriba), sin delatar las ocultas. La miga de pan, igual;
  - **la página**: título, icono, portada, propiedades y panel (sin lo oculto), etiquetas, pestañas (las que ve,
    `mapas-jugadores`), y el cuerpo **sin los secretos que no ve y sin las notas ocultas**, en lectura. Se recarga sola
    cuando cambia;
  - **los enlaces** a lo que ve llevan a la página; a lo que no ve, sin enlace ni vista previa y sin el nombre del
    destino (decisión 2);
  - **la vista previa** al pasar el ratón y **los incrustados**, filtrados igual;
  - **los enlaces entrantes**, solo desde lo que ve;
  - **las tablas que se llenan solas** del panel («Miembros»), solo con las páginas que ve;
  - **la búsqueda** (por palabras y por significado), solo en lo que ve; los secretos, solo los que ve;
  - **los archivos** (imágenes, PDF): solo los que están en algo que ve (la portada o el panel de una página que ve, o
    incrustados en un documento que ve).
- **No ve**: el historial, las versiones, la papelera, las notas ocultas, las plantillas, la lista de enlaces rotos ni
  nada que se edite. La hoja (vista para imprimir) de una página que ve, sí, filtrada.
- **En tiempo real**: si el máster le da a conocer una página, aparece en su árbol; si se la quita, desaparece y, si la
  tenía abierta, pasa a «Esta página ya no está a tu alcance».

### «Ver como jugador»

- En la wiki, dentro de una campaña, el máster elige **un personaje** (o «la campaña», un jugador sin excepciones) y
  ve la wiki **tal como la ve**, calculada en el servidor con sus permisos, en lectura. Una franja dice «Viendo como
  Lía» y «Volver».

### La IA

- **Del máster**: `marcar_conocimiento` (página, mundo o campaña, la marca y su público; tipo «jugadores»: en
  copiloto espera aprobación), `quien_conoce` (lo que ve cada campaña de una página y por qué) y `ver_como_jugador`
  (una página o el árbol como lo ve un personaje). `crear_campana` admite cómo empieza.
- **Del jugador**: entra con su cuenta por el mismo OAuth; las herramientas de leer la wiki (`buscar_paginas`,
  `leer_pagina`, `ver_arbol`, `enlaces_pagina`, `paginas_recientes`…) le dan solo lo que ve, con `campaignId` (si solo
  juega una campaña de ese mundo, se deduce).

## Decisiones (propuestas de los estudios, por confirmar al ver las pantallas)

1. **El jugador lee por la API, no por Yjs** (ADR-0017): abrir el cuerpo en Yjs le enseñaría dónde hay secretos,
   aunque no su texto. Le llega el cuerpo ya filtrado y un aviso en tiempo real para recargarlo.
2. **Un enlace a lo oculto no dice el nombre del destino**: sale su texto propio si lo tiene (`[[Varn|el viejo]]`) y,
   si no, «desconocido», atenuado y sin enlace, como Kanka. El título se pinta al leer (se guarda el id): si el máster
   renombra una página oculta, su nombre nuevo saldría en todas las que la enlazan
   (`research/worldanvil/visibilidad.md` y `research/kanka/visibilidad.md`). **Igual que un enlace a una página que no
   existe**, sin id ni icono, para que no delate que hay algo (`research/foundry/visibilidad-y-revelar.md`: Foundry
   pinta el nombre real de todo).
3. **Subpáginas más abiertas que su madre**, permitidas, colgando de la primera antecesora visible.
4. **Lo mismo que otra campaña**, como copia al crearla (no un enlace vivo entre campañas).
5. **Por personaje, no por cuenta**: si el personaje pasa a otro jugador, el conocimiento pasa con él.
6. **Una subpágina nueva bajo una página que alguna campaña conoce nace oculta** (con «No lo sabe nadie» en el mundo)
   y su cabecera lo dice, con «Revelar». Con herencia viva nacería visible, y crear «El plan secreto del rey» bajo
   «Aldoria» lo enseñaría al momento (`research/legendkeeper/visibilidad.md`: lo nuevo visible por defecto es una
   fuente de fugas). Bajo una que nadie conoce, sin marca: sigue heredando.
7. **Al dar a conocer una página con subpáginas**, el cuadro dice cuántas heredan («y 12 subpáginas») y deja verlas.
8. **Solo la campaña desde la que lee**: un jugador con personajes en dos campañas de un mundo ve lo de la campaña en
   la que está, no la suma.

## Pruebas

- **El motor** (`packages/domain`), en tabla: capas × herencia × público × «de cero» × mover × personaje de otro dueño.
- **El servidor**, por cada vía de lectura (página, árbol, hijos, recientes, búsqueda por palabras y por significado,
  enlaces, entrantes, vista previa, incrustados, tablas del panel, archivos, hoja, exportar, tiempo real, colaboración
  y MCP): un jugador de la campaña A ve lo suyo y uno de la B no; lo oculto no sale; quitar surte efecto al
  momento.
- **Una prueba por vía de fuga** (`research/legendkeeper/visibilidad.md`: las que corrigieron en siete años):
  «Mencionado en», el bloque de subpáginas y las tablas del panel, la vista previa de un enlace, exportar, las versiones
  y las recientes.
- **La prueba de fugas** (e2e) se amplía: dos jugadores de dos campañas leen la wiki y ninguno recibe ni un byte de lo
  que no ve (secretos sin revelar, notas, campos ocultos, títulos de páginas ocultas), ni por la API, ni por
  `/api/collab`, ni por `/api/realtime`, ni por el MCP.
- **Rendimiento**: con 5.000 páginas, el árbol y la búsqueda de un jugador, p95 < 300 ms.
- E2E: el máster marca «Aldoria» para la campaña A; el jugador de A la lee con sus subpáginas y el de B no; «Ver como
  jugador».

## Fuera

- Revelar secretos, los avisos y «Lo que sabe el grupo» (`revelar`); los mapas (`mapas-jugadores`); el compendio y las
  criaturas (`compendio-jugadores`); que los jugadores editen (`pagina-de-jugadores`).
- Exportar la wiki como jugador.
- Una web pública sin cuenta; co-máster y espectador.
