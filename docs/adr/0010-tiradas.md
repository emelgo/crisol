# ADR-0010: Las tiradas se resuelven en el servidor y tienen su propio registro, fuera del historial

Estado: aceptada con la spec de `dados` del módulo 3 (Enrique, 2026-11-04: «ok») · `docs/specs/dados.md`

## Contexto

En una campaña tiran el máster, sus jugadores y la IA del máster. La tirada la ve toda la campaña o solo algunos:
- «para mí»: quien tira y el máster;
- «al máster»: quien tira y el máster, marcada para él;
- «oculta»: solo el máster.

Los demás no deben saber ni que hubo una. Todo lo que cambia datos en Crisol pasa por `operation()` y queda en el
historial, que deshace (ADR-0001). Una tirada no es un cambio que se pueda deshacer: pasó.

## Decisión

- **El azar lo pone el servidor**: el criptográfico, sin sesgo. Ni la web ni la IA deciden un resultado; los dados 3D
  solo enseñan lo que dijo el servidor. La notación, la tirada y su desglose están en el paquete puro `@crisol/dice`,
  que la web usa solo para describir la fórmula mientras se escribe.
- **Cada tirada se guarda ya resuelta** en `dice_rolls`:
  - la campaña y su mundo, quién y si fue la IA;
  - la fórmula, su nombre y la visibilidad;
  - el resultado: el total, cada dado, el crítico o la pifia y el desglose.

  Una identidad `n` da el orden, porque dos tiradas pueden caer en el mismo instante.
- **Las tiradas no pasan por `operation()` ni salen en el historial**: el registro es su propia lista, que se lee de 50
  en 50 hacia atrás. Es la única tabla de dominio con esta excepción, y la regla de límites sigue valiendo: solo
  `packages/db` escribe en ella.
- **La visibilidad la decide el servidor, al leer y al avisar**. Permisos nuevos en la capa de políticas:
  - `dice.roll` y `dice.read`: los miembros de la campaña y el máster de su mundo;
  - `dice.private`: el máster del mundo o de la campaña, que recibe las privadas.

  Los jugadores tiran «todos», «para mí» o «al máster»; el máster, «todos» u «oculta».
- **La IA tira con la cuenta del máster** (`ai` marcado). Su acción es de escritura (`write`), como en los modos de IA;
  por defecto tira en oculto, y en público solo si se le pide.
- **Un límite**: 60 tiradas por minuto y persona, contadas en la propia tabla, para que valga con varias instancias.
  Contar y guardar van en una transacción con un cerrojo por persona (`pg_advisory_xact_lock`): dos peticiones a la
  vez no se cuelan las dos. `tryDice`, que no guarda nada, tiene el suyo en memoria.
- **Tirar no espera al disco** (`synchronous_commit = off`, solo en esa transacción): si la base se cae, se pueden
  perder las tiradas de sus últimos 600 ms o así, pero nunca queda la base a medias. Para una tirada vale; para
  cualquier otra escritura, no.

## Consecuencias

- Nadie puede «deshacer» una tirada que no le gustó, como en una mesa de verdad.
- Las privadas no se filtran en la web: la web nunca las recibe si no puede verlas (lo comprueba `@fugas`).
- El registro crece con cada tirada. Leerlo va con su índice (campaña y orden); si un día pesa, se limpian las viejas.
- Las reglas de dados de cada sistema (la tirada por defecto, los críticos de otros juegos) llegan con `sistemas`, sobre
  este mismo camino.
