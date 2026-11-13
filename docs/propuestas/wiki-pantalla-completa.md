# Propuesta: el mundo a pantalla completa, como la Mesa

Estado: **propuesta** (2026-11-13, punto 19 de las mejoras de Enrique). No construida. Se hace después, con su lienzo
de impeccable (`/impeccable shape` y prototipos que Enrique prueba), su ADR y su plan por porciones.

Enrique: «Vamos a transicionar a una wiki en pantalla completa como la Mesa […]. Lo he decidido porque solo tenemos
archivos y wiki, y los archivos se pueden integrar».

## Cómo es hoy

- **La Mesa** (`tabletop/mesa.tsx`, ADR-0019 y ADR-0021): ruta `/mundos/$w/campanas/$c/mesa`, que `routes/root.tsx`
  marca como `bare`: sin la barra de la izquierda (`Ribbon`) ni el fondo de ambiente; el mapa ocupa toda la ventana.
  Encima flotan piezas de cristal (barra de la escena arriba, herramientas a la izquierda, zoom, d20) y a la derecha
  va **la barra de pestañas** (`tabletop/sidebar.tsx`: icono y nombre arriba, el panel de la abierta debajo; se pliega
  a una columna de iconos; la abierta va en `?panel=`). Lo que se abre (páginas, compendio, hojas) sale en **ventanas
  sobre el mapa** (`components/windows.tsx`): se mueven, cambian de tamaño, se minimizan abajo a la izquierda.
- **El mundo** (`routes/world.tsx`, `wiki/wiki.tsx` → `WikiLayout`): rutas `/mundos/$w` (su portada, una página más),
  `/mundos/$w/wiki/$pageId`, `/mundos/$w/buscar`, `/mundos/$w/archivos` (`wiki/files.tsx`, otra pantalla),
  `/mundos/$w/historial` y `/papelera` (ventanas encima). Lleva la barra de la izquierda con el mundo (su nombre,
  `barra-wiki`) y Archivos (`barra-archivos-mundo`), Historial, Papelera y la cuenta abajo. Dentro: la ficha del árbol
  a la izquierda (buscador, árbol, pestañas abiertas compactas, marcadores), la columna del centro (pestañas abiertas,
  portada, título, pestañas de la página, texto o mapa o pizarra) y el panel de bloques a la derecha. Detrás, la
  portada del mundo muy difuminada (`useAmbient`).
- **Lo que aprieta**: entre la barra de iconos, la ficha del árbol, el tope de la columna del centro y el panel, al mapa
  y a la pizarra les queda poco (punto 22). Archivos es otra pantalla, con su propio esqueleto, aunque solo se usa para
  lo del mundo.

## La propuesta

### Estructura de la pantalla

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [llama] Mundo ▾ │ pestañas abiertas …  ×  ×  ×  +            │ buscar ⌘K │ ⋯ │  ← cabecera fina, cristal
├────────────┬─────────────────────────────────────────────────┬──────────────┤
│ Páginas    │                                                 │ Panel        │
│ Archivos   │   la pestaña de la página: texto (hoja), mapa,  │ Mencionado   │
│ Marcadores │   pizarra… ocupando todo el hueco               │ Propiedades  │
│ ────────── │   (el texto, con su columna de lectura centrada; │ Bloques      │
│ árbol o    │    mapa y pizarra, de borde a borde)            │              │
│ lista de   │                                                 │ (plegable a  │
│ archivos   │                                                 │  iconos)     │
└────────────┴─────────────────────────────────────────────────┴──────────────┘
                                                              d20 ◯   ? ◯
