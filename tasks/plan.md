# Plan: la campaña alrededor de la Mesa

Estado: en marcha (2026-11-08). Lo pidió Enrique tras probar (norma en `docs/diseno.md` § «La campaña se abre en la
Mesa, como en Foundry VTT»). Diseño aprobado («está genial», con las 14 decisiones): lienzo «Campaña en la Mesa»
(https://claude.ai/artifact/1gY6Mun8KisrJ6d2fXGbLj; fuentes y capturas en `out/lienzo-campana/`, fuera de git).
Tareas: `tasks/todo.md`. El plan del módulo 6 (escenas) quedó en `tasks/escenas/`; su tarea 9 (e2e, fugas,
accesibilidad…) entra en la última tarea de este.

## Qué cambia

- **El máster abre la campaña en la Mesa** a pantalla completa, con una barra de pestañas a la derecha (iconos con su
  nombre, el panel debajo): Tiradas, Combate, Escenas, Personajes, Compendio, Páginas y Ajustes. Se abre la última
  usada (la primera vez, Escenas) y la barra se pliega.
- **Las vistas sueltas desaparecen**: En juego pasa a Escenas («En esta escena»: mostrar u ocultar, al combate);
  Biblioteca, a Compendio (categoría «Libros»); Revelado, a Páginas (un ojo en cada página conocida); Grupo, a la ficha;
  la portada de la campaña (personajes, miembros, invitar), a Personajes y Ajustes. Sus direcciones viejas redirigen a la
  Mesa con la pestaña que toca.
- **La barra izquierda se queda en lo mínimo**: la llama, la Mesa, el mundo (para escribir con calma) y la cuenta. La
  jugadora: la llama, su ficha y la Mesa.
- **Las páginas se abren en ventanas** sobre la Mesa: se mueven, se estiran, se minimizan abajo a la izquierda, varias a
  la vez; «Enseñar a los jugadores» se la abre a quien esté conectado. Las fichas de personajes y criaturas, también.
- **La jugadora abre la campaña en su ficha** (con «Ir a la Mesa» y la escena en marcha); en su Equipo, «Lo mío» y «Del
  grupo» (monedas del grupo, quién puso cada cosa; en PC se arrastra, en móvil con «⋯»). Su Mesa ve lo que ve el grupo
  (como la tele) con Tiradas, Combate, Personajes, Compendio y Páginas (las que conoce).
- Fuera de su pestaña, cada tirada sale un momento sobre el d20 (las ocultas del máster, en morado, «solo tú»).

- **Varias campañas por mundo** (Enrique, 2026-11-09): lo que se enseña desde la Mesa va solo a esa campaña; en la wiki
  del mundo, «quién la conoce» por campaña; con una sola campaña, sin preguntar a quién.
- **Cada campaña se abre en otra pestaña del navegador**, como en D&D Beyond (hecho).

## Cómo

- **Rutas**: `/mundos/$w/campanas/$c` pasa a ser la Mesa (máster) o la ficha (jugadora); `?panel=<pestaña>` elige la
  pestaña (para enlazar y para las redirecciones). `/mesa` → la campaña; `/en-juego`, `/compendio`, `/biblioteca`,
  `/paginas…`, `/grupo` → la campaña con su `?panel=` (y lo que llevaran, p. ej. `?ver=`). `/personajes/$id` se queda
  (el creador y la ficha a pantalla completa siguen haciendo falta). `/pantalla` (la tele) no cambia.
- **El armazón de la Mesa** (`apps/web/src/tabletop/`): `mesa.tsx` se parte; la barra derecha es un componente nuevo
  (`sidebar.tsx`, con `role="tablist"` y flechas), con un registro de pestañas por papel. Las herramientas que hoy
  sustituyen al panel (visión, marcas, pantalla del máster) lo siguen haciendo, encima de la pestaña abierta.
- **Ventanas** (`apps/web/src/components/windows/`): un gestor propio (sin dependencias) con posición, tamaño, orden,
  minimizada; arrastre por la cabecera y redimensionado por la esquina con puntero y con teclado; guarda dónde estaba
  cada una en el navegador (localStorage, con try/catch). Las páginas se pintan con lo que ya hay (`EntryView` del
  máster, `PlayerEntry` de la jugadora) en un modo «en ventana» sin la columna lateral. Los enlaces dentro de una
  ventana abren otra ventana, no cambian la vista.
- **Enseñar**: una acción nueva `showPage` (máster) que revela la página al grupo si hacía falta y manda por el canal en
  tiempo real `{ type: 'shown', what: 'page', … }` a los miembros conectados; su Mesa o su ficha la abre en ventana. El
  MCP la expone como herramienta.
- **La Mesa de la jugadora**: el canal de la mesa admite un tercer espectador, `player` (ADR nuevo, el 0019): recibe la
  proyección del grupo (la misma que la tele), no manda nada en vivo. La sala comprueba que es miembro de la campaña.
- **Del grupo**: el inventario del grupo ya existe (`getParty`, `moveItem…`); se añade `addedBy` a sus objetos
  (migración) para «Lo puso». La ficha de juego (`play-sheet.tsx`) gana la sección en su pestaña de equipo.
- **i18n**: textos nuevos en `apps/web/src/i18n.ts`; sin «Foundry», «D&D Beyond» ni «Claude» en la interfaz.

## Fases y puntos de control

1. **El armazón** (tareas 1–3): la campaña abre en la Mesa con la barra derecha y sus pestañas (con lo que ya hay
   dentro), la barra izquierda corta, las redirecciones, Ajustes. → Punto de control 1: el máster entra y lo encuentra
   todo; pruebas y tipos en verde.
2. **Las pestañas** (tareas 4–6): Tiradas (y el aviso sobre el d20), Escenas con «En esta escena», Compendio con Libros,
   la ficha rápida y el arrastre de objetos. → Punto de control 2.
3. **Las ventanas** (tareas 7–9): el gestor, Páginas en ventanas (máster y jugadora), Enseñar, fichas en ventana. →
   Punto de control 3.
4. **La jugadora** (tareas 10–12): abre en su ficha, «Del grupo», su Mesa. → Punto de control 4.
5. **Cierre** (tarea 13): recorridos, e2e, accesibilidad, documentación (ADR-0019, `docs/diseno.md`, specs afectadas,
   `tasks/probar.md`), revisión y PR.

## Riesgos

| Riesgo | Impacto | Cómo |
|---|---|---|
| `mesa.tsx` (1466 líneas) es frágil y tiene muchas pruebas | Alto | Partirlo por piezas sin cambiar lo que hace, con sus pruebas en verde antes de tocar la barra |
| El editor de páginas (colaborativo) dentro de ventanas: foco, tamaños, varias a la vez | Alto | Primero la lectura en ventana; el editor después, una sola ventana editando a la vez si da guerra |
| Muchas pruebas y e2e apuntan a las vistas viejas | Medio | Redirecciones en lugar de borrar rutas; actualizar las pruebas en cada tarea, los e2e al final |
| La Mesa de la jugadora toca el servidor de la sala | Medio | Reusar la proyección de la tele; pruebas de integración de permisos |
| Ventanas y móvil | Bajo | En móvil solo cuenta la jugadora: allí las páginas se abren a pantalla completa, no en ventana |

## Fuera de esta tanda

- «Archivar» la campaña (decisión 13): no existe en el servidor; se apunta para después y se dice a Enrique.
