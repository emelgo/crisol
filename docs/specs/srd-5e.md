# Spec: srd-5e (módulo 3)

Estado: **por aprobar**. Tercera capacidad del módulo 3 (`docs/specs/modulo-3.md`), después de `sistemas`. Lo que
decidió Enrique, en `docs/modulos.md` § «#### `srd-5e`». El estudio, en `research/dndbeyond/contenido-5e-y-mecanica.md`
(y las fuentes y lo legado en `research/dndbeyond/creador-y-hoja.md`). La decisión de arquitectura, en ADR-0012 (por
aprobar con esta spec).

## Objetivo

Que Crisol traiga de serie un **5e completo**: las reglas que calculan un personaje y **todo el SRD 5.1 y el 5.2.1**,
en español y en inglés, con cada cosa **automatizada**, como en D&D Beyond. Una campaña lo elige y decide qué
ediciones valen.

Es la base de lo que viene detrás:
- `personajes` crea y sube de nivel personajes con este contenido;
- `hoja` los pinta y tira desde ellos;
- el compendio del módulo 4 lo enseña para buscarlo y leerlo.

Por eso aquí no hay pantallas para el contenido: se ve en «Sistemas», se prueba en «Probar» y lo consulta la IA.

Y el modelo tiene que valer para **todo el 5e oficial**, no solo para el SRD: Enrique quiere un marketplace y vender
libros de Wizards en la app. Cada cosa dice de qué fuente sale y con qué licencia; quién la tiene llegará con el
marketplace.

Usuarios:
- el máster, que elige el 5e para su campaña y sus ediciones (Fateforge, con las reglas de 2014);
- la IA del máster, por el MCP;
- los jugadores no ven nada nuevo hasta `personajes`.

### Historias

1. Como máster, elijo el 5e para mi campaña y decido qué vale: las dos ediciones o una, con lo legado o sin él, y de lo
   que está en las dos, las dos versiones o solo la más nueva. Y con qué reglas generales se juega (2014 o 2024).
2. Como máster, en «Probar» hago un guerrero de nivel 5 con una cota de malla y una espada larga del contenido del 5e:
   veo su CA, su ataque y sus PG, cada uno con su desglose, y tiro el ataque.
3. Como máster, desde claude.ai le pregunto a la IA por un conjuro (en español) y le pido que pruebe su tirada.
4. Como máster, copio el 5e para hacer el de Eana: la copia lleva todo su contenido.

### Lo que hay en los dos SRD (medido el 2026-11-04 con los PDF oficiales)

| | SRD 5.1 (2014) | SRD 5.2.1 (2024) |
|---|---|---|
| Páginas (inglés / español) | 403 / 437 | 364 / 398 |
| Clases y subclases | 12 y 12 | 12 y 12 |
| Especies | 9 (y 4 subrazas) | 9 |
| Trasfondos | 1 | 4 |
| Dotes | 1 | unas 17 (de origen, generales, de estilo de combate y dones épicos) |
| Conjuros | 319 | 339 |
| Criaturas | unas 317 | unas 327 |
| Objetos mágicos | unos 236 | unos 254 |
| Estados | 15 | 15 |
| Además | el equipo (armas, armaduras, objetos, herramientas, monturas), el texto de las reglas (cómo se juega, combate, magia) y las tablas | lo mismo, con las maestrías de armas y el glosario de reglas |

En total, unos **2.500 documentos**, cada uno con sus textos en los dos idiomas. Los cuatro PDF están en la página del
SRD de D&D Beyond, con licencia CC BY 4.0. Los españoles son los oficiales de Wizards: el del 5.1 y el del 5.2.1
(diciembre de 2025).

