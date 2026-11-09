# Las imágenes de Roliando (portada, Taller y pantallas de cuenta)

Módulo de Crisol: interfaz (fondos y tarjetas) · Fecha: 2026-11-10 · Versión estudiada: roliando.com (interfaz
«Tinta»), su página `/licencias` actualizada el 2026-11-08

## Pregunta

De dónde salen las ilustraciones de las tarjetas del Taller (Biblioteca, Sistemas, Módulos, Aventuras, Tokens, Dados,
Puzzles, Apps de mesa, Macros, Bazar), las de la portada y las de las pantallas de cuenta; si se pueden usar; y cómo
conseguiríamos algo parecido con licencia clara.

**Cómo se miró.** La página de licencias; la lista de imágenes de la portada, de «Entrar» y del Taller con el navegador
(nombre, tamaño natural); y una descarga temporal de dieciséis de ellas, fuera del repo, para leer su cabecera y buscar
metadatos. Se borraron al acabar.

## Lo que hacen

- **Lo dicen ellos**: en «Licencias y atribuciones», apartado «Ilustraciones de la web», las imágenes de fondo de la
  portada y de las páginas públicas son **imágenes de stock con licencia de Adobe Stock**; los marcos de token «de
  clase» son arte comprado con licencia, y los aros de los marcos, dibujo propio. Para el resto de la interfaz citan
  licencias comerciales compradas.
- **Son las mismas imágenes en todas partes.** La portada usa una carpeta de «escenas de stock» (un castillo verde de
  héroe, que también es el fondo de «Entrar», y una decena de láminas que aparecen al bajar: cueva del trol, aldea de
  bestias, torre del mercado, ruinas de ceniza, catedral de la maga, dragón de cristal, coloso nevado, claro mecánico,
  dragón del desfiladero). El Taller usa las mismas (con otros nombres de carpeta) más unos «fondos» numerados para el
  telón de cada página: la columna de Módulos es la catedral de la maga; la de Sistemas, una puerta de piedra; la de
  Aventuras, el dragón del desfiladero.
- **Metadatos: ninguno.** Todas son WebP del tipo sencillo, sin el bloque extendido que llevaría EXIF, XMP o perfil de
  color; no hay rastro de autor, banco, programa ni credencial de contenido (C2PA). Las sirve Cloudflare. Tamaños de
  1280 × 720 (o recortes panorámicos de 1280 × 400 a 768), versiones de 800 px para las columnas lejanas y una de 2400 ×
  1350 para el héroe. Están reescaladas y recomprimidas por ellos: el original de Adobe Stock no se puede rastrear por
  el archivo.
- **Estilo.** Fantasía épica oscura y cinematográfica, pero **sin un estilo común**: unas son pintura digital (el coloso
  nevado, con nieve y aurora), otras parecen render 3D con texturas sencillas (la puerta de piedra entre montañas),
  otras mezclan figura detallada y fondo pictórico con trazos de pincel (la catedral de la maga). Ninguna lleva firma ni
  marca de agua visible. Es lo típico de un lote de stock de varios autores; Adobe Stock admite imágenes hechas con IA
  generativa (las marca como tales), así que alguna podría serlo, pero **no se puede afirmar** sin el original.
- **Lo que unifica el conjunto es el tratamiento, no las imágenes**: todas van muy oscurecidas con un velo degradado,
  las columnas que no están en el centro se **desaturan** (una capa de color en modo «saturación») y se apagan, hay un
  grano de papel por encima, y el telón de fondo de cada pantalla tiene un modo «tenue» al 38 % de opacidad. Por eso imágenes
  dispares parecen de la misma familia.

## Compromisos y límites

- **No se pueden usar.** La licencia estándar de Adobe Stock es de quien la compra (Roliando), no se transfiere y no
  permite redistribuir el archivo; además ellos la sirven recomprimida, y copiarla sería usar una obra ajena sin
  licencia. Tampoco los marcos de token de clase (comprados) ni los demás recursos con licencia comercial. ADR-0014 no
  cambia esto: el visto bueno es para Foundry, dnd5e y D&D Beyond, no para el stock que pagó otro.
- Lo que sí es libre en su lista (y Crisol podría usar con su atribución, como ellos): iconos de game-icons.net (CC BY
  3.0), Lucide (ISC), texturas de Poly Haven y ambientCG (CC0), assets de Kenney (CC0), efectos de JB2A (gratuitos),
  mapas de Tom Cartos (licencia TOM, con marca de agua), sonidos CC0 de Freesound, el tarot de Pamela Colman Smith
  (dominio público). Ojo: las cartas francesas que citan son **LGPL 3.0**, que es copyleft y queda fuera para Crisol.
- Su ventaja: un catálogo coherente sin encargar arte. Su coste: imágenes que no son suyas y que cualquiera puede tener.

## Qué nos llevamos a Crisol

1. **No traer ninguna de sus imágenes.** Si se quiere algo parecido para las tarjetas o el Taller de Crisol, tres vías
   con licencia clara, de más a menos fácil:
   - **La que ya usamos para los fondos de «Entrar»** (`docs/terceros.md`, 2026-11-08): Pixabay (licencia de uso libre,
     con la marca de IA cuando la lleva) y pintura de dominio público de Wikimedia Commons (Vasnetsov, Bierstadt,
     Böcklin, Church, Cole, Aivazovski…). Hay de sobra para diez tarjetas de fantasía.
   - **Generarlas nosotros** con IA (craft-anything tiene generación de imágenes) a partir de una dirección de arte
     propia, guardando en `docs/terceros.md` el modelo, la fecha y que son generadas; da un estilo único y nuestro.
   - **Comprar** un lote de stock o encargar arte, si un día Crisol se vende.
2. **Copiar el tratamiento, no las imágenes**: velo oscuro degradado, desaturar lo que no está en foco y devolverle el
   color al destacarlo, grano de papel encima y telón tenue detrás del contenido. Es lo que hace que un lote dispar se
   vea como una familia, y funciona igual con Pixabay o con dominio público (ver `transiciones.md`).
3. **Quitar metadatos y reescalar** al publicar (WebP de 800 y 1280 px, una mayor para el héroe), pero **guardar la
   procedencia en `docs/terceros.md`**, que es justo lo que a Roliando le falta por archivo.
