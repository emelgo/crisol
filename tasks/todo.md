# Tareas: Módulo 4 — compendio-mundo

Plan: `tasks/plan.md` · Spec: `docs/specs/compendio-mundo.md`. Cada tarea con sus pruebas antes (TDD) y su commit.

- [x] **1. La tabla `world_content`** (migración 0043): mundo, sistema, tipo, clave, datos, concepto, mecánica, página
  y origen; única por mundo, sistema y clave. En `TRACKED_TABLES` (historial y deshacer) y sus eventos en tiempo real
  (a quien ve el mundo). Repo `worldContentRepo`: índice, por claves, por tipo, guardar (con la versión de cada fila),
  quitar.
- [x] **2. La unión de las capas en `@crisol/systems`**: lo del mundo sin fuente, marcado y mandando en las claves; la
  huella de una entrada (`contentFingerprint`) y sus diferencias por campo (`contentDiff`).
- [x] **3. La campaña con las dos capas**: el compendio (tipos y cuentas, buscar, carpetas, leer, tablas del texto) y
  lo que leen los personajes; lo del mundo solo para quien puede cambiar el mundo (y, dentro de su hoja, lo que lleva
  un personaje). Pruebas de fugas. **Punto de control 1.**
- [x] **4. Las acciones nuevas**: guardar y quitar en el mundo (`putWorldContent`, `deleteWorldContent`), copiar entre
  capas (`copyContent`: del sistema al mundo y del mundo al sistema, quitando o no la del mundo), ver las diferencias
  con el original y traerlas (`getContentOrigin`, `pullContentOrigin`). Permisos, historial y deshacer.
- [x] **5. La web, el compendio con lo del mundo**: «Del mundo» marcado y su filtro, «Copiar al mundo», «Nueva entrada»
  en el mundo, cambiar y borrar lo del mundo (el editor de entradas, con su capa), «Llevar al sistema».
- [x] **6. La web, el aviso del original**: «El original ha cambiado» en la copia, su ventana con las diferencias por
  campo y «Traer» (todas o las elegidas); si el original ya no está, lo dice. **Punto de control 2.**
- [ ] **7. La IA**: `guardar_contenido` y `borrar_contenido` con `worldId`, `copiar_contenido`, `origen_contenido` y
  `traer_original`; las instrucciones del MCP y `formato_sistemas`.
- [ ] **8. Cierre**: e2e `compendio-mundo.spec.ts` (copiar el Goblin al mundo, cambiarlo, el aviso del original),
  axe, `tasks/probar.md`, `docs/modulos.md`. **Punto de control 3.**
