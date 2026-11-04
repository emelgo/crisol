# Inventario del Crisol actual

Lo que hace el Crisol basado en Obsidian/Atlas (`~/crisol-app`, rama `web`, commit `3f68f11`, 2026-10-28), agrupado
en módulos. Sirve para no olvidar ninguna función al reescribirlo. Que algo esté aquí no obliga a rehacerlo igual: en
cada módulo se decide qué se queda, qué cambia y qué se descarta (y se apunta en `docs/modulos.md`).

## 1. Mundos y almacenamiento

`core-host/src/vault/*`, `campaigns/CampaignService.ts`

- Crear un mundo con solo el nombre, abrir, recientes, duplicar, exportar a .zip, mandar a la papelera.
- Archivos: leer, escribir, crear, renombrar o mover (reescribe los enlaces), copiar, borrar a `.trash`, carpetas,
  binarios. Escritura atómica con concurrencia optimista (hash esperado → `conflict`). Cambios en vivo entre pestañas.
- Versiones de cada página: las 40 últimas, como mucho una cada pocos minutos, con restaurar.
- Ajustes por mundo, fragmentos CSS propios, pestañas abiertas.
- Importación única desde Obsidian (`migracion.ts`): ajustes, snippets, pestañas y datos de plugins (Templater, Modal
  Forms, Meta Bind, Admonition, Iconize, 5e Statblocks, TTRPG Tools Time, Atlas VTT).
- Formato: carpeta de `.md` + `.crisol/` oculto (`mundo.json`, `sistema.json`, `clases.json`, `visibilidad.yaml`,
  `marcadores.json`, `orden.json`, `historial-ia.json`, `datos/*.json`, `biblioteca/`, `mesa/instantaneas/`,
  `pizarras/biblioteca.excalidrawlib`).

## 2. Páginas y wiki

`renderer/src/{note,paginas,documento,workspace,vault}`

- Árbol de páginas con subpáginas, arrastrar para recolocar, pestañas (fijables), selector rápido, paleta de órdenes,
  búsqueda de texto, marcadores con grupos, panel de etiquetas, enlaces entrantes, índice del documento.
- Menciones sin enlazar (enlazar con un clic), vista previa al pasar el ratón, incrustados, migas de pan.
- Portada, título en línea, editor de propiedades, candado lectura/escritura por página.
- Editor de bloques (TipTap) con barra y menú «/»: texto, títulos, listas, casillas, cita, código, tabla, separador,
  secreto, callout, caja, enlace o página nueva, mapa, línea temporal, nota oculta, imagen, tirada. Guarda intactos los
  bloques que no se tocan. Además, editor de fuente / vista en vivo (CodeMirror).
- Visor de PDF, panel de Recursos (subir archivos, carpetas automáticas por tipo), iconos de archivos.
- Formato: Markdown de Obsidian (frontmatter YAML, `[[enlaces]]`, `> [!callout]`, `%%comentarios%%`, `^ids-de-bloque`,
  matemáticas, GFM). Subpáginas como notas de carpeta (`P/P.md`) o propiedad `MyContainer`.

## 3. Índice y consultas

`packages/core/src/{metadata,search,query,links}`, `core-host/src/index`

- Caché de metadatos, resolución de enlaces, enlaces entrantes, búsqueda, resumen del primer párrafo.
- Dataview DQL (TABLE/LIST, FROM, WHERE, SORT, GROUP BY, FLATTEN, LIMIT; sin dataviewjs).
- Bases de Obsidian (`.base` o bloques ```base): filtros, fórmulas, vistas, agrupar.

## 4. Tipos de página, plantillas y formularios

`core/src/{paginas,templates}`, `packages/blocks`

- Doce tipos con campos propios: PJ, PNJ, misión, lugar, facción, objeto, conjuro, dote, rasgo, sesión, criatura,
  tabla aleatoria. Personalizables por mundo. Tipo en `clase:` o etiqueta `Category/<Tipo>`.
- Campo de reloj de progreso (segmentos). Tablas aleatorias pegadas desde una hoja de cálculo y tiradas. Filas del
  inventario que se convierten en páginas de objeto.
- Plantillas de Templater ejecutadas en un intérprete JS propio (sandbox). Diálogos de Modal Forms y Meta Bind
  (`INPUT`/`VIEW`/`BUTTON`) emulados en parte.

## 5. Sistemas de reglas y fichas de personaje

`packages/systems`, `packages/fichas`, `renderer/src/sistema`

- Las reglas de cada mundo son datos (`.crisol/sistema.json`), editables por secciones: general, campos de la hoja,
  diseño de la hoja (bloques, estilos, CSS), pasos de creación y subida de nivel, tiradas (con franjas de resultado),
  criaturas, estados, mesa, avanzado. Ejemplos: 5e 2014 (SRD 5.1), 5e 2024 (SRD 5.2), en blanco. Fórmulas seguras
  (lenguaje de Bases, con límite de pasos).
- Hoja de personaje (bloque ```personaje en YAML) con pestañas (hoja, inventario, conjuros, rasgos), asistente de
  creación paso a paso, subida de nivel, importar YAML.
