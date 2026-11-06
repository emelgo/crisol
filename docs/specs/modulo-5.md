# Módulo 5: lo que ven los jugadores

Mapa de capacidades (2026-11-06), de la entrevista con Enrique (`docs/modulos.md` § «### 5. Visibilidad por
campaña»). Cada capacidad tiene su spec en `docs/specs/<id>.md` y su ciclo (diseño, plan, construcción y revisión),
en este orden. La decisión de fondo, en el ADR-0017. Los estudios: `research/foundry/visibilidad-y-revelar.md` y las
notas `visibilidad.md` de LegendKeeper, World Anvil y Kanka; los de antes que sirven, `research/foundry/journal.md`
(los secretos y «mostrar») y `research/foundry/usuarios-y-permisos.md` (qué nos llevamos: el servidor filtra cada
lectura, herencia viva o ninguna, revocar al momento).

| Id | Qué hace | Depende de |
|---|---|---|
| `conocimiento` | Lo que sabe cada campaña: marcar una página como conocida (en el mundo o en una campaña, para todos o para unos personajes), con herencia viva a sus subpáginas y excepciones; cómo empieza una campaña (lo del mundo, nada o lo de otra); los campos y bloques del panel «solo máster»; **el jugador lee la wiki** desde su campaña (el árbol, la página, la búsqueda, los enlaces, la vista previa, el panel, las tablas, las etiquetas y los archivos), siempre filtrado en el servidor; «Ver como jugador»; la IA del máster marca y la del jugador lee; la prueba de fugas | — |
| `revelar` | Los secretos de una página, revelados a la campaña o a unos personajes; «Revelar» desde la propia página; el aviso al jugador y lo nuevo marcado hasta que lo abre; «Lo que sabe el grupo» (repasar, deshacer, ocultar otra vez); la IA revela con aprobación | `conocimiento` |
| `mapas-jugadores` | Las pestañas, los pines, las regiones y las rutas de un mapa: siguen a su página y se pueden ocultar y revelar uno a uno; el jugador ve el mapa con lo suyo; revelar desde el mapa; la IA | `conocimiento` |
| `compendio-jugadores` | Las entradas del compendio del mundo, reveladas una a una; ocultar en una campaña un tipo o una sección del compendio del sistema; las criaturas en juego, a la vista de los jugadores con su estado en palabras («Herida») y sin su hoja; la IA | `conocimiento` |
| `pagina-de-jugadores` | Dejar que los jugadores (todos o unos personajes) editen una página concreta, como el diario del grupo; la IA | `revelar` |

Orden: `conocimiento` → `revelar` → `mapas-jugadores` → `compendio-jugadores` → `pagina-de-jugadores`. Lo primero
es que un jugador pueda leer algo sin fugas; lo de la partida (revelar) va justo después.

## Lo que se da por hecho (propuesta de Claude, por confirmar al verla)

1. **Dos capas de conocimiento**: la del mundo («lo sabe todo el mundo»: lo que conocen las campañas que parten del
   mundo) y la de cada campaña, que manda sobre la del mundo. Una campaña que empieza «de cero» no mira la del mundo;
   «lo mismo que otra» copia lo de esa campaña al crearla (una vez, no queda atada a ella).
2. **Por personaje**: lo que se revela a unos personajes lo ve la cuenta de su dueño. Un jugador con dos personajes en
   la campaña ve lo de los dos.
3. **El jugador lee por la API, no por Yjs**: la página le llega ya filtrada (sin los secretos que no ve, ni las notas
   ocultas, ni los campos «solo máster»), y se recarga sola cuando cambia. Abrir el cuerpo en Yjs le enseñaría dónde
   hay secretos aunque no su texto. Solo las páginas que puede editar (`pagina-de-jugadores`) se le abren en Yjs.
4. **Una subpágina más abierta que su madre** sale en el árbol del jugador colgada de la primera antecesora que ve (o
   arriba del todo), sin delatar los títulos de las ocultas. La miga de pan, igual.
5. **Un enlace a una página que no ve** no dice el nombre del destino: su texto propio si lo tiene y, si no,
   «desconocido», sin enlace (`docs/specs/conocimiento.md`, decisión 2).
6. **Los archivos**: un jugador abre un archivo del mundo solo si está en algo que ve (la portada o el panel de una
   página visible, o incrustado en un documento que ve).
7. **Las criaturas en juego** se ponen a la vista u ocultas (por defecto, a la vista); las ocultas no le llegan al
   jugador.
8. **Revelar es una operación** del historial, como todo: se deshace igual, y «Lo que sabe el grupo» es la lista de
   esas operaciones vigentes de la campaña.
9. **La IA**: revelar y ocultar son acciones de tipo «jugadores» (en copiloto esperan aprobación); marcar lo que sabe
   el mundo, también. La IA de un jugador entra con su cuenta, por el mismo OAuth, y ve lo mismo que él.
