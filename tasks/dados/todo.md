# Tareas: Módulo 3 — dados

Plan: `tasks/plan.md` · Spec: `docs/specs/dados.md` · ADR-0010 (en la tarea 2). Cada tarea: TDD → comprobación local →
commit en la rama de la tanda (`modulo-3/dados`) → «Dónde estamos» al día. La CI gasta cuota mensual: se sube y se pasa
una sola vez al final de la tanda; entonces merge y `scripts/desplegar-staging.sh`. Los puntos de control intermedios se
prueban en el servidor de desarrollo local, y lo que tenga que probar Enrique va a `tasks/probar.md`.

Comprobación local al acabar cada tarea:
`pnpm lint && pnpm typecheck && pnpm test`, y `pnpm e2e` si toca la interfaz. Cada vía nueva por la que salen datos
amplía `@fugas` en la misma tarea. Cobertura ≥ 80 % de lo cambiado (bloquea desde el 2026-11-12).

## Fase 1: Notación

- [x] **1. El paquete `@crisol/dice`** — hecha. La notación del Crisol actual, con nombres en inglés y los límites de la spec (200 caracteres, 100 dados, 1.000 caras, 100 explosiones).
  - Acepta:
    - la notación de la spec: dados, `d%` y `dF`; quedarse con los altos o los bajos y descartarlos; repetir y
      explotar; éxitos y fallos; aritmética con paréntesis; etiquetas y comentario;
    - la ventaja y la desventaja como funciones (con ventaja, con desventaja o sin ellas);
    - el crítico y la pifia del d20;
    - el resultado con cada dado y su desglose en texto;
    - la descripción en español;
    - los límites, con un error en español que dice dónde.
  - Comprueba: pruebas de cada parte con un azar fijo, y que `eval` y `new Function` no se usan (el intérprete es un
    árbol).
  - Archivos: `packages/dice/{package.json,tsconfig.json,vitest.config.ts}`, `packages/dice/src/{notation,roll,describe,index}.ts`
    (+ pruebas), `.dependency-cruiser.cjs`.

## Fase 2: Registro

- [x] **2. Tirar en el servidor y leer el registro (riesgo)** — hecha. El porqué de una fórmula que no vale va a la IA por el MCP (tarea 11); la web lo calcula al escribirla.
  - Acepta:
    - la tabla `dice_rolls` (migración 0037) y su repositorio;
    - los permisos `dice.roll`, `dice.read` y `dice.private`;
    - las acciones `rollDice` (campaña, fórmula, visibilidad) y `listRolls` (campaña, de 50 en 50 hacia atrás), con el
      azar de `crypto` y la visibilidad filtrada al leer;
    - cada visibilidad solo la usa quien puede (jugadores: todos, para mí, al máster; máster: todos, oculta);
    - el ADR-0010.
  - Comprueba: integración con el máster, dos jugadoras y alguien de fuera (qué recibe cada uno al leer, quién puede
    tirar y con qué visibilidad).
  - Archivos: `packages/db/src/schema/dice.ts`, `packages/db/drizzle/0037_tiradas.sql`, `packages/db/src/repos/dice.ts`,
    `packages/domain/src/policy.ts`, `packages/contracts/src/dice.ts`, `apps/server/src/actions/dice.ts`,
    `docs/adr/0010-tiradas.md`.

- [x] **3. En vivo, la prueba de fugas y el límite (riesgo)** — hecha. Las tiradas llegan enteras por el canal (las demás cosas solo avisan), a quien las puede ver y una sola vez.
  - Acepta:
    - el mensaje `rolled`, que llega a quien puede ver la tirada y a nadie más;
    - como mucho 60 tiradas por minuto y persona (`429` después);
    - `@fugas`: una jugadora no recibe las privadas de otra ni las ocultas del máster, por la API ni por el WebSocket.
  - Comprueba: integración del tiempo real (quién recibe cada visibilidad) y `pnpm e2e:fugas`.
  - Archivos: `packages/contracts/src/realtime.ts`, `apps/server/src/actions/dice.ts`, `apps/server/src/realtime/events.ts`,
    `e2e/tests/fugas.spec.ts`.

