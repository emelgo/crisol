# Plan: Módulo 3 — sistemas

Spec: `docs/specs/sistemas.md` (aprobada) · ADR-0011 (aceptado) · Mapa del módulo: `docs/specs/modulo-3.md` · Diseño:
lienzo «Crisol: sistemas» (aprobado; fuentes en `out/lienzo-sistemas/`) · Lo que hace el Crisol actual:
`docs/inventario-sistemas.md` · Tareas con detalle: `tasks/todo.md` · Fecha: 2026-11-04. Los planes anteriores están en
`tasks/fundacion/`, `tasks/wiki/`, `tasks/plantillas/` y `tasks/dados/`.

## Resumen

Se construye en cuatro fases, que siguen el mapa de la spec:
1. **El paquete puro**: el formato, las fórmulas y las tiradas, sin base de datos ni interfaz.
2. **El servidor**: los sistemas de la cuenta, bajar y subir, y la campaña con su sistema.
3. **La interfaz**: «Sistemas», la elección en la campaña y el editor con su panel para probar.
4. **La IA y el cierre.**

Cada tarea es una porción vertical, con sus pruebas. Todo va en la rama `modulo-3/sistemas`. Se comprueba en local y la
CI (cuota mensual) se pasa una sola vez, al final de la tanda. Entonces se fusiona y se despliega en staging.

Lo más arriesgado va pronto:
- **el lenguaje de fórmulas** (tareas 2 y 3): que compruebe nombres, tipos y ciclos al guardar, que dé el desglose y
  que calcule un personaje de 5e de nivel 20 en menos de 20 ms. Se mide antes de construir nada encima;
- **que el formato reciba lo de Foundry** (tarea 1): un fragmento con la forma de dnd5e, escrito por nosotros, tiene
  que caber en el formato.

## Decisiones de construcción

- **El paquete `@crisol/systems`** (`packages/systems`): el formato (zod), las fórmulas, las tiradas del sistema y el
  catálogo. Es puro: sin base de datos ni React, en la regla de límites de los paquetes de dominio. Depende de
  `@crisol/dice`. Lo usan:
  - el servidor, para validar, calcular y probar;
  - la web, para comprobar mientras se escribe y para «Probar»;
  - los contratos, para la forma de las acciones.
- **El formato**:
  - sus claves van en inglés, con la forma del manifiesto de Foundry: `id`, `name`, `version`, `format`, `types`
    (`actor` y `item`), `fields`, `rolls`, `dice`, `sources`, `packs`, `languages` y `settings`;
  - `sheet`, `creation` y `levelUp` se dejan sitio, con una forma mínima que comprueban `hoja` y `personajes`;
  - las claves de cada sistema (sus tipos, campos y tiradas), las que elija quien lo hace;
  - los textos son un texto o un `{ es, en }`.
- **Validar** devuelve problemas con:
  - la ruta, para la IA y el JSON (`types.personaje.fields.defensa.formula`);
  - dónde está, por sus nombres («Personaje › Defensa › Fórmula»), para el editor;
  - el motivo, en español;
  - su gravedad: error, que no deja guardar, o aviso, que no lo impide (lo desconocido se conserva).
- **Las fórmulas**: una gramática propia sobre la de `@crisol/dice`, más:
  - referencias `@a.b`;
  - las operaciones `+ - * / %`, las comparaciones, `&& || !` y `? :`;
  - las funciones de una tabla fija (`floor`, `ceil`, `round`, `abs`, `max`, `min` y unas pocas para listas y tablas).

  Se lee una vez a un árbol, se comprueba contra lo que hay en su tipo y se evalúa sin `eval`. Una fórmula con dados es
  una tirada: el servidor pone los valores y tira con `@crisol/dice`. El presupuesto es por documento entero.
- **El desglose**: cada valor derivado devuelve su valor y sus términos con su nombre, los bonos de los modificadores
  con su origen (de los objetos del documento que cumplen su condición, como «equipado») y el valor fijado a mano, si
  lo hay.
- **Las tiradas del sistema**:
  - cada una con su fórmula y sus variantes, por cada elemento con `@este`, contra un objetivo y con sus franjas;
  - los modos, como la ventaja, son cambios sobre el árbol de dados;
  - la tirada por defecto y los críticos (ninguno, el natural del d20, dobles o tirar por debajo) van en `dice`;
  - `@crisol/dice` gana la regla de críticos y doblar los dados del crítico.
- **La base de datos**, en la migración 0039:
  - `systems`, de la organización: nombre, versión (un entero que sube en cada cambio), de cuál salió (`basedOn`: id
    y versión), el documento en `jsonb` y `deletedAt`;
  - `system_content`: el contenido de cada sistema (tipo, clave, fuente y datos);
  - en `campaigns`, `system` (el id de uno del catálogo o el uuid de uno propio) y `systemChoices` (fuentes, idioma y
    ajustes).

  Los sistemas y su contenido pasan por `operation()`, como las plantillas propias.
