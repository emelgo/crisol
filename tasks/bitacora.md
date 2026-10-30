# Bitácora del módulo 1

Notas de trabajo para no perder el hilo entre compactaciones: decisiones pequeñas, por dónde va la tarea en curso y lo
que queda pendiente de Enrique. Lo que ya está hecho va a `docs/modulos.md` § «Dónde estamos» y a `tasks/todo.md`.

## Encargo

2026-10-30: Enrique se fue a dormir y pidió terminar el módulo sin parar, apuntándolo todo.

- **Ciclo de cada tarea**: rama, TDD, PR, 4 checks en verde, merge, despliegue y comprobación de staging.
- **Puntos de control 3 a 6**: no se espera; se apuntan aquí como pendientes de Enrique.
- **Lo que pide permiso** no se hace: se aparta aquí y se sigue con lo demás.
- **Al acabar el módulo**: apuntar por dónde vamos y dedicarse a la interfaz, que Enrique ve «horrible».

## Lecciones

- **Nunca dos comprobaciones completas a la vez**: las e2e comparten la base de datos y se pisan (salen fallos
  falsos). Antes de lanzar otra, que acabe la anterior.
- **El despliegue sale de `origin/main`** en una copia aparte (`scripts/desplegar-staging.sh`): se puede desplegar con
  trabajo a medias en la carpeta.

## Permisos de Enrique (2026-10-30, antes de irse)

- **Dependencias**: cualquier extensión oficial de TipTap 3.32 con licencia MIT, y `@floating-ui/dom`. Se apuntan en el
  PR de cada tarea. Si hiciera falta otra dependencia fuera de TipTap, se programa a mano o se deja apuntada aquí.
- **Volumen**: «archivos» en `compose.prod.yaml`, montado en la app (tarea 18).
- **Chromium**: dentro de la imagen de la app, para «Descargar PDF» desde el servidor (tarea 24). Cambia la decisión 2
  de la spec («imprimir ahora»): hay que actualizar la spec y la tarea 24. Para manejarlo desde el servidor,
  `playwright-core` (Apache-2.0) o lo que use menos.

## Pendiente de Enrique

Hay que contárselo al final, con lo que tenga que probar o revisar:

- Los puntos de control 3 (Markdown y Claude), 4 (versiones), 5 (búsqueda), 6 (hojas) y el final.
- **Para el punto de control 3**, Enrique tiene que añadir en claude.ai un conector MCP a staging
  (`https://neo.crisol.144-91-122-245.sslip.io/mcp`), con su cuenta de propietario. Después prueba crear_paginas con
  secretos y editar_pagina sobre una página que tenga abierta.

## Tarea en curso: 16, sesiones de edición en el historial

(Por empezar. Leer antes el ADR-0003, § sesiones y versiones, y la spec, § `versiones`.)

## Hechas en esta tirada

- **9** (PR #52): bloques, marcas, menú «/», barras, asa e ids. Decisiones apuntadas en `docs/modulos.md`.
  «Enlace a página» y proponer enlazar quedan para la 13.
- **10** (PR #53, en staging): el Markdown de ida y vuelta. Lleva también el arreglo de `collab.close()`, por un
  deadlock de la CI.
- **11** (PR #54): leer_pagina, crear_paginas y editar_pagina. El diseño está en `docs/modulos.md`. En la CI, la
  prueba de la barra de formato falló una vez (Alt+F10 antes de la selección nueva); arreglada en #54.
- **12** (PR #55, en staging): exportar en .zip.
- **13** (PR #56, en staging, con la migración 0012): enlaces, `page_links`, resolución sola y `[[`.
- **14** (PR #57, en staging, con la migración 0013): entrantes, menciones, «Enlazar», aviso al borrar y
  `enlaces_pagina`.
- **15** (rama `wiki/tarea-15-vista-previa`): vista previa, incrustados y aviso `pageContent`.
