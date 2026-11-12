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
- [ ] 7. Crítica y audit de impeccable, arreglos, capturas y la página de revisión.