## Mapa de capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `mecanica` | Lo que el formato de sistemas necesita para un juego automatizado, para cualquier sistema: efectos, recursos, lo que concede algo, escalado, estados activables y el grado de automatización (`packages/systems`, puro) | — |
| `fuentes` | Cada documento con su fuente, su edición, su licencia y su concepto; la campaña elige ediciones, lo legado y lo más nuevo; las referencias por concepto | `mecanica` |
| `reglas-5e` | El sistema 5e: sus tipos, sus campos, sus fórmulas y sus tiradas, y las reglas generales que cambian entre ediciones como ajustes de la campaña | `mecanica` |
| `contenido` | El contenido de los dos SRD, sacado de los PDF oficiales en los dos idiomas, con su mecánica y comprobado | `reglas-5e`, `fuentes` |
| `probar` | En «Probar», añadir documentos del contenido del sistema (clases con su nivel, armas, armaduras, objetos) | `contenido` |
| `ia` | Las herramientas MCP para buscar y leer el contenido de un sistema y probarlo | `contenido` |

Orden: `mecanica` → `fuentes` → `reglas-5e` → `contenido` (por categorías: equipo, estados, conjuros, objetos mágicos,
criaturas, especies, trasfondos y dotes, clases y subclases, reglas) → `probar` → `ia`. Lo arriesgado va antes: el
modelo de la mecánica tiene que poder con todo el SRD. Por eso se prueba con lo más difícil (el brujo, el monje, el
mago, Bola de fuego, Escudo, el Anillo de protección y un dragón) antes de sacar el resto.

## Requisitos

### `mecanica`

Lo nuevo del formato de sistemas (ADR-0012). Vale para cualquier sistema, no solo para 5e.

- **Efectos**: un documento (un rasgo, un objeto, un conjuro activo, un estado) cambia algo de quien lo tiene. Cada
  efecto lleva:
  - su **destino**: un campo o un elemento de un conjunto (`ca`, `caracteristicas.des.valor`,
    `habilidades.sigilo`);
  - su **operación**: sumar, fijar, fijar la base (las CA alternativas, como Defensa sin armadura), mínimo, máximo,
    grado de competencia (competente, pericia, media), ventaja o desventaja, o añadir a una lista (resistencias,
    sentidos, idiomas, velocidades);
  - su **valor**: una fórmula del sistema;
  - su **condición**: una fórmula de sí o no sobre el estado (`@equipado`, `@sintonizado`, `!@armadura`,
    `@nivel >= 5`, un estado activo);
  - su **origen**, que sale en el desglose.

  El orden de aplicación es fijo (base, fijar, sumar, mínimo y máximo) y sale en el desglose. Lo que depende del
  objetivo («contra aberraciones») va en la tirada como propuesta, que el jugador confirma.
- **Recursos**: los usos de un rasgo o de un objeto, con su máximo (una fórmula: `@competencia`,
  `@caracteristicas.car.mod`, «1 a nivel 1, 2 a nivel 6»), cuándo se recuperan (descanso corto, largo, al amanecer u
  otro) y cuánto (una fórmula: todo, 1, `1d6 + 4`).
- **Lo que concede algo**: acciones (con su tirada), conjuros (fijos, o a elegir de una lista con filtros, y cómo
  cuentan), competencias, elecciones (anidadas, con cuántas) y otros documentos. Siempre con datos explícitos, nunca por
  el nombre.
- **Escalado**: por nivel del personaje (la tabla de los trucos), por cada espacio por encima del base (más dados, más
  objetivos) o con una tabla por espacio.
- **El daño, como partes** `{ dados, tipo }`; la curación igual; la salvación como datos (característica, CD y qué pasa
  al superarla).
- **Estados activables con duración** (la Furia, Mago armadura, Bendecir, los estados como Envenenado): un documento
  que, mientras está activo, aplica sus efectos. Valen para todo el contenido, también el propio.
- **Grado de automatización** en cada documento: completo, parcial o solo texto, y qué se lleva a mano. Lo leen «Probar»
  y la IA. Lo muy complejo (Forma salvaje, Polimorfar, Deseo) va como texto, con al menos una acción o un recurso que se
  tira y se cuenta.
