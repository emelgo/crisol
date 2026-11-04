# ADR-0011: Sistemas de reglas como datos, con fórmulas propias calculadas en el servidor

Estado: aceptada con la spec de `sistemas` (Enrique, 2026-11-04: «ok») · `docs/specs/sistemas.md`

## Contexto

El módulo 3 trae sistemas de reglas: de serie (5e, con el SRD 5.1 y el 5.2), los que haga cada cuenta y, más adelante,
los de Foundry. Enrique decidió:
- seguir el orden del estudio de Foundry: primero los sistemas de Crisol como datos con la forma de los de Foundry, y la
  capa que ejecuta su código solo después del abogado y de un prototipo;
- que Crisol trae un catálogo revisado y cada máster puede crear o subir el suyo;
- que la campaña elige su sistema.

Lo que dicen los estudios:
- **Foundry**: un sistema es código que corre en el navegador. El servidor no sabe calcular una CA ni validar un
  personaje.
- **El Crisol actual**: su sistema ya es datos (`sistema.json` con fórmulas seguras), pero:
  - las erratas de las fórmulas pasan;
  - los ciclos solo se ven al usarlo;
  - no hay desglose;
  - la ventaja cambia el texto de la fórmula.

## Decisión

- **Un sistema es un documento de datos**, validado con un esquema (zod) en el servidor y en la web. Su forma sigue la
  del manifiesto de Foundry (tipos por clase de documento, paquetes, idiomas), para que lo declarativo de un sistema
  suyo case uno a uno. No hay código de terceros: lo que un sistema calcula, lo dicen sus fórmulas.
- **Un paquete puro, `packages/systems`**: el formato, el lenguaje de fórmulas, las tiradas del sistema y el catálogo.
  Lo usan el servidor y la web por igual. Va en la regla de límites de los paquetes puros, como `@crisol/dice`.
- **Las fórmulas, un lenguaje nuevo con la forma de las de Foundry** (Enrique, 2026-11-04): los valores con `@` y los
  dados en la misma fórmula, sobre la gramática de `@crisol/dice`. Así las de los datos de dnd5e entran tal cual al
  importar. Un intérprete propio, sin `eval` ni `new Function`, con:
  - comprobación al guardar (nombres, tipos y ciclos);
  - un presupuesto por documento;
  - un resultado con desglose: los términos con su nombre y los bonos con su origen.
- **El servidor manda**: calcula los derivados, valida lo que se guarda y es lo que lee la IA. La web calcula lo mismo
  para que se vea al momento.
- **El catálogo, en el código**, con ids legibles y de solo lectura, como las plantillas de serie (ADR-0009). **Los de
  la cuenta, en la tabla `systems`**, de la organización:
  - el documento entero, en jsonb, con su versión;
  - de cuál salió y en qué versión;
  - su contenido, en una tabla aparte.

  Pasan por `operation()`, así que quedan en el historial y se deshacen.
- **La campaña apunta a su sistema** (`campaigns.system`: el id de uno del catálogo o el uuid de uno de la cuenta) y
  guarda sus elecciones: fuentes, idioma del contenido y ajustes.
- **Las tiradas del sistema se arman sobre la fórmula ya leída** de `@crisol/dice` (la ventaja y doblar los dados del
  crítico son transformaciones de su árbol). Los críticos del sistema de la campaña los aplica `rollDice`.

## Alternativas descartadas

- **Sistemas como código (JavaScript del máster o de terceros)**: haría falta aislarlo como a Foundry, el servidor no
  sabría calcular y la IA no podría leer los derivados. Queda para la capa de Foundry, con su propio ADR.
- **El lenguaje del Crisol actual**: pasaba el sistema de Eana sin reescribirlo, pero no casa con las fórmulas de
  Foundry y arrastra rarezas. El de Eana se reescribe al pasarlo con la IA.
- **Uno como el de una hoja de cálculo** (`SI(nivel >= 5; 2; 1)`): más familiar sin programar, pero habría que traducir
  cada fórmula de Foundry al importar.
- **Un lenguaje de expresiones de fuera** (JSONLogic, una librería de fórmulas): no da el desglose ni la comprobación de
  ciclos que queremos.
- **Calcular solo en la web**: es lo de Foundry. El servidor no podría validar y la IA tendría que repetir la cuenta.
- **Que una copia siga al original del catálogo**: cada mejora de Crisol cambiaría las campañas sin que el máster lo
  decida.
- **Guardar el sistema en cada campaña**: varias campañas de una cuenta comparten sistema, y cambiarlo en una no debe
  obligar a repetirlo en las demás.

## Consecuencias

- Las erratas de un sistema se ven al guardarlo, no en partida.
- La IA lee los valores ya calculados, con su desglose, sin saber las reglas.
- Lo que un sistema no pueda decir con fórmulas no lo hace. Si algún juego lo necesita, se amplía el lenguaje, no se
  abre la puerta al código.
- Mejorar un sistema del catálogo con una versión de Crisol puede pedir su migración, escrita en el código, como las de
  la base de datos.
- El documento se guarda como texto JSON, no en `jsonb`: `jsonb` reordena las claves, y en un sistema el orden (el de
  sus tipos, sus campos y sus tiradas) es el que se ve. Así queda tal cual también en el historial y al deshacer.
- Cada cambio guarda el documento entero en el historial (antes y después): con sistemas grandes, el historial crece.
  Si un día pesa, se poda lo viejo, como el resto del historial.
