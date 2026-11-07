/**
 * La guía para que la IA dibuje mapas de batalla en SVG (docs/specs/escenas.md § «Mapas dibujados por la IA»): la
 * técnica del mapa de la cripta del lienzo de la mesa. Se sirve como recurso del MCP (guia_mapas)
 */
export const MAPS_GUIDE_RESOURCE = 'crisol://mapas/guia'

export const MAPS_GUIDE = `# Cómo dibujar un mapa de batalla en SVG para Crisol

Un mapa es un SVG que se pinta como imagen (sin scripts, sin nada de fuera: solo referencias de dentro, \`url(#id)\` y
\`href="#id"\`). Se manda con \`dibujar_escena\` a una escena (una pestaña de tipo scene; créala con \`crear_pestana\`),
y Crisol lo guarda como archivo del mundo; el máster lo trocea al abrirlo en la mesa.

## El lienzo

- \`<svg xmlns="http://www.w3.org/2000/svg" width="…" height="…">\` con medidas en píxeles, **múltiplos de la casilla**.
  Una casilla de **100 px** (5 pies) va bien: 30 × 20 casillas son 3000 × 2000 px. Como mucho 16384 px de lado y 4 MB.
- **No dibujes la rejilla**: la pinta Crisol encima (luego pon su tamaño con \`cambiar_escena\`: \`size\` 100, desfase 0).
- Ni textos ni etiquetas en el mapa: lo verían los jugadores. Los nombres van en la wiki y en los pines.
- Vista cenital, sin perspectiva. Colores apagados y oscuros: las fichas y la luz tienen que destacar.

## Las capas, de abajo arriba

1. **Lo que hay fuera** (roca, tierra, agua profunda): un \`<rect>\` a todo el lienzo con un filtro de ruido. El ruido
   fractal da piedra sin imágenes:
   \`<filter id="roca"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="5" seed="7"/>
   <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.145  0 0 0 0 0.13  0.9 0 0 0 -0.3"/></filter>\`
   (cambia \`seed\` para otra piedra; \`baseFrequency\` más alto, grano más fino; la matriz da el color).
2. **Los suelos**: polígonos o rectángulos rellenos con un patrón del tamaño de la casilla (o de media), con losas
   redondeadas de tonos algo distintos y alguna grieta (\`<path>\` fino y oscuro):
   \`<pattern id="losas" width="100" height="100" patternUnits="userSpaceOnUse">…</pattern>\`, y \`fill="url(#losas)"\`.
   Para el desgaste, otro filtro de ruido en gris mezclado en modo multiplicar sobre el suelo (\`feBlend\` y
   \`feComposite operator="in"\` para no salirse de la forma).
3. **Los muros**: el borde de cada sala y pasillo, con un trazo grueso y oscuro (12–20 px, \`stroke-linejoin="round"\`),
   o polígonos de roca entre salas. Una cueva es un \`<path>\` con curvas (C o Q) irregular.
4. **Lo que hay dentro**: columnas (círculos con un degradado), sarcófagos, mesas, escaleras (rectángulos en franjas),
   cajas, un altar, agua (\`radialGradient\` de azul oscuro). Siempre a escala de la casilla: una columna, una casilla.
5. **Las puertas**: un rectángulo de madera en el hueco del muro, del ancho del hueco.
6. **La luz pintada** (si quieres ambiente): círculos con un \`radialGradient\` naranja que se desvanece (la
   opacidad, de 0,55 a 0) alrededor de antorchas y braseros. La niebla y la visión las pone Crisol.

## Los muros, las puertas y las luces para la niebla

Si mandas también \`walls\`, \`portals\` y \`lights\` en \`dibujar_escena\` (en píxeles del SVG), la niebla automática sabrá
por dónde se ve:
- \`walls\`: polilíneas que siguen los bordes de los muros (por el centro del trazo); una por tramo de pared seguido.
- \`portals\`: cada puerta de extremo a extremo del hueco (\`a\`, \`b\`; \`closed\`: cerrada; \`window: true\` para una
  ventana que deja ver pero no pasar).
- \`lights\`: el centro de cada antorcha con su alcance (\`range\` en píxeles: 400 son 20 pies), \`intensity\` de 0 a 1,
  su \`color\` (#rrggbb) y \`shadows: true\` si los muros la cortan.

## Antes de mandarlo

Repasa que cada sala tiene salida, que las puertas caen en un hueco de muro y que el mapa entero cabe en las medidas.
Un mapa típico pesa entre 10 y 60 KB: usa patrones y \`<use href="#…">\` para repetir en vez de copiar formas.
`
