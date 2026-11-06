# Spec: pagina-de-jugadores (módulo 5)

Estado: **en marcha** (2026-11-06). Última capacidad del módulo 5 (`docs/specs/modulo-5.md`). Entrevista:
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

## Pruebas

- Servidor y colaboración: el jugador con permiso abre el cuerpo en Yjs para escribir; sin permiso, se le niega; no
  puede cambiar el título ni el panel; no se puede permitir con secretos dentro.
- E2E: el máster deja editar «Diario» a la campaña; la jugadora escribe y el máster lo ve en vivo; el otro jugador de
  otra campaña no la ve.

## Fuera

- Páginas propias de cada jugador, sus notas y su diario personal (módulo 7).
- Que los jugadores creen páginas nuevas.
