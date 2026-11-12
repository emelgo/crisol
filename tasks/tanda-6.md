# Tanda 6 — Sistemas: su espacio, sus portadas y sus libros

Rama `revision/tanda-6` (sale de `revision/tanda-5`). Plan general en `tasks/plan-revision.md` § «Tanda 6». Se
construye con capturas de antes y después (como la 5): Enrique revisa las tandas juntas.

## Porciones

- [x] 1. **El paquete de iconos de rol**: 337 de game-icons.net (CC BY 3.0), «gi:<id>» junto a los emojis, con su
  buscador y su crédito; `listar_iconos` en el MCP.
- [x] 2. **Los espacios, declarados** (`components/spaces.ts`): mundo, campaña y sistema, con su vuelta. La barra los
  usa en lugar de mirar solo si se está en un mundo; para el mundo, sin cambio a la vista (las e2e de la barra, antes y
  después).
- [x] 3. **El espacio del sistema**: al entrar, la barra cambia como en un mundo (lo de la cuenta sube a la llama y
  salen Inicio, Compendio y Reglas; Ajustes, abajo, en ventana) y la llama vuelve a Sistemas. Su Inicio: la portada y
  los libros, sin el icono fijo ni la palabra «Sistema». Reglas, «pronto» (tanda 8). El fondo de ambiente, su portada.
  (Compendio, en la barra, llega con la porción 5.)
- [x] 4. **Icono y portada del sistema** (formato, contrato, MCP, al crearlo y en sus ajustes); **libros con portada o
  color** elegido, la portada con el selector de archivos.
- [x] 5. **El libro por dentro y el compendio del sistema**: tres columnas (su árbol por tipo con buscador, la entrada,
  sus datos); «Entrada nueva» pide el tipo y abre su formulario (`campaign/entry-editor.tsx`), que guarda en el libro.
  El compendio deja de depender de una campaña; en el servidor, las lecturas del compendio de un sistema por libro.
  (Hecho con el compendio de dos columnas que ya había: su lista y la entrada con sus datos; las tres columnas, si
  hace falta, tras la revisión.)
- [x] 6. **Crear un sistema: tres caminos** en el cuadro: con tu IA (no se pulsa: conecta el MCP), con el esqueleto
  (la comprobación dice qué falta, dónde y un ejemplo; también un zip de Foundry) y a mano (tanda 8). (Pendiente: el
  ejemplo en cada problema de la comprobación, que hoy dice qué y dónde.)
- [x] 7. Crítica (24/40, `.impeccable/critique/2026-11-12T11-42-48Z__apps-web-src-systems.md`) y audit (15/20) de
  impeccable, con sus arreglos: el libro por dentro con su índice por tipos; «Sistema nuevo» con caminos que se eligen;
  el fondo y el icono del sistema en todo su espacio; la portada en los ajustes, con lo demás; «Más iconos» flotante;
  Reglas con lo que trae; «Libro nuevo» con línea continua; los iconos con flechas; los tutoriales; h2 en las tarjetas
  de Sistemas; el texto de una entrada a 70 caracteres; las tapas sin color, de la paleta fija. Audit: accesibilidad 3,
  rendimiento 3, temas 3, adaptable 3 (el máster, en PC), integridad 3.
