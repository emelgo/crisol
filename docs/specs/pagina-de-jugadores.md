# Spec: pagina-de-jugadores (módulo 5)

Estado: **construido** (2026-11-07; en la rama `modulo-5/visibilidad`, aún sin PR). Última capacidad del módulo 5 (`docs/specs/modulo-5.md`). Entrevista:
`docs/modulos.md` § «### 5. Visibilidad por campaña» («como mucho, el máster deja editar una página concreta, como el
diario del grupo»). ADR-0017.

## Objetivo

Que el máster deje a los jugadores **escribir en una página concreta**: el diario del grupo, la lista de pistas, el
mapa de relaciones que llevan ellos. El resto de la wiki la siguen solo leyendo; las notas personales y el chat son
del módulo 7.

Para quién: el máster, que lo permite; los jugadores, que escriben; la IA de los dos.

## Requisitos

- En «Quién la conoce» de una página, en una campaña: **«Pueden editarla»**, para toda la campaña o unos personajes.
  Quien puede editarla la ve (aunque no tenga otra marca).
- **Escriben como el máster**: el editor completo, en vivo con los demás (Yjs), con su historial, sus versiones y
  deshacer a su nombre. Las subpáginas no heredan el permiso de editar (sí el de ver, como siempre).
- **Lo que no pueden**: cambiar el título, mover, borrar, el panel, las pestañas, ni quién la conoce. Tampoco crear
  secretos ni notas ocultas.
- **Sin secretos**: una página que editan los jugadores no puede tener secretos ni notas ocultas del máster (verían
  dónde están y podrían borrarlos). Permitirlo en una página que los tiene lo dice y no deja hasta sacarlos; y el
  editor del máster no ofrece «Secreto» en una página que editan.
- **El historial** dice quién escribió («Lía editó «Diario de la compañía»»); el máster deshace lo de un jugador como
  lo de cualquiera.
- **La IA del jugador** escribe en ella con `editar_pagina` (sus modos y su aprobación, como la del máster).

## Decisiones (propuestas, por confirmar al ver las pantallas)

1. **Sin secretos en una página de jugadores**, en lugar de esconder sus nodos: el cuerpo en Yjs va entero a quien lo
   edita (ADR-0017).
2. **El permiso de editar no se hereda**: escribir en una subpágina se da a mano.

## Construido (2026-11-07) y lo que queda

- **Servidor**: `page_editors` (migración 0054, con historial: se deshace) y `setPageEditors` (toda la campaña, unos
  personajes o nadie; quien la edita la ve: se suma a quien ya la ve, como al revelar). Una página con secretos o notas
  ocultas no se deja (`PAGE_HAS_SECRETS`) y en una de jugadores no se crean (`PLAYER_PAGE`, también por `editPage`). La
  colaboración en vivo deja abrir el cuerpo de esa página a quien la edita (y nada más); al cambiar quién edita se
  cierran las conexiones de los jugadores. `editPage` de un jugador, solo el texto. `getPage` dice `editable` (al
  jugador) y `editedByPlayers` (al máster).
- **Web**: en «Quién la conoce», «La edita toda la campaña / La editan…» por campaña; la jugadora escribe en vivo en su
  página (en texto corrido, enlazando lo que conoce, sin subir archivos); el editor de los dos, sin «Secreto» ni notas
  ocultas en ella.
- **IA**: `dejar_editar`; la IA de un jugador escribe con `editar_pagina` en una página suya (solo el texto).
- **Pruebas**: `player-pages.integration.test.ts`, la de la colaboración en vivo, la del MCP y la e2e
  `pagina-de-jugadores.spec.ts`.
- **Queda**: si una página que editan deja de verse (se oculta), el permiso sigue pero no la abre: el máster se lo
  quita aparte; una marca «La escribe tu grupo» en la página de la jugadora.

## Pruebas

- Servidor y colaboración: el jugador con permiso abre el cuerpo en Yjs para escribir; sin permiso, se le niega; no
  puede cambiar el título ni el panel; no se puede permitir con secretos dentro.
- E2E: el máster deja editar «Diario» a la campaña; la jugadora escribe y el máster lo ve en vivo; el otro jugador de
  otra campaña no la ve.

## Fuera

- Páginas propias de cada jugador, sus notas y su diario personal (módulo 7).
- Que los jugadores creen páginas nuevas.
