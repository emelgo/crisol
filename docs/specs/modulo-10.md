# Módulo 10 · mundo: relaciones y gráficos

Inventario § 4 («Grafo de relaciones: enlaces, árbol genealógico, organigrama de facciones»; «Gráficos (6 tipos)»).
Estudio del Crisol antiguo y del nuevo: hecho el 2026-11-16 por un subagente (resumen abajo, en «Lo que había»).

## Decisiones de Enrique (2026-11-16) — mandan sobre lo de abajo

1. **Relaciones: pestaña en cada página y vista del mundo.** Una pestaña «Relaciones» en la página (grafo centrado en
   ella; árbol genealógico u organigrama cuando toque) y un grafo de todo el mundo a pantalla entera.
2. **Las relaciones salen de los campos de relación y también de los enlaces del texto** (relación «menciona»).
3. **Gráficos, como bloque del editor de páginas.**
4. **Fuera: los tableros Kanban y el generador de nombres.**

## Ajustes tras probarlo (Enrique, 2026-11-19) — mandan sobre lo de arriba y lo de abajo en lo que toquen

Plan «Ajustes tras los módulos 8, 9 y 10», bloque B. Enrique: el árbol genealógico «se hace a partir de páginas y se
edita desde el árbol; algunos nodos pueden no tener página todavía y convertirse en página más adelante».

- **Fuera la pestaña «Relaciones»** (sustituye a las decisiones 1, 5, 8 y 18 en lo de la pestaña). Familia y
  Organigrama pasan a la pestaña de árbol; Enlaces, a la ventana del grafo. Un `?pestana=relaciones` de antes abre el
  texto.
- **Pestaña «Árbol genealógico»** (y «Organigrama», que se elige al crearla) en «Página nueva», «Pestaña nueva» y
  «Plantilla nueva» (`page_tabs.kind = tree`; tabla `trees`, migración 0091: su forma `family | org` y dos listas,
  `nodes` `{id, pageId?, name, note?}` y `edges` `{from, to, type: parent | partner | member | leads}`). Se edita desde
  el árbol: las tarjetas de Familia y Organigrama (dagre); pulsar una abre su ficha con lo que se añade (padre o madre,
  pareja, hijo o hija; en el organigrama, miembro o quien lo dirige), con un buscador que da una página del mundo, a
  alguien que ya está en el árbol (solo la línea) o un nombre sin página (tarjeta con raya discontinua); «Crear página»
  convierte un nodo suelto en una subpágina de la del árbol; «Nota», «Nombre» y «Quitar». Con campos con papel en la
  página, «Empezar desde los campos». Al hijo de alguien con una sola pareja, la pareja también le hace de padre o
  madre (decisión de Claude).
- **Sus líneas entre dos nodos con página cuentan como relaciones** (`kind: 'tree'`, claves `tree:parent`,
  `tree:partner`, `tree:member`, `tree:leads`, con el nombre del papel y su nombre al revés) en `getRelations` y
  `getWorldGraph`, sin repetir lo que ya dice un campo con el mismo papel. Sustituye a la decisión 11 en lo del árbol.
- **La jugadora** ve la pestaña si ve su página (y la pestaña no está oculta, o se le reveló); dentro, los nodos con
  página solo si conoce la página (sin rastro de los demás, ni su nombre) y los sueltos; y sus líneas en el grafo, igual.
  Prueba de fugas (e2e e integración).
- **El grafo, en una ventana** como Ajustes, sin cambiar de vista (sustituye a la decisión 12 en lo de «a pantalla
  entera» y a la 21): `?grafo=mundo` (el de todo el mundo, con sus filtros) o `?grafo=<página>` (centrado en ella), que
  Escape, su X, pulsar fuera o Atrás cierran. Se abre desde el icono de la cabecera del árbol de páginas y desde el de
  «Mencionado en» (el de esa página), también para la jugadora. Las rutas `/mundos/$w/relaciones` y
  `/campanas/$c/relaciones` llevan a las páginas con la ventana abierta. Controles más claros: «Alcance: directas / a
  dos pasos / a tres pasos» (antes «Profundidad») y «Con lo que menciona el texto», encendido (antes «Solo campos»).
- **MCP**: `ver_arbol_genealogico`, `crear_arbol_genealogico` y `editar_arbol_genealogico` (las listas enteras).