### Punto de control 1

- [x] En local: el máster y una jugadora por la API; `@fugas` en verde (con pruebas: integración del tiempo real y `@fugas`).

## Fase 3: La ficha de dados

- [x] **4. La ficha de dados: abrirla y tirar** — hecha. La ficha va fija a la derecha (encima del panel de la página), y la visibilidad son radios de verdad (las flechas del teclado van solas).
  - Acepta:
    - «Dados» en la barra del mundo y en la página de la campaña abre y cierra la ficha en el sitio del panel; la
      campaña elegida se recuerda por mundo (con varias, un selector);
    - la fórmula con su descripción mientras se escribe y su error; los dados rápidos; ventaja y desventaja; la
      visibilidad que puede usar cada uno; Intro o «Tirar»;
    - el paso de la barra en el tutorial guiado del mundo y el tutorial propio de la ficha.
  - Comprueba: pruebas de componentes (teclado, ARIA, el error) y e2e (tirar y ver el total).
  - Archivos: `apps/web/src/dice/{panel,composer}.tsx` (+ CSS), `apps/web/src/components/ribbon.tsx`,
    `apps/web/src/routes/campaign.tsx`, `apps/web/src/i18n.ts`, `e2e/tests/dados.spec.ts`.

- [x] **5. El registro en la ficha** — hecha. Lo tuyo sale como «Tú» (por el nombre de usuario, que es único); «Repetir» tira lo mismo, con la misma visibilidad si es tuya y se puede.
  - Acepta:
    - las tiradas en el orden en que se hicieron, la última abajo, con quién, cuándo, la fórmula, el total, el crítico
      o la pifia y las marcas de las privadas;
    - en vivo; el desglose al desplegar; «Repetir»; las anteriores al subir (de 50 en 50);
    - el total de cada tirada nueva se anuncia a los lectores de pantalla.
  - Comprueba: pruebas de componentes y e2e con el máster y una jugadora en dos pestañas (la pública le llega al
    momento; la «al máster» solo al máster), con axe.
  - Archivos: `apps/web/src/dice/log.tsx` (+ CSS), `apps/web/src/realtime/context.tsx`, `apps/web/src/api/fake.ts`,
    `e2e/tests/dados.spec.ts`.

- [x] **6. El color de los dados y el móvil** — hecha. El color va en la cuenta (migración 0038, con «ver caer los de los demás» para la tarea 8) y solo vale si es un #rrggbb; en el móvil, la hoja con su asa y la página oscurecida (pulsar fuera la cierra).
  - Acepta:
    - el color de cada cuenta en el perfil (sin elegir, uno de la paleta según la cuenta), y en el registro;
    - en el móvil, la ficha es una hoja que sube desde abajo, con su asa, y «Dados» está en el menú de la llama.
  - Comprueba: pruebas de componentes y e2e en móvil, con axe.
  - Archivos: `apps/server/src/auth/auth.ts`, `apps/web/src/routes/profile.tsx`, `apps/web/src/dice/panel.tsx`,
    `apps/web/src/components/ribbon.tsx`.

### Punto de control 2

- [ ] En local, Enrique y una jugadora en dos navegadores: públicas, privadas y ocultas en el registro.

## Fase 4: Los dados 3D

- [x] **7. Prototipo de los dados 3D (riesgo)** — hecha, sin plan B. Valores de la física probados con 30 tiradas de cada dado; si uno tarda más de 2 s en pararse, se enseña más deprisa. En el d4 se lee el vértice de arriba (el número de la cara de abajo). La página de prueba es la propia bandeja (tarea 8).
  - Acepta: con `three` y `cannon-es`, los siete dados (d4, d6, d8, d10, d%, d12, d20) y el dF caen con física y quedan en
    el resultado que se les da, en menos de 2 s. Si no se consigue, el plan B: el giro guionizado del lienzo.
  - Comprueba: pruebas de la numeración (qué cara queda arriba con cada resultado) y una página de prueba en local.
  - Archivos: `apps/web/src/dice/3d/{solids,numbering,throw}.ts` (+ pruebas), `apps/web/package.json`.

