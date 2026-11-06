# Plan: Módulo 4 — compendio-mundo

Estado: en marcha (2026-11-06). Spec: `docs/specs/compendio-mundo.md` · Mapa del módulo: `docs/specs/modulo-4.md` ·
Diseño: lienzo «Crisol: compendio y criaturas» (fuentes en `out/lienzo-compendio/`) · Tareas: `tasks/todo.md`. Los
planes anteriores, en `tasks/<capacidad>/` (el último, `tasks/personajes/`).

## Cómo

- **Una tabla aparte, `world_content`**, con las mismas columnas que `system_content` más el mundo y el origen. Así
  nada de lo que ya lee el contenido de un sistema (bajarlo, contarlo, subirlo encima) ve lo del mundo por accidente.
  Cada entrada lleva su propia versión (la de la fila): cambiar lo del mundo no sube la versión del sistema.
- **Las dos capas se unen en el servidor**, en el sitio donde hoy se lee el contenido de la campaña (`campaignSystem`
  en `actions/compendium.ts` y el contexto de los personajes): lo del mundo va sin fuente (sale siempre), marcado, y
  manda en las claves. El paquete `@crisol/systems` da la unión, la huella y las diferencias, puras y probadas.
- **Hasta el módulo 5, lo del mundo solo para quien puede cambiar el mundo**; un jugador lo recibe solo dentro de lo
  que lleva su personaje (su hoja). La prueba de fugas lo comprueba.
- **De abajo arriba y en porciones que funcionan**: la tabla y su repo → la unión en el paquete → la campaña con las dos
  capas → las acciones nuevas → la web → el aviso del original → la IA → el cierre.

## Riesgos

- Lo que hoy pide la versión del sistema para guardar (el editor de entradas) cambia de forma para lo del mundo: el
  editor tiene que saber a qué capa escribe.
- Los personajes leen el contenido por clave: si una clave del mundo coincide con una del sistema, cambia lo que lleva
  un personaje. Es lo que dice la spec (manda la del mundo), con su prueba.

## Puntos de control

1. Tras la tarea 3: la campaña ve lo del mundo (creado por la API) en su compendio; el jugador no.
2. Tras la 6: el flujo entero en la web (copiar al mundo, cambiar, el aviso del original).
3. Tras la 8: e2e, la IA desde claude.ai y `tasks/probar.md`.