## Decisiones tomadas sin Enrique (con recomendación; se le enseñan en el lienzo y en `tasks/probar.md`)

5. **La pestaña «Relaciones» es fija y calculada**, como «Mencionado en»: no se añade con «Pestaña nueva» ni se guarda.
   Sale en toda página que tenga al menos una relación (de entrada o de salida). Se quita el esbozo `tree` de
   `apps/web/src/wiki/tabs/kinds.tsx`.
6. **Papel de un campo de relación.** En la plantilla, un campo de tipo «Páginas» puede llevar un papel: *Padre o madre*,
   *Pareja*, *Pertenece a* (facción, orden…), *Lo dirige* (líder) o ninguno. El papel es lo que hace posible el árbol y
   el organigrama; sin papel, el campo es una relación más con su nombre. La IA lo pone por MCP al crear la plantilla.
7. **Nombre de la relación = nombre del campo**, y el campo puede tener un **nombre al revés** opcional («Padres» →
   «Hijos», «Facción» → «Miembros»). Sin él, la arista entrante se lee «Facción de Ilsa».
8. **Tres modos en la pestaña**: **Enlaces** (el vecindario, profundidad 1–3, por defecto 1), **Familia** (solo si la
   página tiene relaciones con papel Padre o Pareja, ±3 generaciones) y **Organigrama** (solo si la página es o tiene
   algo con papel Pertenece a o Lo dirige; desde un miembro se salta a su grupo). Se abre en Familia u Organigrama si
   hay y, si no, en Enlaces; el modo elegido se recuerda por plantilla.
9. **«Menciona» = enlaces y páginas incrustadas del texto** (`page_links`); no los nombres sin enlazar (caro en todo
   el mundo). Un destino que ya está en un campo no repite arista «menciona». Interruptor «Solo campos».
10. **Lo del máster**: los enlaces desde un secreto salen al máster con trazo discontinuo; las notas personales no
    cuentan nunca.
11. **Otras fuentes no cuentan** (pines de mapas, pizarra, eventos, subpáginas): solo campos y texto. La jerarquía de
    subpáginas ya se ve en el árbol.
12. **El grafo del mundo** (Páginas › «Relaciones», a pantalla entera como el mapa): filtros por plantilla, por tipo
    de relación (cada campo y «menciona») y por etiqueta; las páginas sin relaciones, ocultas por defecto; buscar para
    centrar; color por plantilla. Pinta en canvas a partir de ~800 nodos.
13. **Solo se mira**: abrir la página, «Centrar aquí», mover y acercar. Crear relaciones arrastrando, más adelante.
14. **La jugadora** ve la pestaña y el grafo del mundo con lo que conoce: solo páginas que ve, campos no ocultos,
    destinos que ve y enlaces desde documentos que ve (la pauta de `getPageLinks`). Prueba de fugas: ni aristas, ni
    conteos, ni nodos fantasma de lo oculto.
15. **Se calcula en el servidor** (consulta nueva sobre `page_links` y `pages.properties`), sin caché: 5.000 páginas y
    20.000 aristas en menos de 300 ms.
