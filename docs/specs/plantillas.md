# Spec: Módulo 2 — Tipos de página y plantillas

Estado: aprobada por Enrique («si», 2026-11-03), con las cuatro propuestas de «Preguntas abiertas» · Fecha: 2026-11-03

Fuentes:
- Decisiones de partida: `docs/modulos.md` § «2. Tipos de página y plantillas» (entrevista del 2026-11-03).
- Estudios: `research/foundry/tipos-de-documento.md` (con craft-anything), `research/kanka/tipos-y-relaciones.md`,
  `research/legendkeeper/plantillas.md` y `research/worldanvil/plantillas.md`.
- Inventario: `docs/inventario.md` § 3 y § 4. Los tipos del Crisol actual y los que Enrique cambió en Eana
  (`.crisol/clases.json`, leído sin tocarlo).
- Lo que ya hay: propiedades de página (`packages/domain/src/properties.ts`) y panel de bloques (ADR-0008).

## Objetivo

Que las páginas del mundo tengan tipo con sus campos, y que las tablas que hoy hace Dataview salgan solas. Al crear una
página, se elige una plantilla (PNJ, Lugar, Facción…) y la página sale con sus campos en el panel y sus apartados en el
texto. Después es una página como las demás, que se cambia libremente, pero recuerda de qué plantilla salió.

Con eso, el panel de una facción enseña sus miembros sin escribir nada: las páginas de tipo PNJ cuyo campo Facción
apunta a ella. Es lo que hacen casi todas las 45 tablas de Dataview de Eana.

Usuario del módulo: Enrique, como máster. La IA hace lo mismo por el MCP, porque **Eana se pasará así**.

Tamaño de referencia (Eana, contado el 2026-11-03 sin abrirla): 2.339 páginas, unas 570 con tipo. Las del mundo son
52 PJ, 39 objetos, 24 PNJ, 23 frentes, 18 lugares y 6 facciones; el resto son reglas, que irán al compendio (módulo 4).

### Historias

1. Como máster, en «Página nueva» elijo «Desde plantilla» y una plantilla. La página sale con sus campos en el panel y
   sus apartados en el texto, y la relleno.
2. Los campos tienen su control: un desplegable para las opciones, un buscador de páginas para los enlaces, un reloj
   con sus segmentos y una casilla.
3. En el panel de una facción veo «Miembros»: los PNJ cuya Facción es ella. Lo mismo con los habitantes de un lugar o
   con lo que lleva un PNJ. Añado otra tabla así con desplegables.
4. En «Plantillas», en Mis mundos, veo las de serie y las mías. Copio una de serie para hacer la mía («PNJ de Eana»,
   con el campo Frentes) o hago una desde cero («Frente»).
5. Cambio una plantilla mía, y las páginas ya hechas no cambian.
6. Desde claude.ai, la IA crea muchas páginas desde plantilla de una vez, crea plantillas mías y lee las tablas de una
   página.

## Mapa de capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `campos` | Los tipos nuevos de propiedad (opciones, enlace, reloj) y el id de campo, con sus controles en el panel | — |
| `plantillas` | Las de serie (en el código) y las de la cuenta (tabla nueva), su pantalla y su editor | `campos` |
| `crear` | «Desde plantilla» al crear una página, también desde un enlace sin resolver; la página recuerda su plantilla | `plantillas` |
| `tablas` | El bloque del panel «Tabla de páginas», calculado en el servidor | `crear` |
| `ia` | Las herramientas MCP del módulo | todas las anteriores |

Orden: `campos` → `plantillas` → `crear` → `tablas`. Cada capacidad lleva su API, su interfaz y sus herramientas MCP;
`ia` solo junta las que quedan y la prueba de pasar muchas páginas.

**Primero, lo más arriesgado**: la identidad de los campos (que «Facción» sea el mismo campo en todos los PNJ aunque se
renombre en una página o se copie la plantilla) y la consulta de las tablas con 5.000 páginas. Van en la primera porción
de `campos`; la decisión, en `docs/adr/0009-plantillas-y-campos.md`.

## Requisitos

### `campos`

- **Las propiedades siguen siendo los datos de la página** (`pages.properties`): se buscan, se filtran y van en el
  Markdown. Los campos de una plantilla son propiedades con dos cosas más:
  - **un id de campo** estable (`fieldId`), que viene de la plantilla. Las tablas casan por ese id, no por el nombre:
    se puede renombrar «Facción» en una página sin que se pierda;
  - **su forma**, guardada en la propia página: las opciones de un desplegable, los segmentos de un reloj, a qué
    plantillas apunta un enlace. Por eso cambiar la plantilla no toca las páginas ya hechas.