- Statblocks de criaturas (```statblock, maquetaciones de Fantasy Statblocks). Las tiradas del texto se vuelven botones.
- Foto de la hoja para la IA (ventana oculta, o Chromium sin ventana en la web).
- En detalle (secciones, fórmulas, tiradas, pasos, bloques, validación y lo frágil): `docs/inventario-sistemas.md`.

## 6. Campañas, visibilidad y secretos

`campaigns/*`, `core/src/visibility`

- Varias campañas por mundo (carpeta con `.campaña/campaña.json`): crear (con Grupo, Sesiones, Misiones, Encuentros),
  convertir una carpeta, activar, renombrar, borrar (solo estado o todo), o «explorar el mundo» sin campaña.
- Conocimiento de los jugadores por campaña: reglas por carpeta y página (`dm` / `jugadores` / `todos`), compartir con
  PJ concretos o `@nombre`, secretos (`> [!secreto]` + id `^s-…`) revelados a todos o a quien se diga, objetos de mapa
  descubiertos. Valores por defecto del mundo en el frontmatter y en `.crisol/visibilidad.yaml`.
- Al empezar una campaña: los jugadores saben lo del mundo, nada, o lo mismo que en otra campaña.

## 7. Calendario y tiempo

`core/src/calendar`, `CalendarService.ts`, `renderer/src/calendario`

- Varios calendarios (meses, días de la semana, eras, lunas, estaciones) con editor visual y plantillas. «Hoy» por
  campaña o del mundo.
- Vistas de mes, crónica y línea temporal; eventos con rango y repetición anual.
- Clima: generación determinista con semilla y ajustes a mano. Orto y ocaso según la latitud.
- Calculadora de viajes que puede avanzar «hoy»; bloques de línea temporal.
- Formatos heredados: `*.calendar.json` (TTRPG Tools – Time), `fc-date`/`fc-end` (Fantasy Calendar).

## 8. Mapas de mundo

`core/src/maps`, `MapService.ts`, `renderer/src/mapas`

- `*.mapa.json` sobre una imagen: pines (formas, iconos, etiquetas, pines anónimos), regiones, rutas, textos, capas
  (también solo del máster), calibrar la escala, medir.
- Pines enlazados a notas; un mapa se anida en otro a través de ellas. Marcas de «solo máster» y «descubierto».
- Bloques ```crisol-mapa. Importa `.markers.json` de zoom-map.

## 9. Pizarras

`core/src/pizarras`, `renderer/src/pizarras`

- Excalidraw con tarjetas de notas arrastradas desde el árbol, `[[enlaces]]`, imágenes del mundo, marca de solo máster
  y «ver como jugadores». Formatos `.excalidraw` y `.excalidraw.md` (escena comprimida con LZ-String).

## 10. Otras herramientas del mundo

- Tableros Kanban (Markdown del plugin Kanban) y pantalla del máster generada desde el sistema.
- Gráficos (6 tipos, ```chart).
- Grafo de relaciones: enlaces, árbol genealógico, organigrama de facciones.
- Generador de nombres por cultura.
- Centro de avisos y actividad.

## 11. Mesa de juego

`packages/mesa` (motor, PixiJS), `packages/tabletop` (paneles y biblioteca)

- Escenas en `*.escena.json`; el estado de juego por campaña en `.campaña/mesa/`.
- Rejilla cuadrada o hexagonal, con numeración.
- Fichas: tamaños, estados con caducidad, barras de recursos, editor.
- Herramientas: medir (línea, círculo, cono, cuadrado) y dejarlo como plantilla de área, dibujo, sellos, texto, pines,
  puntero láser, imágenes.
- Niebla: pincel, lazo, rectángulo o automática por visión. Muros y puertas, luces y oscuridad, visión y sentidos de
  las fichas, capa de clima.
- Iniciativa con bandos y turnos; widgets de contador, reloj y temporizador.
- Instantáneas con miniatura. Ventana de jugadores para una segunda pantalla (seguir, fija, encuadrar al grupo).
  «Presentar escena» distinto de abrirla.
- Pantalla del máster: statblocks de la escena y una nota enlazada.
- Generador de botín (alimentado por Bases). Encuentros guardados con su formación.
- Biblioteca (colecciones, fichas, mapas, escenas, encuentros), creador de fichas desde imágenes, paquetes de colección
  (.zip con manifiesto).
- Importar Universal VTT (`.dd2vtt`, `.uvtt`, `.df2vtt`). Atajos, visita guiada, deshacer.

## 12. Dados

`packages/dice`, `packages/dice3d` (three.js + cannon-es)

- Notación: quedarse con los altos/bajos, repetir, explosivos, contar éxitos, dados Fate, etiquetas, ventaja, críticos.
- Tiradas `dice:` en las notas, bandeja 3D con colores por usuario, historial.
- Tiradas ocultas del máster, privadas de los jugadores, tiradas en tablas aleatorias.

## 13. Sala de jugadores y web de jugadores

`core-host/src/game/*`, `apps/player-web`

- Secciones del jugador: Mi personaje (hoja editable, importar), Mesa, Wiki (árbol filtrado, búsqueda, enlaces,
  consultas limitadas a lo que puede ver), Dados, Crónica (calendario), Mapas, Pizarras, Recursos.
- Chat con susurros, notas personales y diario, lista de presentes.
- Páginas o imágenes que el máster muestra a uno o a todos.
- Sonido: audio del mundo, URLs, vídeos o listas de YouTube, fuentes en el mapa que se oyen según la distancia a la
  ficha del jugador.
- Controles del máster: cómo mueven fichas los jugadores (libre / en su turno / bloqueado), pausa, expulsar, rotar el
  enlace de la sala.
- Entrada: el máster añade jugadores y abre la sala → enlace con la clave en el fragmento (`/<campaña>/#k=…`) o QR →
  nombre, contraseña opcional → elegir un PJ libre o crear uno básico. WebSocket con su propio contrato.
- **Limitación clave:** el jugador no dibuja la mesa; el navegador del máster le genera un fotograma WebP por cámara y
  el jugador solo pinta encima sus fichas y señales. Wiki, mapas y pizarras sí se proyectan por jugador en el servidor.

## 14. IA / MCP

`core-host/src/mcp/*`, `docs/manual/es/ia.md`

- Unas 90 herramientas:
  - Notas: buscar, leer, crear, editar, añadir, renombrar, borrar, propiedades, carpetas, entrantes, Dataview, Bases.
  - Páginas y tableros, plantillas, compendio (criaturas), dados y tablas.
  - Mesa (18): estado, escenas, fichas, niebla, puertas, luz, turno, instantáneas, biblioteca, presentar.
  - Partida: estado, diario, mostrar a jugadores, ver como jugador, revelar secreto.
  - Mundo: campañas, jugadores, clima, línea temporal, viaje, nombres.
  - Calendario (3), mapas (7), pizarras (3), personajes, sistema (ver, crear, cambiar, validar, probar tirada, ver y
    probar hoja), pendientes.
- Recursos (`crisol://manual`, `sistema`, `sistema/esquema`, `escena`, `partida`, `mundo/convenciones`), 7 prompts y
  8 skills de Claude Code instalables en el mundo.
- Modos: solo lectura, asistente (aprobar cada escritura), copiloto (aprobar solo lo delicado). Cola de aprobación.
  Todo cambio queda en el historial y se puede deshacer.
- Transporte: Streamable HTTP con token, puente stdio, u OAuth vía Dex + pasarela + Caddy.

## 15. Envoltorio

- Modos de trabajo «Preparar» y «Jugar», cinta lateral, panel derecho, ajustes (general, mundo, dados, mesa, IA, sala),
  Acerca de y créditos, i18n (español como idioma fuente). Tema oscuro tipo D&D Beyond y claro.

## Cuentas y multiusuario (hoy)

- Un máster por instalación y un mundo abierto a la vez por proceso.
- Web: una contraseña de máster (scrypt), cookie de 30 días, límite de intentos, mismo origen.
- Jugadores por campaña: nombre y contraseña opcional, sin cuentas globales. Sin co-máster ni otros roles.

## Pila actual (referencia)

React 19, zustand + immer, i18next, TipTap 3, CodeMirror 6, unified/remark/micromark, PixiJS 8, three.js + cannon-es,
Excalidraw 0.18, chart.js, minisearch, jszip/fflate, lz-string, @babel/parser, @modelcontextprotocol/sdk, zod 4,
Electron 44. Todo MIT/ISC/Apache salvo fuentes OFL, game-icons (CC BY 3.0) y SRD 5.1/5.2 (CC BY 4.0).

## Herencias de Obsidian/Atlas que el Crisol nuevo debe evitar

1. Un shim de la API de Obsidian bajo la mesa (`packages/tabletop/src/plataforma/*`) y migraciones de formatos de Atlas.
2. **La mesa solo vive en la pestaña abierta del máster** (fotogramas de jugadores, órdenes del MCP, segunda pantalla).
3. Almacenamiento en archivos: watcher, hashes, `.trash` emulado, enlaces reescritos como texto al renombrar.
4. Sintaxis de plugins convertidas en modelo de datos (`Category/`, `MyContainer`, `fc-date`, Kanban MD,
   `.excalidraw.md`, maquetaciones de Fantasy Statblocks, variables CSS de Obsidian).
5. JavaScript de usuario (Templater) en un intérprete propio: superficie de ataque; Meta Bind y Modal Forms a medias.
6. Añadidos del modo web: Chromium sin ventana para las fotos de la hoja, cookie de un uso, página de YouTube servida
   aparte, contraseña única de máster.
