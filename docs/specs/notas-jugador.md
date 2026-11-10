# Spec: las notas del jugador (módulo 7)

Capacidad `notas-jugador` del módulo 7 (`docs/specs/modulo-7.md`). Estudio: el Crisol antiguo
(`apps/player-web/src/personaje/NotasJugador.tsx`). La spec de la página de jugadores
(`docs/specs/pagina-de-jugadores.md`) las dejó para aquí.

## Objetivo

Que cada jugador apunte lo suyo sobre la campaña (sospechas, nombres, lo que piensa de un PNJ) en páginas propias,
cómodas desde el móvil, enlazadas a lo que conoce del mundo. Las lee el máster (le sirve para preparar) y no los demás.

**Historias**

- Como jugador, en el espacio de la campaña (y en mi Mesa) tengo «Mis notas»: creo páginas, con subpáginas si quiero,
  y escribo como en la wiki (se guarda solo).
- Como jugador, enlazo `[[Aldric Varn]]` y solo se me ofrecen y se me abren las páginas que conozco.
- Como máster, veo las notas de cada jugador (de solo lectura) desde la campaña.
- Como otro jugador, no las veo ni sé que existen.
- Como IA conectada por un jugador, leo y escribo sus notas; conectada por el máster, las leo.

## Comportamiento

- **Qué son**: páginas de Markdown con título e icono, en un árbol propio de cada jugador y campaña, con el mismo
  editor de la wiki (`packages/editor`) pero sin panel, plantillas ni pestañas; con historial de versiones como las
  páginas.
- **Dónde se guardan**: tabla propia (`player_notes`), no páginas del mundo: así no se mezclan con el árbol de la wiki,
  la búsqueda ni lo que sabe la campaña. Los enlaces apuntan a páginas del mundo y se resuelven con lo que conoce su
  campaña (`docs/specs/conocimiento.md`).
- **Quién**: las escribe su autor; las lee él y los másteres de la campaña y del mundo. Si deja la campaña, siguen ahí
  (el máster puede leerlas); si se borra la campaña, se van.
- **Móvil**: lista y editor a pantalla completa, con la barra de formato de la wiki para el móvil.
- **El diario del grupo** sigue como está (la página que el máster deja editar).

### IA (MCP)

`ver_notas` (las de un jugador; el máster indica cuál), `leer_nota`, `escribir_nota` (solo su autor).

## Contratos (propuesta)

- Tabla `player_notes`: `id`, `campaignId`, `userId`, `parentId`, `title`, `icon`, `markdown`, columnas de
  seguimiento (historial), orden.
- `listPlayerNotes({ campaignId, userId? })`, `getPlayerNote`, `createPlayerNote`, `updatePlayerNote` (con versión),
  `deletePlayerNote` (a la papelera, como las páginas).
- Permisos `notes.write` (autor) y `notes.read` (autor y másteres).

## Pruebas

- Integración: crear, editar, borrar y restaurar; otro jugador recibe «no existe»; el máster lee y no escribe; los
  enlaces solo a lo que conoce; el MCP con cada rol.
- Web: «Mis notas» en el espacio de la campaña y en la Mesa, el editor en el móvil, la vista del máster.
- e2e: la jugadora escribe una nota con un enlace y el máster la lee.

## Criterios de éxito

1. Ninguna petición de otro jugador ve una nota ajena ni su título.
2. Se escribe una nota desde el móvil con una mano, enlazando una página que se conoce.
