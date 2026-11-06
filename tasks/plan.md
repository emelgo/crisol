# Plan: Módulo 4 — tablas-compendio

Estado: en marcha (2026-11-06). Spec: `docs/specs/tablas-compendio.md` · Mapa: `docs/specs/modulo-4.md` · Tareas:
`tasks/todo.md`. Los planes anteriores, en `tasks/<capacidad>/`.

## Cómo

- **«Tabla» es un tipo de Crisol** (`tabla`): `withTables(system)` lo añade a todo sistema que no lo tenga (con su
  descripción), así que cualquier sistema, también el vacío, tiene tablas. El convertidor de Foundry ya usaba esa clave.
- **La tabla estructurada** va en el contenido como `table` (jsonb en `system_content` y `world_content`, migración
  0046), solo en las entradas de tipo `tabla`: fórmula (sin ella, 1dN por la última fila), reemplazo y filas (id,
  rango, texto y, si se dice, la clave de otra entrada del compendio: si esa entrada es una tabla, se tira también,
  hasta 5 niveles). Se valida con los mismos problemas de rangos que la pestaña «Tabla» (`tableProblems`).
- **Tirar**: `rollContentTable` sin `table` (el orden de las del texto) tira la estructurada, con el mismo cálculo que
  `rollOnTable` (sin repetir: una de las que quedan). Lo sacado, por campaña y clave (`content_table_draws`), y
  `resetContentTable` lo borra. `getCampaignContent` dice lo sacado (`drawn`).
- **Foundry**: los RollTable pasan a `table` (rangos, fórmula, reemplazo; los resultados de documento del mismo zip,
  por su clave; los de fuera, como texto).
- **Web**: en la entrada del compendio, las filas con lo sacado marcado, «Tirar» y «Reiniciar»; el resultado lleva a
  su entrada. Crear y cambiar las del mundo, con el editor de la entrada.
- **IA**: `tirar_tabla_compendio` (sin orden, la estructurada) y `reiniciar_tabla_compendio`; `guardar_contenido` lleva
  `table`.

## Puntos de control

1. Tras la tarea 3: importar el dnd5e real y tirar en una de sus tablas por la API.
2. Tras la 5: verlo en la web.
