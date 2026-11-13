# El mundo a pantalla completa (plan)

Rama `modulo-9/mapas`. Propuesta aprobada: `docs/propuestas/wiki-pantalla-completa.md` (Enrique, 2026-11-13, con sus
seis respuestas). Decisión: `docs/adr/0027-mundo-a-pantalla-completa.md`. Etiqueta para volver atrás:
`antes-pantalla-completa`. Todo en local, `[skip ci]`. La crítica y el audit de impeccable los hace la sesión principal
al final.

## Porciones

- [x] 1. **Lo común, aparte, sin cambios a la vista**: `files.tsx` partido (la lista-árbol en `files-section.tsx` y sus
  piezas); de `Ribbon`, los ganchos de cuenta y mundo, Historial y Papelera (`world-hooks.ts`) y las animaciones de la
  llama (`crucible.module.css`).
  - Verifica: vitest de Archivos, mundo y wiki; `tsc`.
- [x] 2. **`WorldShell`**: `bare` para el mundo del máster; la cabecera fina (llama, el mundo con su menú, las pestañas
  abiertas una sola vez, buscar, la cuenta), la barra izquierda (Páginas: buscador, árbol y marcadores; plegable,
  estirable y recordada) y el centro con su desplazamiento propio; mapa y pizarra de borde a borde. Ayudantes de e2e
  (`abrirArbol`, `abrirArchivosDelMundo`).
  - Verifica: vitest del armazón (pestañas, plegar, recordar), capturas a 1600 y 1440 px, la pizarra sin pasar a su
    interfaz de móvil.
- [ ] 3. **Entrar y salir**: la tarjeta crece hasta la cabecera; lo de la barra de la app sube a la llama y se va; la
  llama de la cabecera se aviva y los iconos salen a la barra izquierda. Salir por la llama: humo, los iconos suben y la
  barra de la app vuelve con «Mundos» saliendo de la llama.
  - Verifica: capturas a mitad de cada transición; vitest de las señales (recién entrado, recién salido).
- [ ] 4. **Archivos en la barra y en el centro**: la lista-árbol en pequeño (buscar, subir, carpetas) en la pestaña
  Archivos; pulsar un archivo lo abre en el centro como pestaña abierta (imagen, PDF, audio, vídeo, texto) con su vista
  previa y sus ajustes en el panel; «Ver todos» abre la pantalla grande en el centro.
  - Verifica: vitest de la lista pequeña y del visor; e2e de Archivos.
- [ ] 5. **El panel plegable y el título flotante**: plegar el panel de la página (recordado); en mapas y pizarras, el
  título y las pestañas en cristal sobre el lienzo.
  - Verifica: capturas con el panel plegado; vitest de recordar.
- [ ] 6. **Tutorial y e2e**: el tutorial del mundo con los pasos nuevos (cabecera, barra izquierda, página y panel, la
  llama); las e2e que entraban por la barra o la ficha del árbol, al día con los ayudantes.
  - Verifica: vitest de la web entera; las e2e que tocan el mundo.