- **Tipos de campo**. Los de ahora se quedan (texto, número, sí/no, lista y enlace a varias páginas) y llegan tres
  más:
  - **opciones**: uno de una lista. Un valor que no esté en la lista se conserva y se ve marcado;
  - **enlace a una página**: una sola;
  - **reloj**: de 2 a 12 segmentos, con los que están llenos.
- **Los enlaces de un tipo** (`targets`, plantillas a las que apunta el campo) **filtran el buscador, no encierran**:
  el buscador enseña primero las páginas de esas plantillas y deja elegir cualquier otra. El servidor comprueba siempre
  que la página enlazada exista y sea del mismo mundo, venga de la interfaz o de la IA.
- **Si una página enlazada va a la papelera**, el campo la enseña tachada y el aviso al borrar cuenta también los
  campos que la apuntan. Al purgarla, el enlace se quita del campo.
- **Un valor que no vale no aparta la página**: el campo se ve marcado y conserva lo que tenía.
- **Fechas**: como texto hasta el calendario del mundo (módulo 8).

### `plantillas`

- **Una plantilla** lleva su nombre, un icono, sus campos (con id, nombre, tipo, forma y valor inicial), los bloques de
  su panel (como el retrato o «Miembros») y el esqueleto del texto en Markdown (sus apartados).
  - No lleva enlaces a páginas concretas: es de toda la cuenta, no de un mundo.
- **Las de serie** viven en el código (`packages/domain`), con un id legible (`pnj`, `lugar`, `faccion`, `objeto`,
  `mision`, `sesion`). **No se pueden cambiar.** Su contenido es una propuesta, por repasar con Enrique en el diseño:

  | Plantilla | Campos (en el panel) | Bloques del panel | Apartados (en el texto) |
  |---|---|---|---|
  | PNJ | Especie, Rol, Facción (→ Facción), Lugar (→ Lugar), Estado (Vive, Ha muerto, En paradero desconocido, No se sabe), Padres y Pareja (→ PNJ) | Retrato; «Lleva encima» (Objeto · Portador) | Quién es · Cómo interpretarlo · Ganchos |
  | Lugar | Tipo (de plano a paraje), Dentro de (→ Lugar), Población, Gobierna (→ PNJ) | Imagen; «Lugares dentro» (Lugar · Dentro de); «Habitantes» (PNJ · Lugar) | Descripción · Ganchos |
  | Facción | Tipo (reino, casa noble, gremio…), Líder (→ PNJ), Sede (→ Lugar), Objetivo | Emblema; «Miembros» (PNJ · Facción) | Quiénes son · Qué quieren · Ganchos |
  | Objeto | Tipo, Rareza, Sintonización (sí/no), Valor, Portador (→ PNJ) | Imagen | Descripción · Historia |
  | Misión | Estado (pendiente, en curso, completada, fallida), La da (→ PNJ o Facción), Lugar (→ Lugar), Recompensa | — | Objetivos (con casillas) · Qué pasa |
  | Sesión | Número, Fecha (texto), Aparecen (→ PNJ) | — | Resumen · Qué pasó · Pendiente |

- **Las de la cuenta** (tabla `page_templates`, de la organización, como las etiquetas del ADR-0006). Se hacen de dos
  maneras:
  - **copiando** otra, de serie o propia: se guardan los ids de sus campos y de cuál viene (`basedOn`);
  - **desde cero**: campos nuevos con ids nuevos.
  - Se cambian y se borran, y todo pasa por `operation()`: queda en el historial y se deshace. Borrar una no toca sus
    páginas, que siguen diciendo «hecha con Frente (borrada)», y sus tablas siguen funcionando.
  - Las gestiona quien administra la organización. Las usa quien puede crear páginas en un mundo de la cuenta.
- **Dónde se ven**: «Plantillas» en la barra de Mis mundos, junto a «Etiquetas». Las de serie llevan un candado y el
  botón «Copiar». Las propias se abren en un editor con la forma de una página: los campos en el panel y los apartados
  en el texto, en un editor sin colaboración que guarda Markdown.
- **Nada de frases con género** sobre el nombre de una plantilla: «Página nueva · Frente», nunca «Nuevo Frente».

### `crear`

- **«Desde plantilla»** en el cuadro de «Página nueva», junto a Texto, Mapa, Pizarra, Línea temporal y Árbol. Se elige
  la plantilla (primero las propias, con buscador) y el nombre. La página sale con:
  - sus campos como propiedades, con su valor inicial;
  - los bloques de su panel;
  - el esqueleto como cuerpo, pasado al editor por el mismo camino que el Markdown de la IA.
- **La página recuerda su plantilla** (`pages.template`: el id legible de una de serie o el de una propia). Se ve junto
  al título, con su icono, y lleva a la plantilla.