16. **Gráficos**: un nodo `chart` del editor que se guarda como YAML compatible con el formato ```chart del antiguo
    (la IA lo escribe en Markdown), con un **editor visual** al lado (tipo, etiquetas y series en una tabla, colores,
    leyenda) y «Ver YAML». Los seis tipos: barras, líneas, tarta, donut, radar y área polar. Datos propios o de una
    tabla de la misma página (por su id). Tabla oculta con los datos para el lector de pantalla.
17. **Librerías** (licencias comprobadas el 2026-11-16 en npm): `d3-force`, `d3-zoom`, `d3-selection` (ISC) para el
    grafo; `@dagrejs/dagre` 3.x (MIT) para el árbol y el organigrama; `chart.js` 4.x (MIT), cargado aparte, para los
    gráficos. La lectura del YAML se porta del antiguo (`graficos/bloque.ts`, cabecera de origen y `docs/terceros.md`).

## Preguntas del lienzo, decididas por Claude con permiso de Enrique (2026-11-17)

Lienzo: https://claude.ai/artifact/SnDrrzaLKMPhqCUkwbSbBW. Enrique: «Responde tú a las preguntas con lo que creas más
coherente».

18. La pestaña se abre en Familia u Organigrama si la página los tiene; si no, en Enlaces (confirma la 8).
19. El nombre al revés no es obligatorio: al elegir un papel se rellena solo si está vacío (Padre o madre → «Hijos»,
    Pareja → «Pareja», Pertenece a → «Miembros», Lo dirige → «Dirige»). Sin él, «<Campo> de <página>».
20. «Menciona» encendido de entrada, en la pestaña y en el grafo del mundo (Enrique pidió los enlaces del texto).
21. El grafo del mundo se abre con un icono en la cabecera del árbol de páginas: la barra sigue «Páginas · Calendarios ·
    Archivos».
22. Bajo el nombre, en Familia y Organigrama, el primer campo de texto visible para quien mira.
23. El editor del gráfico ocupa el sitio del panel mientras el bloque está elegido.
24. El gráfico no va, por ahora, como bloque del panel de la derecha.

## Objetivo

Ver de un vistazo quién es quién en el mundo: con quién se relaciona una página, la familia de un personaje, quién
manda en una facción, y cómo se enredan las cosas en todo el mundo, sin dibujar nada a mano. Y poner gráficos en las
páginas (población, poder de las facciones, tesoros…).

## Capacidades

| Capacidad | Qué |
|---|---|
| `relaciones` | Papel y nombre al revés en los campos de relación; cálculo del grafo en el servidor (página y mundo) con lo que ve cada uno; pestaña «Relaciones» con sus tres modos; grafo del mundo a pantalla entera; MCP |
| `graficos` | Nodo `chart` en el editor y en Markdown; editor visual; datos propios o de una tabla de la página; MCP por el texto de la página |

## Modelo de datos (resumen)

- `pageProperty` de tipo `pages` en plantillas: `role?: 'parent' | 'partner' | 'member-of' | 'leads'` e
  `inverseName?: string`. Se copia al crear la página desde la plantilla (va en el campo, no en el valor).
- Sin tablas nuevas: el grafo se calcula de `pages.properties` y `page_links`.
- Nodo `chart` en `packages/editor/src/nodes/chart.ts` con el YAML como atributo; Markdown ```chart.

## Comandos (acciones y MCP)

- `getRelations({ pageId, depth, mode })` → nodos y aristas (con `kind: 'field' | 'mention'`, nombre, papel, si viene de
  un secreto). MCP `relaciones_pagina`.
- `getWorldGraph({ worldId, templates?, relations?, tags?, orphans? })`. MCP `grafo_mundo`.
- El papel y el nombre al revés, en las acciones y herramientas de plantillas que ya hay.
- Los gráficos se escriben en el texto de la página (```chart), con las herramientas de páginas que ya hay.

## Criterios de aceptación

- Un PNJ con Facción y Padres: su pestaña abre en Familia; Enlaces muestra facción, lugar y lo que menciona; el
  organigrama de la facción pone al líder arriba y a los miembros debajo.
- El grafo del mundo con 5.000 páginas se abre y se mueve con fluidez; filtros y búsqueda funcionan.
- La jugadora no ve nada de lo oculto (prueba de fugas e2e).
- Un ```chart escrito por la IA se ve como gráfico; se edita con el editor visual y vuelve a Markdown igual.
- Unitarias, integración, e2e (crear, ver, jugadora, accesibilidad con axe), lint, typecheck y licencias en verde.

## Lo que había

- **Crisol antiguo**: grafo calculado del frontmatter (clave del campo = tipo) y de los enlaces; modos Enlaces,
  Familia (`padres`, `pareja`) y Facción (`faccion`, `lider`, `sede`), elegidos a mano; SVG y fuerzas propias.
  Gráficos con Chart.js y YAML ```chart, sin editor visual.
- **Eana**: ningún `padres` ni `pareja`; sí `portador`, `lugar`, `faccion`, `dentro-de`, `sede`, `lider`, `relacionados`
  y `frentes`. Ningún gráfico.
- **Crisol nuevo**: el tipo de propiedad `pages` ya existe (sin papel); `page_links` guarda los enlaces del texto;
  `getPageLinks` es la pauta de lo que ve la jugadora; el editor es TipTap 3 (bloques en `packages/editor/src/nodes`).
