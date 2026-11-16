# ADR-0028: Vuelve el armazón de siempre; la página del mundo, como la de Everlore, se queda

Estado: aceptada (Enrique, 2026-11-16: «volvamos a la versión anterior donde la barra estaba a la izquierda y
mantenemos lo que hemos hecho en el texto, los mapas y la pizarra»; eligió «la de antes del todo», el armazón de la
etiqueta `antes-pantalla-completa`) · Sustituye al ADR-0027, salvo su nota del 2026-11-16 (la página), que se queda.

## Contexto

El ADR-0027 llevó el mundo del máster a pantalla completa, como la Mesa: sin la barra de la app, con una cabecera fina
de cristal, una barra de pestañas a la izquierda (Páginas y Archivos) y los archivos abiertos en el centro. Después,
la página del centro se rehízo como la de Everlore (la nota del 2026-11-16 de ese ADR). Al verlo entero, Enrique
prefirió volver al armazón de antes y quedarse con la página nueva.

## Decisión

1. **El armazón, el de antes del todo** (la etiqueta git `antes-pantalla-completa`): la barra de iconos de la app a la
   izquierda (`components/ribbon.tsx`), con los iconos del mundo que salen del crisol, Archivos, Historial, Papelera y
   la cuenta; la vista del mundo con `WikiLayout`: la ficha del árbol a la izquierda (el buscador, el árbol, las
   pestañas abiertas compactas y los marcadores), la columna del centro con las pestañas abiertas encima y el panel a
   la derecha. **Archivos del mundo, pantalla aparte** (`/mundos/$w/archivos`). **Entrar y salir, con sus transiciones
   de siempre** (`ENTER_WORLD` y `LEAVE_WORLD`, las aprobadas).
2. **Se retira** lo propio de la pantalla completa: la cabecera fina, la barra de pestañas del mundo, el modo `bare`
   del mundo en `routes/root.tsx`, el archivo abierto en el centro (`/mundos/$w/archivo/$fileId`, con sus pestañas de
   archivos recordadas en el aparato), la lista de Archivos en pequeño y las transiciones de tipo
   `pantalla-completa`. Lo común que se había sacado de la barra (`world-hooks.ts`, `crucible.module.css`) vuelve a
   ella: ya solo hay un armazón.
3. **La página, como la de Everlore, se queda** dentro de `WikiLayout` (la nota del 2026-11-16 del ADR-0027): la
   portada arriba en todas las pestañas (176 px, esquinas de 18 px; sin portada, la textura), el título grande con su
   icono y a la derecha sus botones y el del panel; las pestañas subrayadas con las herramientas de la abierta a su
   derecha; al bajar, la barra pequeña de cristal pegada con el título y las pestañas; el texto sin caja, hasta 72 rem y
   centrado; el mapa y la pizarra a sangre hasta el final de la ventana, transparentes, con sus píldoras. La columna
   del centro es una sola superficie casi opaca de arriba abajo, sin borde que acabe. Va con el desplazamiento de la
   ventana, como el resto del armazón: las dos fichas de los lados, pegadas arriba al bajar. Su contexto,
   `wiki/world-page.ts`; sus estilos, `wiki/world-page.module.css`.
4. **El panel de la página se pliega** desde su botón en la cabecera de la página (también en la barra pegada) y se
   recuerda en el aparato; su columna de la rejilla se cierra y él se va por la derecha. Junto a un mapa o una pizarra,
   si no tiene nada, sale plegado solo.
5. **Un solo buscador**, el de la ficha del árbol: filtra al escribir y con Intro busca en el texto de todas; **Ctrl+K
   lo enfoca** (en lo estrecho, abriendo su cajón). El selector rápido no vuelve.

## Consecuencias

- `EntryView` sigue con dos maquetaciones: la del mundo (la de Everlore, dentro de `WikiLayout`) y la de siempre, para
  las plantillas y las ventanas de páginas de la Mesa.
- El mapa y la pizarra saben que van en la página del mundo por su contexto (`useWorldPage`), no por la pantalla
  completa; «Ampliar» del mapa vuelve a dejar la barra de la app a la vista.
- Las pruebas vuelven a entrar por la barra de la app y la ficha del árbol, como antes (`e2e/tests/ayudas.ts`).
