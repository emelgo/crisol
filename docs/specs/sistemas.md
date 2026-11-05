# Spec: sistemas (módulo 3)

Estado: **aprobada** por Enrique el 2026-11-04 («ok»), con sus respuestas a las preguntas. **Cambio (2026-11-05)**: el
editor y «Probar» se quitaron (Enrique: los sistemas se hacen con la IA); § `editor` queda como registro de lo que hubo.
«Sistemas» lista los de serie y los tuyos, sube un archivo, baja cada uno y uno vacío. Segunda capacidad del módulo 3 (`docs/specs/modulo-3.md`), después de `dados`. Las
decisiones de Enrique, en `docs/modulos.md` § «### 3. Sistemas, fichas y dados». Los estudios, en
`research/foundry/sistemas-y-su-api.md` y `research/foundry/tipos-de-documento.md`. Lo que hace el Crisol actual, en
`docs/inventario-sistemas.md`. La decisión de arquitectura, en ADR-0011 (por aprobar con esta spec).

## Objetivo

Que un sistema de reglas sea **datos**, no código: lo que hay en el juego (personajes, objetos, clases, conjuros…), qué
campos lleva cada cosa, cómo se calculan los valores derivados, qué se tira y cómo, y su contenido. Crisol trae un
catálogo de sistemas de serie, y cada cuenta puede crear o subir los suyos. Cada campaña elige el suyo.

Es la base de lo que viene detrás:
- `srd-5e` escribe el sistema 5e con este formato;
- `personajes` crea y sube de nivel personajes con él;
- `hoja` los pinta y tira desde ellos.

Por eso aquí aún no hay personajes ni hoja: se ve, se prueba y se valida el sistema.

Usuarios:
- el máster, que elige el sistema de su campaña y hace los suyos (sobre todo con la IA);
- la IA del máster, por el MCP;
- los jugadores no ven nada nuevo hasta `personajes`.

### Historias

1. Como máster, al crear una campaña (o en sus ajustes) elijo su sistema: uno del catálogo, uno de mi cuenta o
   ninguno. Si el sistema tiene fuentes, idiomas o ajustes, los elijo también.
2. Como máster, desde claude.ai le pido a la IA un sistema para mi juego (por ejemplo, uno de 2d6 + atributo). Ella:
   - lo escribe;
   - lo valida;
   - prueba una tirada y una fórmula.

   Sale en «Sistemas», en Mis mundos.
3. Como máster, copio un sistema del catálogo para hacer mi variante («5e de Eana») y le cambio un campo o una tirada.
4. Como máster, abro un sistema en su editor, por secciones:
   - le pongo tipos y campos, y escribo la fórmula de un valor (`10 + @des.mod`), que se comprueba mientras escribo;
   - lo pruebo: relleno un documento de prueba y veo cada valor calculado con su desglose, y tiro sus tiradas;
   - veo lo que no cuadra, si algo falla.
5. Como máster, bajo un sistema en un archivo y lo subo en otra cuenta.
6. Como máster, tiro dados en una campaña con sistema: los críticos son los de su juego, no siempre los del d20.

## Mapa de capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `formato` | El formato del sistema: el manifiesto, los tipos, los campos, los textos en varios idiomas y su validación (`packages/systems`, puro) | — |
| `formulas` | El lenguaje de fórmulas seguro: valores derivados con su desglose, comprobado al guardar | `formato` |
| `tiradas` | Las tiradas que define el sistema, sobre `@crisol/dice`, y los críticos de su juego | `formulas` |
| `guardar` | Los sistemas de la cuenta en la base de datos, el catálogo en el código, copiar, bajar y subir | `formato` |
| `campana` | La campaña elige su sistema, sus fuentes, su idioma y sus ajustes | `guardar` |
| `interfaz` | «Sistemas» en Mis mundos (la lista, copiar, bajar, subir) y la elección en la campaña | `campana` |
| `ia` | Las herramientas MCP para ver, crear, cambiar, validar y probar sistemas | `guardar`, `tiradas` |
| `editor` | El editor visual por secciones, con las fórmulas comprobadas al escribir y el panel para probar | `interfaz`, `tiradas` |

Orden: `formato` → `formulas` → `tiradas` → `guardar` → `campana` → `interfaz` → `ia` → `editor`. Lo arriesgado va antes. El
lenguaje de fórmulas tiene que poder con un 5e entero (con su desglose y sin pasarse de tiempo), y el formato tiene que
poder recibir los datos de un sistema de Foundry (lo prueba un fragmento de dnd5e convertido a mano, en las pruebas).

