# Plan: Módulo 3 — dados

Spec: `docs/specs/dados.md` (aprobada) · Mapa del módulo: `docs/specs/modulo-3.md` · Diseño: lienzo «Crisol: dados»
(aprobado; fuentes en `out/lienzo-dados/`) · Tareas con detalle: `tasks/todo.md` · Fecha: 2026-11-04. Los planes
anteriores están en `tasks/fundacion/`, `tasks/wiki/` y `tasks/plantillas/`.

## Resumen

Se construye en cinco fases, que siguen el mapa de la spec: la notación, el registro en el servidor, la ficha de dados,
los dados 3D y las tiradas escritas, y la IA con el cierre. Cada tarea es una porción vertical, con sus datos, su API,
su interfaz, sus herramientas MCP y sus pruebas. Todo va en la rama `modulo-3/dados`; se comprueba en local y la CI
(cuota mensual) se pasa una sola vez, al final de la tanda. Entonces se fusiona y se despliega en staging.

Lo más arriesgado va pronto:
- **que nadie reciba una tirada que no puede ver** (tareas 2 y 3), con la prueba de fugas ampliada antes de hacer la
  interfaz;
- **que los dados 3D caigan en el resultado del servidor** (tarea 7), con un prototipo antes de la bandeja. Si la
  física no lo consigue a tiempo, queda el plan B del lienzo: un giro guionizado que acaba en la cara pedida, sin
  física.

## Decisiones de construcción

- **El paquete `@crisol/dice`** (`packages/dice`): la notación, el intérprete y la tirada, puros, sin base de datos ni
  React. Lo usan el servidor (para tirar) y la web (para describir la fórmula mientras se escribe; la web nunca tira).
  Entra en la regla de límites de los paquetes de dominio.
- **El azar**: la tirada recibe una función `random(caras)`. El servidor le pasa `crypto.randomInt`; las pruebas, una
  secuencia fija.
- **La tabla `dice_rolls`** (migración 0037):
  - campos: campaña, mundo, quién (`user_id`), si fue la IA, fórmula, etiqueta, resultado (`jsonb`: total, cada dado,
    crítico o pifia y el desglose), visibilidad y hora;
  - un índice por campaña y hora.

  **No pasa por `operation()`**: una tirada no se deshace, y el registro es su propia lista. Va en el **ADR-0010**
  (tiradas en el servidor y su registro, fuera del historial).
- **Visibilidad**, en el código `all`, `self` («para mí»), `master` («al máster») y `hidden` («oculta»).
  - Los jugadores usan `all`, `self` y `master`; el máster, `all` y `hidden`.
  - Quien tira y el máster ven las privadas; los demás no saben que existen.
- **Permisos nuevos** en la capa de políticas:
  - `dice.roll` y `dice.read`: los miembros de la campaña;
  - `dice.private`: el máster del mundo o de la campaña, que recibe las privadas.
- **En vivo**: el mensaje `rolled`, con la tirada ya filtrada.
  - Una pública va a quien tiene `dice.read` sobre la campaña.
  - Una privada va a quien tira y a quien tiene `dice.private` sobre la campaña.
- **El límite**: como mucho, 60 tiradas por minuto y persona. Se cuentan en la propia tabla, así vale con varias
  instancias.
- **El color de los dados y «ver caer los de los demás»**: dos campos nuevos de la cuenta, como el nombre y los
  apellidos. Sin elegir, el color sale de una paleta fija según la cuenta.
- **La web** (`apps/web/src/dice/`):
  - «Dados» en la barra del mundo y en la página de la campaña abre y cierra la ficha, en el sitio del panel;
  - la campaña elegida se recuerda por mundo;
  - en el móvil, la ficha es una hoja que sube desde abajo, con su asa.
- **Los dados 3D**: `three` y `cannon-es` (MIT, aprobadas), cargadas aparte la primera vez que se tira. La técnica:
  simular la tirada entera antes de enseñarla y poner los números de modo que la cara que queda arriba sea la del
  servidor; después se reproduce. Lo confirma el prototipo de la tarea 7.
- **La tirada en el texto**: un nodo en línea `diceRoll` (fórmula y etiqueta). En Markdown se escribe
  `` `dice: 1d20+5 # Nombre` ``, con su tokenizador antes del de código en línea. Pulsarla tira en la campaña elegida
  en la ficha de dados.
- **Textos**: por i18n. Los nombres de las visibilidades salen de la spec: «Todos», «Para mí», «Al máster», «Oculta».

## Tareas

| # | Tarea | Fase | Depende de | Tamaño |
|---|---|---|---|---|
| 1 | El paquete `@crisol/dice`: notación, tirada, descripción y límites | Notación | — | M |
| 2 | Tirar en el servidor y leer el registro, con su visibilidad (riesgo) | Registro | 1 | M |
| 3 | En vivo y la prueba de fugas; el límite por minuto (riesgo) | Registro | 2 | M |
| 4 | La ficha de dados: abrirla y tirar | Ficha | 3 | M |
| 5 | El registro en la ficha: en vivo, desglose, repetir y anterior | Ficha | 4 | M |
| 6 | El color de los dados en el perfil y en el móvil | Ficha | 5 | S |
| 7 | Prototipo de los dados 3D que caen en el resultado (riesgo) | 3D | 4 | M |
| 8 | La bandeja 3D: los dados de todos, el crítico y «ver caer los de los demás» | 3D | 6, 7 | M |
| 9 | La tirada en el texto: el nodo y su Markdown | Texto | 1 | S |
| 10 | La tirada en la página: «/», su cuadro y pulsarla | Texto | 5, 9 | M |
| 11 | La IA (`tirar_dados`, `ver_tiradas`) y el cierre | IA | 3, 10 | M |

### Puntos de control

1. Tras las tareas 2 y 3, en local: el máster y una jugadora por la API, y la prueba de fugas en verde.
2. Tras las tareas 4 a 6, en local, con Enrique: dos navegadores, tiradas públicas y privadas en el registro.
3. Tras las tareas 7 y 8, en local, con Enrique: los dados 3D.
4. Final, en staging, con Enrique: los criterios de éxito de la spec (también desde claude.ai).

## Riesgos

| Riesgo | Impacto | Qué se hace |
|---|---|---|
| Una privada llega a quien no debe | Alto | Se filtra en el servidor al leer y al avisar, con `@fugas` (API, WebSocket y MCP) en la tarea 3, antes de la interfaz |
| Los dados 3D no caen en el resultado | Medio | Prototipo en la tarea 7; plan B, el giro guionizado del lienzo |
| `three` pesa en el arranque | Medio | Se cargan aparte, solo al tirar; la compilación lo comprueba (aviso de trozos grandes) |
| `` `dice:` `` choca con el código en línea del Markdown | Bajo | Su tokenizador va antes; pruebas de ida y vuelta |
| Muchas tiradas a la vez (spam) | Bajo | 60 por minuto y persona, contadas en la tabla |
| El registro crece sin fin | Bajo | Se guarda todo; leerlo va de 50 en 50 con su índice. Si un día pesa, se limpia lo viejo (apuntado) |

## Preguntas abiertas

Ninguna: lo que quedaba se resolvió al aprobar la spec y el diseño.
