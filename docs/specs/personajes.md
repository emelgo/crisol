# Spec: personajes (módulo 3)

Estado: **borrador**, pendiente de Enrique. Cuarta capacidad del módulo 3 (`docs/specs/modulo-3.md`), después de
`srd-5e`. Lo que decidió Enrique, en `docs/modulos.md` § «#### `personajes` (entrevista con Enrique, 2026-11-05)». Los
estudios, en `research/dndbeyond/creador-y-hoja.md` (el creador y subir de nivel en D&D Beyond) y
`research/foundry/avances-y-tablas.md` (los avances de dnd5e y las tablas aleatorias de Foundry). La decisión de
arquitectura, en un ADR nuevo (ADR-0013, que se acepta con esta spec).

## Objetivo

Que los personajes de una campaña **se creen y suban de nivel en Crisol**, con un creador como el de D&D Beyond, para
cualquier sistema: el motor es común y **los pasos se escriben para cada sistema**, como parte de él. Lo que hay que
elegir lo dicen el contenido y lo que concede; lo demás se aplica solo. Cada personaje guarda **sus versiones**, una al
terminar de crearlo y otra en cada subida, y se vuelve a cualquiera desde su ficha. Y una pieza común: **las tablas
aleatorias**, que tiran el creador, el máster y la IA.

Para quién:

- **los jugadores**, que hacen sus personajes desde su cuenta (cada uno ve los suyos);
- **el máster**, que ve y cambia todos los de su campaña y también crea;
- **la IA**, que por el MCP hace un personaje entero con las mismas piezas que la pantalla.

### Historias

1. Como jugador, entro en la campaña y hago mi personaje: elijo su clase, su especie, su trasfondo y sus características,
   y lo que hay que elegir sale marcado con (!) donde toque, en el orden que quiera.
2. Como jugador, subo mi personaje de nivel cambiando el nivel de su clase; lo que gano sale solo y lo que hay que
   elegir, marcado. Puedo añadir otra clase, y la que no puedo tomar me dice por qué.
3. Como jugador o máster, veo las versiones de un personaje («Nivel 1», «Nivel 5») y vuelvo a una.
4. Como máster, veo y cambio los personajes de mi campaña y hago uno para un jugador.
5. Como máster, tiro en una tabla aleatoria (de un sistema o mía) y el resultado queda en el registro de la campaña.
6. Como IA, desde claude.ai, hago un personaje entero (o lo subo de nivel) con lo que decide el máster o el jugador.
7. Como IA, al hacer un sistema, escribo los pasos de su creador, y con ellos se hace un personaje.

## Mapa de capacidades

| Id | Qué hace | Depende de |
|---|---|---|
| `tablas` | Las tablas aleatorias como datos (del sistema y del mundo), su tirada en el servidor con su registro y lo sacado por campaña | `dados` |
| `personaje` | El personaje de una campaña: su dueño, lo que ve cada uno, sus elecciones y su contenido por referencia, la hoja calculada, su historial y sus versiones | `srd-5e` |
| `pasos` | El formato de los pasos del creador en un sistema (tipos neutros) y su motor puro: la lista de pasos y de lo pendiente, calculada siempre de las elecciones | `personaje`, `tablas` |
| `creador` | Las pantallas: crear y subir de nivel (como D&D Beyond), las versiones del personaje y tirar en una tabla | `pasos` |
| `ia` | Las herramientas MCP para hacer, subir y ver personajes, sus versiones y tirar en una tabla | `pasos`, `tablas` |

Orden: `tablas` → `personaje` → `pasos` → `creador` y `ia`. Lo arriesgado va antes: el motor de los pasos (puro y con
sus pruebas) se prueba con el 5e entero y con un sistema de otro juego antes de las pantallas.

## Requisitos

### `tablas`