- **Los ajustes de la campaña en las fórmulas** (`@ajustes.reglas`), para lo que cambia según las reglas que elige.
- **Validar todo**: cada efecto, recurso, concesión y escalado se comprueba como las fórmulas de hoy (su ruta, sus
  nombres y por qué), y su ritmo entra en el presupuesto.

### `fuentes`

- **Cada documento de contenido lleva** su **fuente** (SRD 5.1, SRD 5.2.1; más adelante, un libro con licencia), y
  cada fuente su **edición**, su editorial, su licencia y su atribución.
- **Un concepto** une las versiones de lo mismo entre ediciones: el Guerrero de 2014 y el de 2024 son dos documentos con
  el mismo concepto. Con eso salen solas:
  - la marca **«Legado»**: lo de 2014 que tiene versión de 2024;
  - **solo lo más nuevo**: de cada concepto, el de la fuente más reciente;
  - las listas sin duplicados.
- **Las referencias, al concepto**: «concede Curar heridas» se resuelve con la edición de quien lo concede (o la de la
  clase), según la campaña. Una prueba comprueba que cada referencia se resuelve en las dos ediciones.
- **La campaña manda, también en el creador** (cuando llegue): activa cada edición, esconde lo legado o deja solo lo más
  nuevo de lo repetido. En D&D Beyond esto va por personaje y el máster no lo puede limitar: aquí sí.
- **Nunca se cambia el contenido debajo de un personaje**: una versión nueva es un documento nuevo, y lo que ya se eligió
  se queda.
- **Preparado para el marketplace**: el registro de fuentes guarda la editorial y la licencia; quién tiene cada fuente
  llegará con él. No hay pagos ni libros fuera del SRD en esta capacidad.

### `reglas-5e`

- **El sistema 5e de serie**, con id `5e`, en el catálogo. Se abre para leer y se copia, como «En blanco».
- **Sus tipos**: personaje; y, como objetos, clase, subclase, especie, trasfondo, dote, rasgo, conjuro, arma, armadura,
  equipo, objeto mágico, estado y regla (el texto de las reglas). Las criaturas, como actores.
- **Lo que calcula**, con su desglose:
  - las características y sus modificadores;
  - el bono por competencia;
  - las salvaciones y las habilidades (con su competencia o pericia);
  - la CA (con armadura, sin armadura, Defensa sin armadura y escudo);
  - los PG, la iniciativa, la percepción pasiva y la carga;
  - el lanzamiento de conjuros: su característica, la CD, el ataque y los espacios (también con multiclase);
  - los ataques de cada arma y los dados de golpe.
- **Sus tiradas**: pruebas de característica, salvaciones, habilidades, ataques y daño (el crítico dobla los dados),
  iniciativa, salvaciones de muerte y dados de golpe, con ventaja y desventaja.
- **Las reglas generales que cambian entre ediciones**, como ajustes de la campaña, con un valor por edición y sin
  preguntar al usarlas: el agotamiento, los dados de golpe del descanso largo, la sorpresa, las pociones, la
  preparación de conjuros y las demás que salgan al comparar los dos SRD. Por defecto, las de 2024.
- **Mezclar clases de dos ediciones en una multiclase**: un ajuste de la campaña, apagado por defecto (lo usará
  `personajes`).
- **Su atribución**: la que pide cada SRD, en sus fuentes. En la interfaz no sale la marca «D&D»: el sistema se llama
  «5e».

### `contenido`

- **Sale solo de los PDF oficiales del SRD**, en inglés y en español: nada de D&D Beyond, de Foundry ni de otras
  recopilaciones. Los términos en español son los de la traducción oficial.
- **Cómo se saca**:
  - unos scripts de desarrollo (`scripts/srd/`, fuera de la app) pasan los PDF a texto y sacan cada categoría a su
    forma (los conjuros, las criaturas y los objetos tienen una estructura fija);
  - la IA ayuda a escribir la mecánica de cada cosa, que comprueban las pruebas;
  - cada documento lleva la página del PDF de la que sale, para revisarlo.

  Los PDF no entran en el repositorio (van en `datos-locales/`); el contenido ya sacado, sí.
