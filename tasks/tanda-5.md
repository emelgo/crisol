# Tanda 5: cristal, Entrar y la portada (plan de construcción)

Lo que pidió Enrique (revisión del 2026-11-11): el cristal de la Mesa, en toda la app; Entrar y crear la cuenta con
imágenes nuevas (estilo F, que genera él); una portada pública sencilla. Rama `revision/tanda-5` (sobre la 4, sin
subir). Enrique revisa las tandas juntas: capturas de antes y después en `out/tanda-5/`.

## Porciones

1. [x] **Fondo de ambiente** (`components/ambient.tsx`): fijo detrás de todo y ya difuminado (480 px, `blur(48px)`, al
   40 % y con viñeta). En un mundo, su portada; en Inicio, la del mundo que se señala; si no, la de ambiente
   (provisional: el valle del ocaso). Quien lo pide lo pide mientras se ve (`useAmbient`); manda el último.
2. [x] **Lo que enmarca, de cristal sin backdrop-filter** (el fondo ya viene difuminado: no cuesta al bajar):
   `--surface-glass`, `--surface-glass-raised` y `--surface-read` en `styles/tokens.css`. La barra, las fichas de la
   wiki, las tarjetas (el marco de esquinas cortadas pinta su raya como un anillo, `--cut-ring`), las secciones con
   título, las vistas previas. La página, una hoja casi opaca: portada y texto, una pieza.
3. [x] **«Sin desenfoque»** en Ajustes («Este aparato», `components/plain.ts`, `html[data-plain]`): sin ambiente ni
   desenfoque en ninguna parte (también en la Mesa), todo opaco como antes.
4. [x] **El respaldo del cristal de la Mesa** (encontrado de paso: seis piezas translúcidas sin desenfoque): un navegador
   sin `backdrop-filter` tapa `--glass-tint` y `--glass-panel` con `--glass-solid`.
5. [x] **Entrar**: el recuadro de cristal con su desenfoque sobre las imágenes. Las imágenes nuevas (doce a dieciséis
   en estilo F) esperan a que Enrique las genere (`docs/imagenes.md`); mientras, las 24 de antes.
6. [x] **La portada pública** (`routes/home.tsx`): la imagen a toda pantalla con la barra transparente encima, la llama,
   el nombre, la frase, «Entrar» y «Tengo una invitación» (pide el enlace o el código y lleva a la campaña); debajo,
   tres estampas (capturas de la app: el mundo, la mesa, la ficha). La imagen, provisional (el valle).
7. [x] **Cerrar**: crítica (28/40; tres P1: el ambiente sin tope de luz, las rayas que se perdían y el ambiente dentro
   de las transiciones de vista) y audit (16/20) con sus arreglos, e2e (portada, accesibilidad, Archivos, mundos,
   Inicio, sesión, wiki, plantillas, sistemas, etiquetas, hoja, imágenes), `tasks/probar.md`, normas en
   `docs/diseno.md`, capturas en `out/tanda-5/` y la página de revisión.

## Sin tocar, a propósito

- La campaña hereda el fondo de ambiente y los marcos de cristal (son comunes); su tarjeta de escena sigue opaca. Se
  mira en su revisión.
- Los fondos de Entrar y las imágenes «ambiente» y «portada»: cuando Enrique las genere, se cambian sin tocar código
  (los mismos archivos).