## Requisitos

### `formato`

- **Un manifiesto con la forma del de Foundry**, para que lo declarativo de un sistema suyo case uno a uno:
  - id, nombre, resumen (también para la IA) y versión;
  - la versión del formato de Crisol;
  - los tipos de cada clase de documento: actores (personaje, PNJ…) y objetos (clase, especie, trasfondo, dote,
    conjuro, arma…);
  - los paquetes de contenido, las fuentes, los idiomas y los ajustes de campaña.
- **Ids estables**:
  - los sistemas del catálogo llevan un id legible (`5e`), y los propios, un uuid;
  - cada tipo, campo, tirada y fuente lleva una clave legible (`[a-z0-9_]`, hasta 60) que no cambia aunque cambie su
    nombre.
- **Campos**:
  - **las clases del módulo 2**: texto, número, sí/no, lista, opciones, enlace y reloj;
  - **las del juego**:
    - dados: una fórmula de dados, validada con `@crisol/dice`;
    - recurso: actual, máximo y temporal;
    - grupo;
    - lista de filas con columnas;
    - conjunto: elementos fijos, cada uno con sus campos, como las características o las habilidades;
    - derivado: una fórmula que no se guarda;
  - cada campo lleva su valor inicial, su rango y su ayuda, y si es del máster.
- **Textos en varios idiomas**: cada nombre o texto del sistema es un texto o un `{ es, en }`. El sistema dice qué
  idiomas trae. Si falta uno, sale el del primer idioma.
- **Contenido** (las clases, los conjuros… que trae el sistema): documentos de sus tipos, en paquetes. Cada documento
  dice de qué fuente es. Para 5e, las fuentes son el SRD 5.1 y el 5.2, cada una con su licencia y su atribución.
- **Modificadores**: un documento (un objeto, un rasgo, un estado) puede dar bonos a un campo, con una condición (por
  ejemplo, «equipado»). Se suman al derivado y salen en su desglose con su origen.
- **La hoja y los pasos del creador**: el formato les deja su sitio (`sheet`, `creation`, `levelUp`). Su contenido lo
  definen `hoja` y `personajes`; aquí solo se comprueba que su forma es válida.
- **Las claves del formato, en inglés** (`types`, `fields`, `rolls`…), con la forma del manifiesto de Foundry; las de
  cada sistema (sus tipos, campos y tiradas), las que elija quien lo hace (`personaje`, `defensa`).
- **Validar** dice cada problema con un motivo corto en español y dónde está: por sus nombres en el editor
  («Personaje › Defensa › Fórmula») y por su ruta para la IA y el JSON (`types.personaje.fields.defensa.formula`). Lo
  que el formato no conoce no se pierde: se avisa y se conserva.
- **Límites**: el manifiesto, hasta 2 MB; hasta 500 campos por tipo y 5.000 documentos de contenido, de hasta 64 KB
  cada uno.

### `formulas`

- **Un lenguaje nuevo, con la forma de las fórmulas de Foundry**, y un intérprete propio que no ejecuta código:
  - los valores van con `@` (`@des.mod`, `@nivel`) y los dados caben en la misma fórmula (`1d20 + @fue.mod +
    @competencia`): con dados es una tirada; sin ellos, un valor;
  - sus operaciones: `+ - * / %`, comparaciones, `&& || !` y `? :`;
  - sus funciones, las de matemáticas de Foundry (`floor`, `ceil`, `round`, `abs`, `max`, `min`…) y unas pocas propias
    para listas y tablas;
  - una sola gramática: la de `@crisol/dice` más las referencias y las funciones.

  Así, las fórmulas de los datos de dnd5e (`@mod`, `@prof`) entran tal cual al importar de Foundry, solo cambiando a
  qué apunta cada nombre. El sistema de Eana se reescribe al pasarlo con la IA (no hay importador).
- **Una referencia que no existe es un error**, no un vacío.
- **Lo mismo en el servidor y en la web**: un paquete puro.
  - El servidor manda: calcula, comprueba y es lo que lee la IA.
  - La web calcula al momento lo que se ve.