- **Los dos idiomas en el mismo documento**: cada documento lleva sus textos `{ es, en }`. Lo español y lo inglés se
  emparejan por su posición y su nombre, y una prueba comprueba que no falta ninguno en ningún idioma.
- **Las criaturas, con todo su statblock como datos**, también sus acciones (con su ataque, su daño, su salvación, su
  recarga y su coste legendario). Los valores del SRD van tal cual, y una prueba comprueba que las fórmulas dan lo
  mismo.
- **El texto de las reglas**, como documentos de su tipo, para que la IA lo consulte (y el compendio, después).
- **Copiar el 5e** copia su contenido a la cuenta (cabe en los límites de hoy: 5.000 documentos de hasta 64 KB).

### `probar`

- En «Probar», **añadir del contenido**: buscar un documento del sistema por su nombre, en su tipo, y ponerlo en el
  documento de prueba (una clase con su nivel, una armadura, un arma, un objeto mágico sintonizado). Sus efectos y sus
  recursos entran en lo calculado, con su desglose, y sus acciones en las tiradas.

### `ia`

- **Herramientas**:
  - buscar en el contenido de un sistema por tipo, nombre, edición e idioma;
  - leer un documento;
  - probar una tirada o una fórmula con documentos del contenido en el documento de prueba (amplía `probar_formula` y
    `probar_tirada`).
- Los textos del contenido son datos, nunca órdenes para la IA.

### Interfaz

- **Sin pantallas nuevas**. Lo que cambia:
  - en «Probar», añadir del contenido;
  - en la ventana de la campaña, las opciones de las ediciones (lo legado, lo más nuevo) y las reglas generales.
- Los dos se diseñan y se aprueban en el paso de diseño, antes del plan. Siguen `docs/diseno.md`; todo con el teclado y
  en el móvil, WCAG 2.1 AA.

## Pila

La de los módulos anteriores. Sin dependencias nuevas en la app. Para sacar el contenido, en local, `pdftotext`
(poppler, ya instalado en el VPS): es una herramienta del sistema que ejecutan los scripts de desarrollo, no va en la
app ni en la CI.

## Comandos

Los del módulo 0 (`docs/specs/fundacion.md` § Comandos). Y, en local:

```
node scripts/srd/extraer.ts <categoría>   Saca una categoría de los PDF (en datos-locales/srd) a su borrador
node scripts/srd/comprobar.ts             Cuenta lo sacado por categoría e idioma y lo compara con lo medido
```

## Estructura

```
packages/systems/src/                    La mecánica del formato (efectos, recursos, concesiones, escalado) y las fuentes
packages/systems/src/catalog/5e/         El sistema 5e: su documento y su contenido, por categorías (JSON)
packages/systems/src/catalog/5e/referencia/  Los personajes de referencia y lo que deben dar
scripts/srd/                             Los scripts para sacar el contenido de los PDF (solo desarrollo)
datos-locales/srd/                       Los PDF oficiales y su texto (fuera de git)
apps/web/src/systems/editor/try.tsx      «Probar», con el contenido
apps/server/src/mcp/tools.ts             Las herramientas del contenido
```

## Estilo

El del módulo 0 (`docs/specs/fundacion.md` § Estilo). El contenido, en JSON con las claves del formato en inglés y las
del 5e en español (`fuerza`, `bola_de_fuego`).

## Pruebas

- **`packages/systems`**: cada operación de los efectos y su orden, los recursos y su recuperación, cada concesión, cada
  escalado, los estados activables, las referencias por concepto y las opciones de las ediciones.
- **El contenido**:
  - todo lo medido está dentro, por categoría y en los dos idiomas;
  - todo valida y cada referencia se resuelve en las dos ediciones;
  - las criaturas: sus fórmulas dan los valores del SRD;
  - los conjuros y las armas: su ataque, su daño y su escalado, en muestras de cada nivel y escuela.