- **Un solo camino**: «Página nueva», crear desde un enlace sin resolver o una mención, y `crear_paginas` del MCP usan
  la misma función del servidor. Al crear desde un enlace sin resolver también se puede elegir plantilla.
- **Crear es una sola operación** del historial, con sus campos, su panel y su cuerpo: se deshace entera.
- Cambiar después los campos o el texto de la página no la separa de su plantilla.

### `tablas`

- **Un bloque nuevo del panel, «Tabla de páginas»** (`related`), en el grupo de las listas, junto a Subpáginas y
  Etiqueta. Se configura con desplegables:
  - «Páginas de [plantilla] cuyo [campo] es esta página», donde el campo es uno de enlace de esa plantilla;
  - hasta tres columnas más con otros campos de la plantilla (por ejemplo, Rol y Estado);
  - el orden: por título o por una de las columnas.
- **Se calcula en el servidor**, con las páginas de esa plantilla y de las copiadas de ella, que no estén en la
  papelera, cuyo campo (por su id) apunta a la página. Llega ya calculada a la interfaz y a la IA.
- **Si la configuración ya no vale**, porque la plantilla o el campo ya no existen, el bloque lo dice en vez de salir
  vacío.
- Las plantillas de serie traen sus tablas (por ejemplo, «Miembros» en Facción). Se pueden quitar, cambiar o añadir
  como cualquier bloque del panel.
- **Ritmo**: con 5.000 páginas en el mundo, el 95 % de las tablas se calcula en menos de 150 ms en el servidor.
- Solo en el panel. Las tablas dentro del texto, si hacen falta, más adelante.

### `ia`

Herramientas MCP nuevas o ampliadas. Siguen los modos y la cola de aprobación del módulo 0.

| Herramienta | Tipo | Qué hace |
|---|---|---|
| `listar_plantillas` | `read` | Las de serie y las de la cuenta, con sus campos |
| `ver_plantilla` | `read` | Una plantilla entera: campos, bloques del panel y esqueleto en Markdown |
| `crear_plantilla` | `write` | Desde cero o copiando otra |
| `cambiar_plantilla` | `write` | Su nombre, icono, campos, panel o esqueleto (solo las propias) |
| `borrar_plantilla` | `delete` | Una propia; sus páginas no cambian |
| `crear_paginas` | `write` | Ahora con `plantilla`: rellena los campos que no se den y, si no se da cuerpo, pone el esqueleto |
| `leer_pagina` | `read` | Ahora con su plantilla y sus tablas ya calculadas |
| `buscar_paginas` | `read` | Ahora filtra por plantilla y por el valor de un campo («PNJ cuyo Lugar es Ciudad Libre») |

- `cambiar_panel` admite el bloque nuevo y `editar_pagina` cambia campos como cualquier propiedad.
- **Ritmo**: `crear_paginas` con 50 páginas desde plantilla tarda lo mismo que sin ella (menos de 3 s en el servidor).

### Interfaz

- Pantallas y piezas nuevas:
  - la elección de plantilla en «Página nueva» y al crear desde un enlace;
  - los controles de los campos en el panel;
  - el bloque «Tabla de páginas» y su configuración;
  - «Plantillas» en Mis mundos y su editor.
- Siguen las normas de `docs/diseno.md` y la forma de Everlore en la página.
- Los prototipos se hacen y se aprueban en el paso de diseño, antes del plan.
- Todo usable en el móvil y con el teclado; WCAG 2.1 AA.

## Pila

La de los módulos 0 y 1, sin dependencias nuevas. El editor del esqueleto reutiliza el de la wiki, sin colaboración.

## Comandos

Los del módulo 0 (`docs/specs/fundacion.md` § Comandos). No hay comandos nuevos.

## Estructura

```
packages/domain/src/templates.ts      Las plantillas de serie y sus reglas (copiar, de cuál viene, el valor inicial)
packages/domain/src/properties.ts     Los tipos nuevos de propiedad y el id de campo
packages/contracts/src/templates.ts   Acciones de plantillas; el bloque `related` va en panel.ts
packages/db/src/schema/templates.ts   La tabla page_templates; pages.template en pages.ts
apps/web/src/templates/               La pantalla «Plantillas» y su editor
apps/web/src/wiki/                    Elegir plantilla, los controles de los campos y la tabla de páginas
```

## Estilo

El del módulo 0 (`docs/specs/fundacion.md` § Estilo). Las plantillas de serie se escriben como datos, con un
comentario breve por campo cuando su forma no se entienda sola.

## Pruebas

- **Dominio** (sin base de datos):
  - la validación de cada tipo de campo, con valores fuera de la lista y relojes fuera de rango;
  - copiar una plantilla conserva los ids de sus campos y de cuál viene;
  - las plantillas de las que viene una página («PNJ de Eana» cuenta como PNJ).