- **Comprobado al guardar, no al usarlo**:
  - nombres que no existen;
  - tipos que no casan (sumar un texto);
  - ciclos (la CA que depende de sí misma), con la ruta de cada paso;
  - funciones y tablas que no existen.
- **Con desglose**. Cada valor derivado devuelve:
  - sus términos con su nombre («10 + Destreza (2) + Armadura (3)»);
  - los bonos de los modificadores con su origen («Anillo de protección +1»);
  - si se fijó a mano, el valor fijado.

  Es lo que lee la hoja y lo que lee la IA.
- **Con presupuesto**: un tope de pasos por documento entero (no por fórmula), para que una hoja no se coma el
  servidor. Al pasarlo, el error lo dice y la hoja sigue con lo demás.

### `tiradas`

- **Las tiradas del sistema**: característica, salvación, habilidad, ataque, daño…
  - Cada una con su fórmula (`1d20 + @este.total`) y sus variantes.
  - Pueden ir contra un objetivo (CD o CA).
  - Pueden tener franjas de resultado (crítico, éxito, fallo, pifia…).
  - Pueden ir por cada elemento de un conjunto o de una lista («una por habilidad»). Una fila de una lista se
    nombra por su id, no por su sitio: reordenar no cambia a qué fila apunta.
- **Ventaja, desventaja y crítico, sobre la fórmula de dados ya leída**, no cambiando el texto. Hoy `1d20` dentro de
  `11d20` se rompería. Doblar los dados del crítico va en `@crisol/dice`, como la ventaja.
- **Los dados del sistema**:
  - la tirada por defecto (el d20 de 5e, el 2d6 de otro juego);
  - cuándo es crítico o pifia: el natural máximo del d20, tirar por debajo, los dobles, o nada.

  En una campaña con sistema, `rollDice` usa los suyos (ADR-0010 lo dejó para aquí).
- **Probar una tirada** con un documento de prueba (o en blanco), sin apuntarla: da la fórmula, el resultado, la franja
  y el desglose.
- **Para otros juegos** (2026-11-05, Enrique: «¿se podrá adaptar a Daggerheart y otro TTRPG?»):
  - tantos dados como diga un número: `dados(@competencia, 8)`, `dados(@accion, 6, "kh1")`;
  - cada dado en las franjas, `@dados` (los que cuentan, en orden): cuál de dos d12 es mayor
    (`@dados[0] > @dados[1]`), dobles (`@dados[0] == @dados[1]`) o cuántos seises (`count(@dados, 6)`); una lista se
    lee por su posición, desde 0;
  - modos que suman dados (`add: "1d6"`) o los restan (`add: "-1d6"`), además de los que cambian unos por otros.
  - Queda para cuando un juego lo pida: tirar dos veces la tirada entera y quedarse con la mayor («el mayor de estos
    dos»), que pide grupos en la notación de dados.

### `guardar`

- **El catálogo, en el código** (`packages/systems/catalog`), como las plantillas de serie (ADR-0009): de solo lectura,
  revisado y con su id fijo. En esta capacidad trae «En blanco»; el 5e llega con `srd-5e`.
- **Los de la cuenta, en la base de datos**, de la organización, como las plantillas propias. Pasan por `operation()`:
  quedan en el historial y se deshacen.
- **Copiar uno del catálogo**:
  - la copia es de la cuenta;
  - guarda de cuál salió y en qué versión;
  - no cambia sola cuando Crisol mejora el original.
- **Cada cambio sube la versión** del sistema. Lo que un cambio deje sin sitio no se borra: se marca y se conserva.
- **Bajar y subir**: un archivo JSON con el sistema y su contenido. Al subirlo, se valida entero; si algo falla, no se
  guarda nada y se dice qué.
- Hasta 50 sistemas por cuenta.

### `campana`

- **Cada campaña tiene un sistema o ninguno**. Sin sistema, los dados van como hoy.
- **Elegirlo al crearla y cambiarlo en sus ajustes**. Más adelante, una campaña con personajes no podrá cambiarlo sin
  convertirlos: eso llega con `personajes`.
- **Lo que el sistema deja elegir a la campaña**:
  - sus fuentes (SRD 5.1, SRD 5.2…);
  - el idioma del contenido, entre los suyos;
  - sus ajustes de campaña, por ejemplo qué métodos de características valen.
- Puede elegirlo el máster de la campaña o del mundo, entre los del catálogo y los de su cuenta.

### `interfaz`