- **Una tabla aleatoria es un dato**, con:
  - una fórmula de dados (sin ella, 1dN por los pesos de sus resultados);
  - sus resultados, con su rango (o su peso): un texto (que puede llevar tiradas, `2d6 po`), un enlace a una página o a
    un documento del contenido, u otra tabla (anidada, con un tope de profundidad y sin ciclos);
  - con o sin reemplazo (lo sacado no vuelve a salir hasta reiniciarla);
  - lo que Foundry resuelve con apaños, como opciones propias: sacar N, tirar en varias subtablas a la vez y la doble
    entrada.
- **Al guardar se valida**: los rangos cubren la fórmula sin huecos ni solapes; los enlaces existen; no hay ciclos.
- **Dónde viven**: en el contenido de un sistema (las del SRD: rasgos de personalidad, bagatelas, ideales) y en el
  mundo (las del máster), con lo que ve cada uno (las del máster, solo él).
- **La tirada, en el servidor**, como los dados: va al registro de tiradas de la campaña con su visibilidad (todos, solo
  yo, el máster, oculta), con el resultado y su tabla. Lo sacado de una tabla sin reemplazo se guarda **por campaña**.
- **Desde la wiki**: una tabla del mundo se ve y se tira desde su página; una tirada escrita en una página puede pedir
  una tabla (como `dice:`).

### `personaje`

- **El personaje es de una campaña**, con su dueño (un jugador, o el máster) y su sistema (el de la campaña, con su
  versión). Un jugador puede tener varios.
- **Lo que ve cada uno**: el jugador, solo los suyos (y los cambia); el máster, todos (y los cambia, también el dueño).
  Nada de un personaje llega a quien no puede verlo (lo comprueban las pruebas de fugas).
- **Las elecciones son la verdad y la hoja se calcula**: el personaje guarda sus datos base (nombre, puntuaciones de
  partida, notas), **sus elecciones** (por contenido, paso y nivel) y **el contenido que lleva por referencia** (su
  clave y su edición), no una copia. La hoja es `evaluate` sobre eso, con su desglose de dónde sale cada cosa.
  - Si el contenido cambia (otra versión del sistema), lo que ya no cuadra sale como pendiente (!), sin romperse.
  - Lo de la partida (PG gastados, recursos usados, objetos y su estado, notas) va aparte de las elecciones.
- **Se guarda al momento**, con su historial (y deshacer), y puede quedar a medias: un personaje «en creación» hasta
  tener lo que su sistema pide (en el 5e: clase, especie, trasfondo y características).
- **Versiones automáticas**: una al terminar de crearlo y otra al confirmar cada subida de nivel («Nivel 5», con su
  fecha), con el personaje entero de ese momento. Se ven y se **restauran** desde su ficha; restaurar es un cambio más
  del historial (se deshace). Sin versiones a mano.
- **Bajar de nivel** quita las elecciones de encima; quedan en la versión, y al volver a subir se proponen por defecto.

### `pasos`

- **Los pasos del creador son parte de cada sistema** (una sección nueva del formato), escritos por quien hace el
  sistema: los del 5e van de serie; los de los demás, la IA. Cada paso tiene su clave, su nombre, su ayuda y, si se
  dice, una condición (sale solo si se cumple) y si es solo de la creación.
- **Tipos neutros**, sin nada de un juego concreto:
  - **elegir del contenido**: uno o varios documentos de un tipo (clase, especie, trasfondo), con un filtro, y lo que
    conceden entra solo;
  - **generar puntuaciones** de un conjunto (las características): matriz fija, compra por puntos, dados (4d6 sin el
    menor, tirados en el servidor) o a mano, con los aumentos de lo elegido en otra columna;
  - **escribir datos** (nombre, alineamiento, notas);
  - **elegir de una lista** u **opción simple**;
  - **tirar en una tabla** para rellenar un campo (rasgos de personalidad);
  - **el equipo inicial**: elegir entre lo que ofrece lo elegido (A o B) o su dinero.
- **Lo pendiente se calcula siempre**, de los pasos del sistema y de lo que conceden los documentos elegidos a su nivel
  (las elecciones de sus `grants`: habilidades, subclase, dotes, estilos, conjuros): una lista de decisiones, cada una
  con sus opciones válidas y, la que no vale, su motivo.
  - Lo que no tiene nada que decidir (una sola opción, lo fijo) se aplica solo y se resume.
  - Cambiar algo de antes solo marca lo que depende de ello.