- **Cambios a la vez**: `updateSystem` pide la versión que tenía quien lo cambia. Si otra pestaña o la IA lo cambiaron
  antes, devuelve un conflicto y no pisa nada.
- **Permisos**, como los de las plantillas:
  - `systems.read`: quien ve los archivos comunes;
  - `systems.write`: el propietario de la cuenta;
  - elegir el sistema de una campaña, con `campaign.rename` (el máster del mundo o de la campaña).

  Los jugadores no leen sistemas hasta `personajes`.
- **`rollDice`**: en una campaña con sistema, el crítico sale de su regla; sin sistema, como hoy. La ficha de dados
  propone su tirada por defecto.
- **La web** (`apps/web/src/systems/`):
  - «Sistemas» va en la barra fuera de los mundos, en `/sistemas` y `/sistemas/:id`;
  - el editor va por secciones, con «Probar» a la derecha (en el móvil, en una hoja);
  - las fórmulas se comprueban mientras se escriben, con `@` como un combobox accesible;
  - el JSON de «Avanzado» va en un área de texto con su validación, sin dependencias nuevas.
- **Las herramientas MCP**, con los nombres de la spec. La documentación del formato sale de las descripciones del
  esquema, con dos ejemplos: el 5e de prueba y Fronteras.
- **Sala limpia**: las pruebas con «forma de dnd5e» las escribimos nosotros, con texto del SRD o propio. No entra ningún
  archivo de Foundry ni de dnd5e.

## Tareas

| # | Tarea | Fase | Depende de | Tamaño |
|---|---|---|---|---|
| 1 | El paquete `@crisol/systems`: el formato, su validación y «En blanco» (riesgo) | Paquete | — | M |
| 2 | Las fórmulas: leerlas y comprobarlas (nombres, tipos, ciclos) (riesgo) | Paquete | 1 | M |
| 3 | Calcular un documento: derivados, desglose, modificadores y presupuesto; el ritmo (riesgo) | Paquete | 2 | M |
| 4 | Las tiradas del sistema y sus dados; críticos y doblar en `@crisol/dice` | Paquete | 3 | M |
| 5 | Los sistemas de la cuenta en el servidor: crear, copiar, cambiar, deshacer y borrar | Servidor | 1 | M |
| 6 | Bajar y subir un sistema, con su contenido | Servidor | 5 | S |
| 7 | La campaña con su sistema, y `rollDice` con sus críticos | Servidor | 4, 5 | M |
| 8 | «Sistemas» en Mis mundos: la lista, crear, copiar, subir y su ventana | Interfaz | 6 | M |
| 9 | La elección del sistema en la campaña | Interfaz | 7, 8 | S |
| 10 | El editor: sus partes, General y los tipos con sus campos y fórmulas | Interfaz | 2, 8 | L |
| 11 | El editor: «Probar» al lado, con el desglose y las tiradas de prueba | Interfaz | 4, 10 | M |
| 12 | El editor: Tiradas, Dados, Fuentes, Ajustes y Avanzado | Interfaz | 11 | M |
| 13 | La IA y el cierre | IA | 7, 12 | M |

### Puntos de control

1. **Tras las tareas 1 a 4**, en local: el paquete en verde, y apuntados el ritmo de calcular un nivel 20 y el de
   validar 2 MB.
2. **Tras las tareas 5 a 7**, en local: por la API, crear, copiar, deshacer, subir un archivo roto y elegir el sistema
   en una campaña, con sus críticos al tirar.
3. **Tras las tareas 8 y 9**, en local, con Enrique: la lista, crear, copiar, subir y elegir en una campaña.
4. **Tras las tareas 10 a 12**, en local, con Enrique: hacer Fronteras en el editor y probarlo (criterio 2).
5. **Final**, en staging, con Enrique: los criterios de éxito de la spec, también desde claude.ai.

## Riesgos

| Riesgo | Impacto | Qué se hace |
|---|---|---|
| El lenguaje de fórmulas no llega al ritmo o se complica | Alto | Va primero (tareas 2 y 3), con su prueba de ritmo. Se lee una vez y el árbol se guarda; si no basta, se pasa a funciones ya preparadas (sin `eval`) |
| El formato no recibe lo de Foundry | Medio | Un fragmento con la forma de dnd5e, escrito por nosotros, en las pruebas de la tarea 1 |
| Validar 2 MB mientras se edita frena la web | Medio | Se valida la parte que se cambia al momento y el sistema entero un poco después; si hace falta, en un worker, como la física de los dados |
| El editor es grande | Medio | Tres tareas (10 a 12), con los prototipos aprobados como guía |
| Dos pestañas (o la IA) cambian el mismo sistema | Medio | Se guarda con la versión que se tenía; si cambió, conflicto y no se pisa |
| Cambiar un sistema deja datos sin sitio | Bajo | Se conservan y se marcan; con `personajes`, su conversión |
| Un archivo enorme o malicioso al subirlo | Bajo | Hasta 2 MB y 5.000 documentos; se valida entero con zod antes de guardar nada |

## Preguntas abiertas

Ninguna: lo que quedaba se resolvió al aprobar la spec y el diseño.