- **«Sistemas», en Mis mundos**, junto a «Plantillas»: los del catálogo y los de la cuenta.
- **Acciones**: crear (en blanco o copiando otro), copiar, renombrar, borrar (si no lo usa ninguna campaña), bajar y
  subir.
- **En la campaña**: elegir el sistema, sus fuentes, su idioma y sus ajustes.

### `editor` (quitado el 2026-11-05)

- **El editor de un sistema, por secciones**, como el del Crisol actual:
  - general: nombre, resumen, fuente y licencia, idiomas;
  - tipos: cada uno con sus campos (clase, nombre, valor inicial, rango, ayuda, si es del máster) y sus derivados con
    su fórmula;
  - tiradas: fórmula, variantes, objetivo, franjas y por qué elementos va;
  - dados: la tirada por defecto y los críticos;
  - fuentes y ajustes de campaña;
  - avanzado: el documento entero en JSON, validado.
- **Las fórmulas, comprobadas al escribirlas**: el error dice qué y dónde, y `@` propone los nombres que existen.
- **Probar, al lado**: un documento de prueba de un tipo, con sus valores. Al cambiarlos, se ven los derivados con su
  desglose y se pueden tirar sus tiradas (sin apuntarlas).
- **Los problemas, en cada sección**, con un enlace a lo que falla.
- **Guardar** sube la versión y se deshace desde el historial. Los del catálogo se abren para leer, con «Copiar para
  cambiarlo».
- **Las claves no se cambian** una vez guardadas: se cambia el nombre. Quitar un campo avisa si algo lo usa.
- El contenido (las clases, los conjuros…) se ve contado por tipo. Editarlo uno a uno es del compendio (módulo 4); hasta
  entonces, con la IA o con el archivo.

### `ia`

- **Herramientas**:
  - `listar_sistemas` y `ver_sistema` (entero o por partes);
  - `crear_sistema` (desde cero, desde uno del catálogo o desde un archivo) y `cambiar_sistema` (cambios por ruta, todo o
    nada);
  - `validar_sistema`, `probar_formula` y `probar_tirada`;
  - `borrar_sistema`;
  - `cambiar_campana` admite el sistema y sus elecciones.
- **La documentación del formato sale del propio esquema**: cada parte lleva una descripción corta en español, como en
  el Crisol actual. La IA la lee en un recurso, con ejemplos (5e y uno de 2d6).
- Crear y cambiar son escrituras, y borrar se aprueba como borrar, según el modo de IA.
- Los textos de un sistema son datos, nunca órdenes para la IA.

### Interfaz

- Pantallas nuevas: «Sistemas» (la lista y el editor, con su panel para probar) y la elección del sistema en la
  campaña.
- Siguen las normas de `docs/diseno.md`. Los prototipos se hacen y se aprueban en el paso de diseño, antes del plan.
- Todo usable en el móvil y con el teclado; WCAG 2.1 AA.

## Pila

La de los módulos anteriores. Sin dependencias nuevas: el lenguaje de fórmulas es propio (sin `eval` ni
`new Function`).

## Comandos

Los del módulo 0 (`docs/specs/fundacion.md` § Comandos). No hay comandos nuevos.

## Estructura

```
packages/systems/                    El formato, las fórmulas, las tiradas del sistema y el catálogo (puro)
packages/systems/catalog/            Los sistemas de serie («En blanco»; el 5e, con srd-5e)
packages/contracts/src/systems.ts    Las acciones de sistemas
packages/db/src/schema/systems.ts    Los sistemas de la cuenta y la elección de cada campaña
apps/server/src/actions/systems.ts   Ver, crear, cambiar, validar, probar y elegir
apps/web/src/systems/                «Sistemas», su editor con el panel para probar y la elección en la campaña
```

## Estilo

El del módulo 0 (`docs/specs/fundacion.md` § Estilo).

## Pruebas

- **`packages/systems`**:
  - cada clase de campo y su validación;
  - cada error de fórmula, con su ruta;
  - los ciclos;
  - el desglose;
  - el presupuesto;
  - las tiradas con sus variantes, modos y franjas;
  - la ventaja y el crítico sobre la fórmula ya leída.
- **Con un sistema de verdad**: un 5e de prueba (unas características, habilidades, CA con armadura y un anillo) y uno
  de 2d6. También un fragmento de dnd5e convertido a mano, para ver que su manifiesto cabe en el nuestro.
