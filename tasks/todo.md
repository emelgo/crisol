# Tareas: personajes

Plan: `tasks/plan.md`. Spec: `docs/specs/personajes.md`. Cada tarea, con TDD y en una porción que funciona; al acabar,
`pnpm lint`, las pruebas de lo tocado y un commit.

## Fase 1: la campaña en su vista, con su compendio

- [x] **1. Leer el contenido desde la campaña**: `searchCampaignContent` y `getCampaignContent` (permiso de leer la
  campaña; solo lo de sus fuentes). Pruebas de integración y de fugas (quien no está en la campaña no ve nada).
- [x] **2. La vista de la campaña**: rutas de inicio y compendio; la barra con Inicio (nombre de la campaña), Personajes,
  Compendio y Dados al entrar, con su animación; la llama vuelve a Mis mundos.
- [x] **3. El compendio**: tipos, buscador (sin tildes, en los dos idiomas), lista con «2024» / «2014 · Legado», la
  lectura de cada tipo (conjuro, criatura, clase con sus rasgos por nivel, objeto, regla…) y el panel con la edición,
  el nombre en inglés y la otra versión. En el móvil, lista y lectura una tras otra.

## Fase 2: el personaje

- [x] **4. El personaje en la base de datos**: tabla, versiones, permisos (dueño y máster), historial; acciones de
  crear, listar, leer, cambiar, borrar y cambiar el dueño; fugas.
- [x] **5. «Personajes» en la campaña**: tarjetas, «Personaje nuevo» (con quién lo juega, para el máster), su ventana,
  la vista previa al pasar.
- [x] **6. La ficha mínima**, calculada con `evaluate` desde sus elecciones.

## Fase 3: los pasos

- [x] **7. El formato de los pasos** (`creation`) y su validación (sus referencias; las fórmulas de `when`, al calcular).
- [x] **8. El motor de lo pendiente**: pasos + `grants` por nivel, opciones válidas y su motivo, requisitos.
- [ ] **9. Subir y bajar de nivel, multiclase y PG** (media o tirados en el servidor). Hechos subir, bajar y la multiclase con sus requisitos; **quedan los PG tirados** (por la media, ya).
- [x] **10. Los pasos del 5e** y lo que su contenido necesita; los personajes de referencia, por los pasos.

## Fase 4: el creador

- [x] **11. La cabecera y la barra de pasos** con sus (!); clase con sus niveles y rasgos; elegir en el panel.
- [x] **12. Especie, trasfondo, características (sus métodos), equipo y resumen.**
- [x] **13. Las versiones**: al terminar y al confirmar cada nivel; verlas y restaurar.

## Fase 5: tablas e IA

- [x] **14. Las tablas**: el dato, su validación, la tirada con su registro, sin reemplazo por campaña; la pestaña
  «Tabla»; las del SRD.
- [x] **15. Las herramientas MCP** de personajes y tablas, con sus aprobaciones; los pasos en `formato_sistemas`.
- [ ] **16. Cierre**: e2e (crear de nivel 1, subir a 5 con multiclase, restaurar, tirar en una tabla), axe, ritmo,
  revisión, PR y staging.