- **Requisitos como fórmulas**, con su motivo: los de una dote, los de la multiclase («Fuerza 13+») y el «solo la
  primera clase / solo multiclase»; se calculan sobre la hoja del momento.
- **Subir de nivel** es cambiar el nivel de una clase (o añadir otra): lo que concede ese nivel entra solo y lo que hay
  que elegir pasa a pendiente. Los PG de cada nivel, por la media o tirados en el servidor (lo elige la campaña).
- **Lo que el 5e necesita para esto, en su contenido**: los requisitos de multiclase de cada clase, el equipo inicial
  de cada clase y trasfondo como opciones, cuántos conjuros conoce o prepara cada clase por nivel, y sus tablas
  aleatorias del SRD.
- **Puro** (`packages/systems`): igual en el servidor y en la web, con el ritmo de `evaluate`.

### `creador`

- **Como el de D&D Beyond**, con el aspecto de Crisol (`docs/diseno.md`):
  - una cabecera con el nombre y la barra de pasos, con navegación libre y lo pendiente marcado con (!);
  - cada paso con «elegir» (la lista, con lo no disponible y su motivo) y «gestionar» (lo elegido, con sus elecciones);
  - el paso de clase con el nivel de cada clase, «añadir otra clase» y los rasgos por nivel con sus elecciones;
  - las características con su método y el cálculo de cada una a la vista;
  - un resumen al final y el paso a la ficha.
- **Las versiones del personaje**: su lista en la ficha, ver cómo era y restaurar.
- **Tirar en una tabla**: desde su página de la wiki o desde un paso, con el resultado a la vista.
- La ficha a la que se llega es la de siempre, mínima (los valores calculados); la hoja de verdad es `hoja`.
- Todo con el teclado y en el móvil, WCAG 2.1 AA. Se diseña y se aprueba antes del plan (prototipos que Enrique abre).

### `ia`

- **Herramientas**:
  - ver los personajes de una campaña y uno entero, con **su lista de decisiones pendientes y sus opciones**;
  - crear un personaje (con su dueño) y tomar decisiones, varias de una vez;
  - subir de nivel (una clase, a un nivel) y ver lo que trae;
  - ver sus versiones y restaurar una;
  - tirar en una tabla (`tirar_en_tabla`), y crear y cambiar tablas del mundo.
- **Lo que pide aprobación**, según el modo de IA del máster: crear, cambiar y restaurar personajes de otros (los de un
  jugador), como lo que ven los jugadores.
- **El formato**: `formato_sistemas` explica la sección de los pasos con ejemplos (el 5e y un juego de 2d6), validados.

## Pila

La de los módulos anteriores. Sin dependencias nuevas. Una migración de la base de datos (los personajes, sus
versiones, las tablas del mundo y lo sacado por campaña).

## Comandos

Los del módulo 0 (`docs/specs/fundacion.md` § Comandos).

## Estructura

```
packages/systems/src/               El formato de los pasos y su motor (pendiente, requisitos, aplicar), y las tablas
packages/systems/src/catalog/5e/    Los pasos del 5e y lo que su contenido necesita para el creador
packages/db/src/                    Los personajes, sus versiones, las tablas y lo sacado
packages/contracts/src/             Las acciones de los personajes y las tablas
apps/server/src/                    Sus acciones, sus permisos y sus herramientas MCP
apps/web/src/personajes/            El creador, las versiones y la ficha mínima
apps/web/src/tablas/                Ver y tirar una tabla
```

## Estilo

El del módulo 0 (`docs/specs/fundacion.md` § Estilo). Los pasos, en el JSON del sistema con las claves del formato en
inglés y las del sistema en español.

## Pruebas

- **`packages/systems`**: cada tipo de paso; lo pendiente (con lo concedido por nivel, las elecciones de los `grants` y
  lo automático); los requisitos con su motivo; subir y bajar de nivel; las tablas (sus rangos, sus anidadas, sin
  reemplazo, sacar N).
