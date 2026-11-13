# ADR-0027: El mundo a pantalla completa, como la Mesa

Estado: aceptada (Enrique, 2026-11-13: aprobó la propuesta `docs/propuestas/wiki-pantalla-completa.md` y respondió sus
seis preguntas). Cambia el armazón del mundo del máster; no cambia las rutas ni lo de la jugadora. Sigue al ADR-0019 y
al ADR-0021 (la Mesa a pantalla completa, con su barra de pestañas).

## Contexto

Dentro de un mundo solo hay páginas y archivos. Entre la barra de la app, la ficha del árbol, el tope de la columna del
centro y el panel de la página, a un mapa o a una pizarra les quedaba poco sitio, y Archivos era otra pantalla con su
propio esqueleto aunque solo se usara para lo del mundo. La Mesa ya va a pantalla completa con una barra de pestañas
que se pliega, y funciona.

## Decisión

1. **El mundo del máster va sin la barra de la app** (`bare`, como la Mesa): `routes/root.tsx` pinta un armazón propio,
   `WorldShell`, alrededor de las rutas de siempre (`/mundos/$w`, `/mundos/$w/wiki/$pageId?pestana=`, `/buscar`,
   `/archivos` y la nueva `/archivo/$fileId`). El armazón vive mientras se está en el mundo (no se rehace al cambiar de
   página). Detrás, los fondos de Crisol que van cambiando (no la portada del mundo). La jugadora y las campañas
   (`/mundos/$w/campanas/…`) no cambian, ni las plantillas (`/plantillas/$id`, se quedan fuera por ahora).
2. **Una cabecera fina de cristal** arriba (`banner`): la llama (vuelve a Mis mundos), el nombre del mundo con su menú
   (Ajustes del mundo, Historial, Papelera, Exportar), las pestañas abiertas **una sola vez**, como las de un navegador
   (ya no van encima de la columna ni en la ficha del árbol), el buscador (Ctrl+K) y la cuenta (su inicial, como en la
   barra).
3. **A la izquierda, una barra de pestañas como la de la Mesa** (`tablist`): Páginas (el buscador, el árbol y, debajo,
   los marcadores) y Archivos (la lista-árbol del mundo, con «Comunes» como una carpeta más). Se pliega a una columna de
   iconos y se estira arrastrando su borde; se recuerdan en el aparato (`localStorage`) la pestaña, si va plegada y su
   ancho. La pestaña abierta también puede ir en la dirección (`?barra=archivos`).
4. **En el centro, la pestaña de la página ocupa todo el hueco**: el texto con su hoja centrada (hasta su tope de
   letra); el mapa y la pizarra, de borde a borde y de arriba abajo, con el título y las pestañas de la página flotando
   en cristal sobre el lienzo, como la barra de la escena de la Mesa.
5. **El panel de la página, a la derecha, se pliega** (Enrique cambia la norma «no se esconde»): a una tira con su
   botón, para que el mapa o la pizarra lo tengan todo. Se recuerda plegado o no, en el aparato.
6. **Los archivos se abren en el centro** como una pestaña abierta más (imagen, PDF, audio, vídeo, texto), con su vista
   previa y sus ajustes en el panel de la derecha. Las pestañas de archivos se recuerdan **en el aparato**
   (`localStorage`, por mundo), no en la cuenta como las de páginas: así no hace falta cambiar el contrato
   `setWikiTabs` ni la base de datos; si algún día se quieren en todos los aparatos, se amplía el contrato.
7. **La pantalla grande de Archivos se queda como «Ver todos»** (`/mundos/$w/archivos`), abierta dentro del centro, para
   lo masivo (elegir varios, mover, etiquetar). Los Archivos de fuera (`/archivos`) no cambian. La lista de la barra es
   la misma de la pantalla (`files-section.tsx`) en su forma pequeña, no una copia.
8. **Entrar y salir conservan la transición aprobada**: al entrar, la tarjeta del mundo crece hasta la cabecera
   mientras Mis mundos se acerca y se desvanece; lo de la barra de la app sube a la llama y se va con el contenido, la
   llama de la cabecera se aviva y los iconos salen del crisol a la barra de la izquierda. Al salir (solo con la llama),
   el mundo se aleja con humo, los iconos suben al crisol y la barra de la app vuelve a entrar mientras la llama expulsa
   a «Mundos». Las transiciones de vista llevan un tipo más, `pantalla-completa`, para lo que cambia (la barra de la app
   sale o entra entera).

## Consecuencias

- Hay dos armazones con sesión: lo común (la cuenta, Historial y Papelera, la llama y sus animaciones) vive aparte
  (`components/world-hooks.ts`, `components/crucible.module.css`) y lo usan los dos.
- `EntryView` tiene dos maquetaciones: la del mundo a pantalla completa (desplazamiento propio en el centro, panel
  plegable) y la de siempre, para las plantillas y las ventanas de páginas de la Mesa.
- Lo que medía su sitio con el desplazamiento de la ventana (las fichas de los lados, el alto del mapa) se mide en el
  mundo con el del centro.
- Las pruebas que entraban por la barra de la app (`Secciones` → el mundo, Archivos) o por la ficha del árbol pasan por
  los ayudantes comunes de `e2e/tests/ayudas.ts`.
- El móvil del máster no se cuida (norma): en lo estrecho la barra de la izquierda va plegada y el panel, debajo.