- **Integración**, contra Postgres:
  - crear, copiar, cambiar, deshacer y borrar;
  - la campaña elige su sistema;
  - quien no es de la cuenta no ve sus sistemas;
  - `rollDice` con los críticos del sistema de la campaña.
- **MCP**: cada herramienta en cada modo de IA.
- **Web**: «Sistemas» (lista, subir con errores), el editor (cada sección, una fórmula mal escrita, probar) y la
  elección en la campaña.
- **E2E** (Playwright + axe): hacer un sistema en el editor, probarlo y elegirlo en una campaña.
- **Ritmo**: calcular todos los derivados de un personaje de 5e de nivel 20 (unos 300 campos y 100 objetos) y validar
  un sistema de 2 MB.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas, con TDD en cada porción.

## Límites

- **Siempre**:
  - las fórmulas, con el intérprete propio y su presupuesto;
  - validar en el servidor todo lo que entra, venga de la interfaz, de un archivo o de la IA;
  - textos de la interfaz por i18n;
  - todo en verde en local antes de subir (la CI gasta cuota: una vez tras muchos cambios).
- **Preguntar antes**: dependencias nuevas, cambiar `CONSTRAINTS.md`, contenido que no sea SRD ni propio.
- **Nunca**:
  - `eval` ni `new Function`;
  - código, textos ni datos de Foundry o de D&D Beyond en el repo (sala limpia);
  - tocar el Crisol actual (se lee, no se cambia);
  - nada de `research/` en el código.

## Criterios de éxito

1. **Desde claude.ai**, la IA crea un sistema de 2d6 + atributo, lo valida, prueba una tirada y una fórmula, y
   Enrique lo ve en «Sistemas».
2. **En el editor**, Enrique hace un sistema de 2d6 desde «En blanco»: un tipo, tres campos, un derivado y una
   tirada. Lo prueba al lado y lo elige en una campaña.
3. **Una errata no pasa**: una fórmula que nombra un campo que no existe, o una CA que depende de sí misma, no se
   guarda. El motivo y la ruta salen en el editor (al escribirla) y en la IA.
4. **Copiar «En blanco»** (o el 5e, cuando llegue), cambiarle una tirada y elegirlo en una campaña. Al tirar en esa
   campaña, los críticos son los del sistema.
5. **Bajar un sistema y subirlo en otra cuenta**: llega igual. Un archivo roto no guarda nada y dice por qué.
6. **El desglose**: con el 5e de prueba, la CA dice de dónde sale cada punto.
7. **Ritmo**:
   - todos los derivados de un personaje de nivel 20, en menos de 20 ms en el servidor;
   - validar un sistema de 2 MB, en menos de 500 ms (también en la web, mientras se edita);
   - comprobar una fórmula al escribirla, al momento (menos de 16 ms).
8. **Calidad**:
   - la CI en verde, sin supresiones nuevas;
   - axe sin fallos críticos ni graves;
   - todo con el teclado y en el móvil.

## Fuera de `sistemas`

- El sistema 5e y su contenido (SRD 5.1 y 5.2, en español y en inglés): `srd-5e`.
- Los personajes, el creador y subir de nivel: `personajes`.
- La hoja por bloques y las tiradas desde ella: `hoja`.
- Las pantallas del compendio y el contenido propio del mundo: módulo 4.
- Importar un sistema de Foundry y ejecutar su código: `foundry`, después del abogado.
- Editar el contenido uno a uno (clases, conjuros…): con el compendio (módulo 4).
- Los pasos del creador y de subir de nivel: su formato y su motor, con `personajes`.
- Los estados en la mesa, las criaturas y la mesa: módulos 4 y 6.

## Preguntas abiertas

Respondidas por Enrique (2026-11-04):

1. Hacer un sistema: **el editor visual ya**, en esta capacidad (no solo con la IA y el archivo).
2. Las fórmulas: **un lenguaje nuevo, con la forma de las de Foundry** (`@des.mod`, los dados en la misma fórmula), en
   lugar del del Crisol actual o uno de hoja de cálculo.
3. Una copia del catálogo **es tuya y no cambia sola**; se ve de cuál salió y en qué versión.
4. Los pasos del creador **van con `personajes`**: aquí solo su sitio en el formato.
5. Una campaña puede no tener sistema, y los dados van como hoy (la propuesta, que no cambió).