- **Los personajes de referencia**: cada clase en los niveles 1, 5, 11 y 20, en las dos ediciones (96). Dan lo que dicen
  las tablas del SRD (competencia, espacios, dados de golpe, rasgos y recursos por nivel). Unos 24, hechos a mano con su
  equipo, dan su CA, su ataque, su CD y sus PG.
- **Integración**: copiar el 5e con su contenido; la campaña con sus ediciones; las herramientas MCP en cada modo de IA.
- **Web**: «Probar» con el contenido; las opciones de las ediciones en la campaña.
- **E2E** (Playwright + axe): el guerrero de nivel 5 en «Probar»; elegir el 5e con sus ediciones en una campaña.
- **Ritmo**: un personaje de nivel 20 con su clase, su equipo y sus objetos mágicos del SRD, en menos de 20 ms;
  buscar en el contenido, en menos de 100 ms.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas, con TDD en cada porción.

## Límites

- **Siempre**:
  - el contenido, solo de los PDF oficiales del SRD, con su atribución;
  - cada documento, con la página de la que sale;
  - validar todo el contenido en las pruebas;
  - todo en verde en local antes de subir (la CI gasta cuota: una vez tras muchos cambios).
- **Preguntar antes**: dependencias nuevas, cambiar los límites del formato o `CONSTRAINTS.md`, y cualquier contenido
  que no sea del SRD.
- **Nunca**:
  - datos, textos ni código de D&D Beyond, de Foundry ni de otras recopilaciones del SRD;
  - los PDF en el repositorio;
  - la marca «D&D» en la interfaz;
  - nada de `research/` en el código.

## Criterios de éxito

1. **Todo el SRD dentro**: lo de la tabla de arriba, contado por categoría, en los dos idiomas, y todo valida.
2. **Los personajes de referencia** dan lo que dicen las reglas, en las dos ediciones.
3. **En «Probar»**, Enrique hace un guerrero de nivel 5 con una cota de malla y una espada larga del 5e: ve su CA, su
   ataque y sus PG con su desglose, y tira el ataque.
4. **Desde claude.ai**, la IA consulta un conjuro (en español) y prueba su tirada.
5. **En la campaña**, Enrique elige el 5e con solo 2014, con las dos ediciones sin lo legado y con solo lo más nuevo, y
   las reglas de 2014 o de 2024. Se nota en lo que se puede elegir en «Probar».
6. **Una criatura del SRD** (un dragón adulto rojo) tiene sus acciones como datos, y su ataque y su daño se tiran.
7. **Ritmo**: el personaje de nivel 20, en menos de 20 ms; buscar en el contenido, en menos de 100 ms.
8. **Calidad**: la CI en verde, sin supresiones nuevas; axe sin fallos críticos ni graves; todo con el teclado y en el
   móvil.

## Fuera de `srd-5e`

- Las pantallas para buscar y leer el contenido, y el contenido propio del mundo: el compendio (módulo 4).
- El creador, subir de nivel y los personajes: `personajes`.
- La hoja y tirar desde ella: `hoja`.
- El marketplace, los pagos y los libros que no son SRD (solo el modelo preparado).
- El contenido de Fateforge (módulo 4).
- Importar de Foundry: `foundry`.
- Escalar una criatura a otro VD.

## Preguntas abiertas

1. **Lo que trae una campaña nueva con el 5e**: *propuesta*, las dos ediciones activas, lo legado escondido y las reglas
   de 2024 (en Fateforge, Enrique pone las de 2014).
2. **Cómo se revisa el contenido**: *propuesta*, las pruebas comprueban todo lo que se puede comprobar; Enrique revisa en
   cada punto de control una muestra al azar (unos 20 documentos de cada categoría) contra el PDF, con su página al lado.
3. **El nombre del sistema**: *propuesta*, «5e» (en inglés, también «5e»), con su resumen y las atribuciones de los dos
   SRD.