- **Integración**, contra Postgres:
  - crear desde plantilla es una operación y se deshace entera;
  - cambiar o borrar una plantilla no toca sus páginas;
  - la tabla de una facción con miembros de serie, de copias, en la papelera y con el campo renombrado;
  - el enlace a una página de otro mundo se rechaza, y al purgar la enlazada el campo se limpia;
  - el ritmo de la tabla con 5.000 páginas.
- **MCP**: cada herramienta en cada modo; `crear_paginas` con 50 páginas desde plantilla, enlazadas entre sí en
  cualquier orden, y que las tablas salgan bien después.
- **Fugas**: un jugador no recibe plantillas ni tablas por ninguna vía (la wiki sigue siendo solo del máster).
- **E2E** (Playwright + axe):
  - crear un PNJ desde plantilla, ponerle facción y verlo en «Miembros»;
  - hacer una plantilla desde cero y otra copiando una de serie;
  - añadir una tabla de páginas con los desplegables.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas, con TDD en cada porción.

## Límites

- **Siempre**:
  - pasar por la capa de políticas y por `operation()`;
  - comprobar en el servidor los campos de enlace, vengan de donde vengan;
  - casar las tablas por el id del campo, nunca por su nombre;
  - textos por i18n;
  - todo en verde en local antes de subir (los minutos de la CI van justos).
- **Preguntar antes**:
  - dependencias nuevas;
  - cambiar `CONSTRAINTS.md`;
  - cambiar las plantillas de serie que se aprueben en el diseño.
- **Nunca**:
  - que cambiar una plantilla cambie las páginas ya hechas;
  - un lenguaje de consultas;
  - nada de `research/` en el código;
  - tocar el Crisol actual.

## Criterios de éxito

1. **En staging**, Enrique crea un PNJ desde plantilla, le pone su facción y lo ve en «Miembros» al abrir la facción.
2. **Copia PNJ como «PNJ de Eana»** y le añade el campo Frentes (→ Frente). Hace **«Frente» desde cero** con Nivel,
   Estado, un reloj de 8 y Regiones (→ Lugar), más la tabla «PNJ del frente» (PNJ de Eana · Frentes). Crea un frente y
   dos PNJ con él, y salen en la tabla.
3. **Cambia «Frente»** (quita un campo), y los frentes que ya tenía no cambian.
4. **Desde claude.ai**, la IA crea en pocas llamadas 20 páginas desde plantilla (lugares, facciones y PNJ) enlazadas
   entre sí. Después lee una facción con `leer_pagina` y recibe sus miembros.
5. **Enrique deshace desde el historial** crear una página desde plantilla y crear una plantilla.
6. **Ritmo**: el 95 % de las tablas, en menos de 150 ms con 5.000 páginas.
7. **Calidad**:
   - la CI en verde, sin supresiones nuevas;
   - axe sin fallos críticos ni graves en las pantallas nuevas;
   - elegir plantilla, rellenar campos y configurar una tabla, con el teclado.

## Fuera del módulo 2

- El compendio de reglas, conjuros, criaturas y dotes: módulo 4, aparte de la wiki y como el de Foundry, con su
  estudio previo con craft-anything.
- PJ y tablas aleatorias (módulo 3, con las fichas y los dados).
- Formularios y un lenguaje de consultas como Dataview o Bases.
- Que cambiar una plantilla cambie las páginas ya hechas.
- Pertenencias con papel o fechas («antiguo miembro», «tesorero»), como las de Kanka: basta un campo de enlace.
- Tablas dentro del texto.
- Lo que ven los jugadores de las tablas (módulo 5).
- Fechas del calendario del mundo (módulo 8).

## Preguntas abiertas

Decididas: Enrique aprobó las cuatro propuestas (2026-11-03).

1. ~~**Las copias cuentan**~~: una página hecha con «PNJ de Eana», copiada de PNJ, sale en las tablas de PNJ. **Decidido:
   sí.** Si no, la tabla «Miembros» de serie no vería tus PNJ.
2. ~~**Aplicar una plantilla a una página ya hecha**~~, desde el menú de la página: añade los campos, bloques y apartados
   que falten, sin borrar nada, y cambia la plantilla que recuerda. **Decidido: sí.** Sirve para las páginas que se
   hicieron como texto y para cambiar el tipo de una página, que es la queja más repetida en World Anvil.
3. ~~**Los campos añadidos a mano**~~ a una página no entran en las tablas: solo los de su plantilla. **Decidido: así.**
   Para que uno cuente, se añade a una plantilla propia.
4. ~~**El contenido de las plantillas de serie**~~ (la tabla de `plantillas`). **Decidido: así**, sin cambios; se
   repasa al verlo en el diseño. Lo que es solo de Eana, como Frentes en PNJ, va en su copia.