```

1. **Sin la barra de la izquierda de la app** dentro del mundo, como en la Mesa (`bare`). La llama sigue, arriba a la
   izquierda de la cabecera: es la vuelta a Mis mundos (con la transición de salir, ver abajo).
2. **Una cabecera fina de cristal** a lo ancho: la llama, el nombre del mundo (su menú ▾: Ajustes del mundo, Historial,
   Papelera, Exportar el mundo), **las pestañas abiertas** (las de `wiki/navigation.tsx`, que hoy van encima de la
   columna y repetidas en la ficha del árbol: aquí una sola vez, como las de un navegador), el buscador (Ctrl+K, el
   `QuickSwitcher`; Intro busca en el texto de todas) y «⋯» de la cuenta (Perfil, Ajustes, Cerrar sesión).
3. **A la izquierda, una barra con pestañas, como la de la Mesa pero a la izquierda** (donde la gente busca el árbol;
   la de la Mesa está a la derecha porque el mapa manda): **Páginas** (el árbol con su buscador y, debajo, los
   marcadores), **Archivos** (la lista-árbol de Archivos en pequeño, integrada) y, si se quiere, **Marcadores** como
   pestaña propia. Se pliega a una columna de iconos (y se recuerda), y se estira arrastrando su borde.
4. **En el centro, la pestaña de la página ocupa todo el hueco**: el texto, con su hoja centrada hasta su tope de letra
   (la norma de «la hoja llena el ancho» sigue); el mapa y la pizarra, **de borde a borde y de arriba abajo**, sin
   recuadro (lo que pide el punto 22: como LegendKeeper). El título y las pestañas de la página (Texto, Mapa…) van
   arriba de la columna; en un mapa o una pizarra, el título y sus pestañas flotan en cristal sobre el lienzo, como la
   barra de la escena de la Mesa, para no robar alto.
5. **A la derecha, el panel de la página** (Mencionado en, propiedades y bloques), el de ahora, como ficha de cristal
   que **se pliega** (a iconos o del todo) para que el mapa o la pizarra lo tengan todo. Hoy la norma dice que no se
   esconde: hay que preguntarlo (pregunta 2).
6. **La portada del mundo** (su Inicio) es una página más y se abre en el centro, como hoy; el fondo de ambiente,
   nuestros fondos que van cambiando (punto 24), no la portada.

### Archivos, integrados

- La pestaña **Archivos** de la barra izquierda enseña la lista-árbol del mundo («Comunes» como una carpeta más), con
  buscador y «Subir». **Pulsar un archivo lo abre en el centro** como una pestaña abierta más (imagen, PDF con
  `pdf-viewer.tsx`, audio, vídeo, texto), con su vista previa y sus ajustes en el panel de la derecha (lo que hoy sale
  en la vista previa de la izquierda y en su ventana).
- **Arrastrar un archivo** de la barra al texto lo incrusta; a un mapa, lo pone de imagen o de marca; a la pizarra, como
  imagen (lo que ya hace arrastrar páginas del árbol a la pizarra).
- La pantalla grande de Archivos (`/mundos/$w/archivos`) se queda para lo masivo (elegir varios, mover, etiquetar):
  se abre desde la pestaña («Ver todos») **dentro del centro**, no como otra pantalla. Los comunes de la cuenta siguen
  en `/archivos`, fuera del mundo, sin cambios.

### Salir, entrar y lo de la cuenta

- **Entrar** en un mundo desde Mis mundos: la tarjeta crece hasta la cabecera (la transición de ahora: «esa transición
  no se toca»), solo que ahora llega a la cabecera fina y la barra de la app se va con el contenido. Hay que rehacer el
  final de la animación de la llama (los iconos que salen del crisol) porque ya no hay barra a la que salir: los
  iconos salen a la barra de pestañas de la izquierda.
- **Salir**: la llama de la cabecera (y Escape largo no; solo el clic) vuelve a Mis mundos con la transición de salir
  de ahora (el mundo se aleja, humo, la llama expulsa a «Mundos»), y la barra de la app vuelve a entrar.
- **Historial, Papelera y Ajustes del mundo**: desde el menú ▾ del nombre del mundo, como ventanas encima (las de
  ahora, con sus rutas). Perfil y Ajustes de la cuenta, desde «⋯» a la derecha.
- **El d20 y el «?»**, donde están (abajo a la derecha), como en la Mesa. Las tarjetas de aprobación de la IA, encima
  del d20.

### Rutas

- Se quedan las direcciones de ahora (`/mundos/$w`, `/mundos/$w/wiki/$pageId?pestana=`, `/buscar`), para no romper
  enlaces ni la IA. **Lo único que cambia es el armazón**: `routes/root.tsx` trata todo `/mundos/$w(/wiki|/buscar|
  /archivos…)` del máster como `bare` y pinta un armazón propio del mundo (`WorldShell`) que sustituye a `WikiLayout`.
- Nuevas, opcionales: `?barra=archivos` (la pestaña de la izquierda abierta, como `?panel=` de la Mesa) y
  `/mundos/$w/archivo/$fileId` (un archivo abierto en el centro). `/mundos/$w/archivos` sigue y abre «Ver todos» en
  el centro.
- Las campañas (`/mundos/$w/campanas/…`) no cambian: tienen su propio espacio (ADR-0021).

### La jugadora

- No le afecta: quien juega no entra en `/mundos/$w/wiki` (solo el máster), sino en las páginas de su campaña
  (`campaign/world-pages.tsx`) y en las ventanas de la Mesa. Si gusta, después se le puede dar lo mismo a sus páginas
  (lectura a pantalla completa en el móvil), pero no entra aquí. El móvil del máster no se cuida (norma).

### Tutorial

- El del mundo (`wiki/world-tour.tsx`) se rehace: hoy señala `barra-wiki` y `barra-archivos-mundo` de la barra de la
  app. Pasos nuevos: la cabecera (pestañas abiertas y buscador), la barra de la izquierda (Páginas y Archivos), la
  página y su panel, y la llama para volver. Genéricos y cortos.
- El de Archivos sigue en «Ver todos».

## Impacto en las pruebas

- **e2e**: unas 20 entran por la wiki o por Archivos del mundo (`archivos-en-paginas`, `claude-wiki`, `conocimiento`,
  `entrada-desde-mundo`, `fichas-incrustadas`, `hoja`, `mapas-capas`, `mapas-jugadores`, `pagina-de-jugadores`,
  `pizarra`, `fugas`, `revelar`, `versiones`, `tablas`, `selector`, `secretos`, `vista-previa`, `rendimiento`…). Las
  direcciones no cambian; lo que se rompe son los localizadores de la barra (`Secciones` → mundo, Archivos) y de la
  ficha del árbol. Conviene un ayudante común (`abrirArbol`, `abrirArchivosDelMundo`) en `e2e/` antes de empezar.
- **Unitarias**: `wiki.test.tsx` (la barra con `barra-wiki`), `ribbon`, `files.test.tsx`, `navigation.test.tsx`,
  `world.test.tsx`, el tutorial.
- La prueba de accesibilidad: cabecera con `banner`/`navigation` propias, la barra izquierda como `tablist`.

## Riesgos

- **Dos armazones** (el de la app y el del mundo): hay que sacar a componentes comunes lo que hoy vive en `Ribbon`
  (menú de la cuenta, Historial/Papelera, aprobaciones, la llama con su animación).
- **La transición de entrar/salir** depende de la barra (la llama absorbe y expulsa «Mundos»): rehacerla sin perder lo
  aprobado. Es lo más delicado.
- **Archivos integrado** duplica parte de `files.tsx` (2400 líneas): hay que partirlo (lista-árbol reutilizable por un
  lado, pantalla y selección múltiple por otro) antes, no copiarlo.
- **El panel plegable** cambia una norma («no se esconde»).
- **Escena y Tabla** como pestañas de página (ver el punto 23): si se quedan, cada una necesita su maquetación a
  pantalla completa.

## Preguntas para Enrique

1. ¿La barra de pestañas del mundo **a la izquierda** (donde está hoy el árbol) o **a la derecha** como la Mesa? La
   propuesta: izquierda, y el panel de la página a la derecha.
2. ¿El panel de la página **se puede plegar** (cambia la norma de que no se esconde)? Para mapas y pizarras ayuda mucho.
3. ¿Las pestañas abiertas arriba como un navegador (una sola vez) y fuera de la ficha del árbol?
4. ¿Archivos abre los archivos **en el centro** como pestañas, o solo su vista previa en el panel?
5. ¿La pantalla grande de Archivos del mundo desaparece del todo (todo en la barra) o se queda como «Ver todos»?
6. ¿También las plantillas (`/plantillas/$id`, que se editan como una página) pasan a este armazón?

## Orden de porciones (cuando se apruebe el lienzo)

1. Partir lo común de `Ribbon` (cuenta, Historial/Papelera, la llama) y `files.tsx` (la lista-árbol), sin cambiar nada
   visible. Ayudantes de e2e.
2. `WorldShell` a pantalla completa con la cabecera, la barra izquierda (Páginas) y el centro; `bare` para el mundo del
   máster. Mapa y pizarra de borde a borde.
3. La salida y la entrada (transiciones y la llama), con sus pruebas de animación.
4. Archivos en la barra izquierda y archivos abiertos en el centro; «Ver todos».
5. El panel plegable (si se aprueba) y el título flotante sobre mapas y pizarras.
6. El tutorial nuevo, la crítica y el audit de impeccable, y las e2e al día.

## Referencias

- Mesa: `apps/web/src/tabletop/mesa.tsx`, `sidebar.tsx`, `master-sidebar.tsx`, `components/windows.tsx`; ADR-0019,
  ADR-0021.
- Mundo: `apps/web/src/wiki/wiki.tsx` (`WikiLayout`), `routes/world.tsx`, `wiki/files.tsx`, `components/ribbon.tsx`
  (`WikiPanels`), `routes/root.tsx` (`bare`).
- LegendKeeper: `research/legendkeeper/mapas.md` (barra de herramientas del mapa con atajos, carpetas en la barra
  lateral del mapa, buscador). En `research/` no hay un estudio del armazón general de LegendKeeper (cabecera de
  pestañas, barra lateral plegable): si se quiere copiar más de cerca, conviene uno corto con craft-anything antes del
  lienzo.