- **Los personajes de referencia, hechos con el creador**: los de `srd-5e` (la clase a un nivel con lo que concede),
  ahora a través de los pasos y las decisiones, dan lo mismo.
- **Un sistema de otro juego** (el de 2d6 de los ejemplos), con sus pasos escritos por la IA: se hace un personaje.
- **Integración**: crear, cambiar, subir, versiones y restaurar, con los permisos de cada uno; tirar en una tabla con su
  registro y lo sacado por campaña; las herramientas MCP en cada modo de IA.
- **Fugas**: un jugador no ve los personajes de otro, ni sus versiones, ni las tablas del máster.
- **Web**: el creador, las versiones y la tabla.
- **E2E** (Playwright + axe): un jugador hace su personaje de 5e de nivel 1 y lo sube a 5 con multiclase; el máster
  restaura una versión; el máster tira en una tabla.
- **Ritmo**: calcular lo pendiente de un personaje de nivel 20, en menos de 20 ms.
- Cobertura ≥ 80 % de las líneas nuevas o cambiadas, con TDD en cada porción.

## Límites

- **Siempre**: las tiradas, en el servidor; lo que ve cada uno, comprobado en el servidor; todo en verde en local antes
  de subir (la CI gasta cuota).
- **Preguntar antes**: dependencias nuevas, cambiar los límites del formato o `CONSTRAINTS.md`, y lo que no sea del SRD.
- **Nunca**: datos, textos ni código de D&D Beyond o Foundry; nada de `research/` en el código; la marca «D&D» en la
  interfaz.

## Criterios de éxito

1. **Un jugador** hace su personaje de 5e de nivel 1 con el creador y lo sube a 5 con multiclase; su hoja da lo que
   dicen las reglas (lo comprueban los personajes de referencia).
2. **Desde claude.ai**, la IA crea un personaje entero (con lo que le dice Enrique) y lo sube de nivel.
3. **Enrique vuelve a una versión anterior** de un personaje desde su ficha, y lo deshace.
4. **Enrique tira en una tabla** del SRD y en una suya, desde la wiki y desde la IA, y queda en el registro.
5. **Otro sistema**: la IA hace un juego de 2d6 con sus pasos, y con ellos se hace un personaje.
6. **Lo que ve cada uno**: un jugador solo ve los suyos (las pruebas de fugas, en verde).
7. **Calidad**: la CI en verde, sin supresiones nuevas; axe sin fallos críticos ni graves; todo con el teclado y en el
   móvil.

## Fuera de `personajes`

- La hoja por bloques, tirar desde ella, el inventario y los recursos en partida: `hoja`.
- Las pantallas del compendio y las colecciones de tablas: módulo 4.
- Pasar los PJ de Eana: al final, con el sistema de Fateforge que hará Enrique.
- Versiones a mano.
- Importar personajes de Foundry: `foundry`.

## Preguntas abiertas

Con su propuesta:

1. **Dónde viven las tablas del máster**: *propuesta*, en la wiki, como una pestaña «Tabla» de una página (como los
   mapas), con lo que ve cada uno de la página; las del sistema, en su contenido.
2. **Los PG al subir**: *propuesta*, lo elige la campaña (por defecto, la media); si se tiran, en el servidor y al
   registro.
3. **Los métodos de características**: *propuesta*, la campaña elige cuáles valen (por defecto, los cuatro; la compra,
   de 27 puntos).
4. **El equipo inicial**: *propuesta*, las opciones A o B (o el dinero) de cada clase y trasfondo del SRD, como datos
   del contenido, que se añaden en esta capacidad.
5. **Los conjuros**: *propuesta*, los conocidos o preparados se eligen en el creador, de la lista de la clase, con
   cuántos dice su tabla por nivel.
6. **Quién crea para quién**: *propuesta*, cada miembro de la campaña crea los suyos; el máster también para otro (y
   cambia el dueño). Sin límite de personajes por jugador.
