# Plan: libros y el espacio de la campaña

Spec: `docs/specs/libros.md` · ADR-0021 · Lienzo aprobado: https://claude.ai/artifact/6RYct1c2kikxuTZyqkEpTb.
Rama: `docs/tras-revision` (sigue la tanda; el PR, al final, con la CI una vez).

## Orden (porciones verticales, cada una con sus pruebas)

1. **Dominio**: los campos nuevos del libro en el formato (`packages/systems/src/format.ts`), `excluded` en las
   elecciones (`choices.ts`), `visibleContent` sin lo excluido ni lo pendiente, recuentos por libro.
2. **Servidor: libros**: `createBook`, `updateBook`, `deleteBook`, `getSystemBooks` (contratos, acciones, historial,
   MCP) y el compendio de la campaña con sus libros (portada, recuento, excluidas, el del mundo) y libro/página por
   entrada.
3. **Servidor: pendientes**: columna `review` en `system_content` (migración), `proposeContent`, `listPending`,
   `acceptPending`, `discardPending`; que nada que lea el contenido vea lo pendiente.
4. **Web: el espacio de la campaña**: rutas (Inicio, `/mesa`, `/libros`, `/aventuras`; las vistas que redirigían a la
   Mesa vuelven a ser pantallas), la barra de la campaña, la Mesa con la barra de la izquierda, Ajustes encima, las
   direcciones viejas.
5. **Web: Inicio** del máster y de la jugadora (también en el móvil).
6. **Web: Libros de la campaña** (tarjetas, interruptores, «Elegir contenido»).
7. **Web: Sistemas → Libros**: tarjetas, ficha en ventana con su transición, ajustes del libro, «Libro nuevo».
8. **Web: la revisión**.
9. **Web: el compendio por libro** (pantalla y pestaña de la Mesa) y el creador con libros.
10. **Cierre**: tutoriales guiados, e2e + axe, revisión, `docs/modulos.md`, `tasks/probar.md`.