- [x] **8. La bandeja 3D** — hecha. La tirada entra en el registro al momento (no al pararse los dados: así se anuncia enseguida). Sin WebGL no caen dados y todo sigue igual. La escena va en su propio trozo (605 kB) y no se carga al arrancar.
  - Acepta:
    - los dados caen sobre la pantalla con el color de quien tira, y el crítico brilla;
    - las tiradas públicas de los demás también caen, salvo que se apague en la ficha (se guarda en la cuenta);
    - se cargan aparte, la primera vez; con más de 20 dados, caen los 20 primeros;
    - la animación, siempre entera.
  - Comprueba: pruebas de componentes, e2e (la bandeja aparece y la tirada entra en el registro al acabar) y que el
    arranque no carga `three`.
  - Archivos: `apps/web/src/dice/tray.tsx` (+ CSS), `apps/web/src/dice/3d/scene.ts`, `apps/web/src/dice/panel.tsx`.

### Punto de control 3

- [ ] En local, Enrique tira y ve caer los dados (y los de la jugadora, con su color).

## Fase 5: Las tiradas escritas

- [x] **9. La tirada en el texto: el nodo y su Markdown** — hecha. Su texto para buscar es el nombre y la fórmula.
  - Acepta: el nodo en línea `diceRoll` (fórmula y etiqueta) y `` `dice: 1d20+5 # Nombre` `` de ida y vuelta, también
    por la IA (`crear_paginas`, `editar_pagina`, `leer_pagina`) y al exportar.
  - Comprueba: pruebas del Markdown (ida y vuelta, junto a código en línea normal) e integración del MCP.
  - Archivos: `packages/editor/src/nodes/dice.ts`, `packages/editor/src/markdown/syntax.ts`, `packages/editor/src/schema.ts`.

- [x] **10. La tirada en la página** — hecha. Sin campañas tira con `tryDice` (el servidor, sin apuntar). La visibilidad elegida en la ficha la usan también las tiradas de las páginas. Elegida con el teclado abre su cuadro; con el ratón, el lápiz.
  - Acepta:
    - «/» → Tirada pone una y abre su cuadro (la tirada, con su descripción o su error, y el nombre); «Cambiar» al
      pasar por ella;
    - pulsarla tira en la campaña elegida en la ficha, con su visibilidad; si el mundo no tiene campañas, tira sin
      apuntar y lo dice;
    - una que no se entiende sale marcada y no tira.
  - Comprueba: pruebas de componentes y e2e (escribir `` `dice: 2d6+3` ``, pulsarla y verla en el registro), con axe.
  - Archivos: `apps/web/src/wiki/dice-roll.tsx` (+ CSS), `apps/web/src/wiki/slash-menu.tsx`, `apps/web/src/i18n.ts`,
    `e2e/tests/dados.spec.ts`.

## Fase 6: La IA y el cierre

- [x] **11. La IA y el cierre** — hecha
  - Acepta:
    - `tirar_dados` (con campaña, al registro, oculta por defecto; sin campaña, solo el resultado) y `ver_tiradas`; las
      instrucciones del MCP hablan de la notación y de las tiradas escritas;
    - tirar tarda menos de 50 ms en el servidor (p95);
    - `@fugas` también por el MCP;
    - las revisiones de código, seguridad y la web (con `web-design-guidelines`), con lo alto arreglado;
    - `docs/modulos.md`, `tasks/probar.md` y el catálogo, al día.
  - Comprueba: MCP en cada modo de IA, prueba de ritmo, `pnpm e2e`, `@fugas` y `@a11y`.
  - Archivos: `apps/server/src/mcp/tools.ts`, `apps/server/src/mcp/escala.integration.test.ts`, `e2e/tests/fugas.spec.ts`,
    `docs/modulos.md`, `tasks/probar.md`.

### Punto de control final

- [ ] En staging, con Enrique: los criterios de éxito de `docs/specs/dados.md`, también desde claude.ai.
