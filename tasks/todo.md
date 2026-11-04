# Tareas: Módulo 3 — sistemas

Plan: `tasks/plan.md` · Spec: `docs/specs/sistemas.md` · ADR-0011. Cada tarea: TDD → comprobación local → commit en la
rama de la tanda (`modulo-3/sistemas`) → «Dónde estamos» al día. La CI gasta cuota mensual: se sube y se pasa una sola
vez al final de la tanda; entonces merge y `scripts/desplegar-staging.sh`. Los puntos de control intermedios se prueban
en el servidor de desarrollo local, y lo que tenga que probar Enrique va a `tasks/probar.md`.

Comprobación local al acabar cada tarea:
- `pnpm lint && pnpm typecheck && pnpm test`;
- `pnpm e2e` si toca la interfaz;
- la batería entera, con `pnpm test:coverage --concurrency=3` (con todo a la vez, la carga del VPS hace fallar pruebas
  lentas).

Cada vía nueva por la que salen datos amplía `@fugas` en la misma tarea. Cobertura ≥ 80 % de lo cambiado (bloquea desde
el 2026-11-12).

## Fase 1: El paquete

- [x] **1. El paquete `@crisol/systems`: el formato, su validación y «En blanco» (riesgo)** — hecha. Validar usa un esquema flexible (lo que se guarda, con lo desconocido) y otro estricto (solo para avisar de ello), y los mensajes de zod, cortos y en español.
  - Acepta:
    - el esquema del sistema (claves en inglés, con la forma del manifiesto de Foundry), con sus tipos de actor y de
      objeto;
    - las clases de campo:
      - las del módulo 2: texto, número, sí/no, lista, opciones, enlace y reloj;
      - las del juego: dados, recurso, grupo, lista de filas, conjunto y derivado;
    - los textos en uno o varios idiomas, y las fuentes, los paquetes de contenido y los ajustes de campaña;
    - el sitio de `sheet`, `creation` y `levelUp`;
    - los límites (2 MB, 500 campos por tipo, 5.000 documentos de hasta 64 KB);
    - `validateSystem` devuelve los problemas con ruta, dónde (por sus nombres), motivo y gravedad;
    - lo desconocido se conserva, con un aviso;
    - el catálogo trae «En blanco».
  - Comprueba:
    - pruebas de cada clase de campo y de cada problema;
    - Fronteras y un 5e de prueba validan;
    - un fragmento con la forma del manifiesto de dnd5e (escrito por nosotros) cabe en el formato;
    - el paquete no depende de React ni de la base de datos.
  - Archivos: `packages/systems/{package.json,tsconfig.json,vitest.config.ts}`,
    `packages/systems/src/{format,validate,catalog/blank,index}.ts` (+ pruebas y `fixtures/`), `.dependency-cruiser.cjs`.

- [x] **2. Las fórmulas: leerlas y comprobarlas (riesgo)** — hecha. Los dados se leen con `@crisol/dice` (un término reconocido por su forma), sin tocar su analizador; los modificadores van pegados al dado (`5d10>=8` cuenta éxitos; `2d6 >= 10` compara). El tipo de cada valor calculado se sabe en una primera pasada; los ciclos, con la ruta de cada paso.
  - Acepta:
    - la gramática de la spec: `@referencias`, dados (los de `@crisol/dice`), `+ - * / %`, comparaciones, `&& || !`,
      `? :` y las funciones de su tabla;
    - un error de sintaxis dice qué y dónde;
    - al comprobar un sistema, cada fórmula se mira contra los campos de su tipo:
      - una referencia que no existe da error, con una sugerencia («¿Quizás «@vigor»?»);
      - los tipos que no casan dan error;
      - las funciones que no existen dan error;
      - los ciclos entre derivados dan error, con la ruta de cada paso;
    - lo que una fórmula usa (sus referencias), para el `@` del editor;
    - sin `eval` ni `new Function`.
  - Comprueba: pruebas de cada parte de la gramática y de cada error, y una prueba que busca `eval` y `new Function` en
    el paquete.
  - Archivos: `packages/systems/src/formulas/{parse,check,functions}.ts` (+ pruebas), `packages/dice/src/notation.ts`
    (leer un término de dados desde otra gramática).

- [x] **3. Calcular un documento: derivados, desglose, modificadores y presupuesto (riesgo)** — hecha. Ritmo: un nivel 20 con 353 campos y 100 objetos, 5 ms de mediana (el límite es 20); validar 1,85 MB, 71 ms (el límite es 500). Un número guardado también puede recibir bonos (lo guardado más el bono, con su desglose).
  - Acepta:
    - `evaluate(system, type, data, items)` da cada derivado con su valor y su desglose:
      - los términos con su nombre;
      - los bonos de los modificadores con su origen y su condición;
      - el valor fijado a mano, si lo hay;
    - un presupuesto por documento: al pasarlo, ese valor dice el error y los demás siguen;
    - lo que no cuadra (un valor fuera de rango, de otra clase) se marca y se conserva.
  - Comprueba:
    - pruebas con el 5e de prueba: la CA con armadura y un anillo, y de dónde sale cada punto;
    - una prueba de ritmo: un personaje de nivel 20 (unos 300 campos y 100 objetos) en menos de 20 ms, y validar un
      sistema de 2 MB en menos de 500 ms.
  - Archivos: `packages/systems/src/{evaluate,modifiers}.ts` (+ pruebas y prueba de ritmo).

- [ ] **4. Las tiradas del sistema y sus dados**
  - Acepta:
    - las tiradas de la spec: fórmula y variantes, por cada elemento con `@este`, objetivo, franjas y modos;
    - los modos, sobre el árbol de dados, no sobre el texto: `1d20` dentro de `11d20` no se rompe;
    - en `dice`, la tirada por defecto y los críticos (ninguno, el natural del d20, dobles o tirar por debajo);
    - `@crisol/dice` gana `doubleDice` (el crítico de daño) y la regla de críticos;
    - `tryRoll` da la fórmula, el resultado, la franja y el desglose, con un azar que se le pasa.
  - Comprueba: pruebas de cada parte, con un azar fijo, en Fronteras y en el 5e de prueba.
  - Archivos: `packages/systems/src/rolls.ts`, `packages/dice/src/{roll,advantage}.ts` (+ pruebas).

### Punto de control 1

- [ ] En local: el paquete entero en verde, y el ritmo apuntado en «Dónde estamos».

## Fase 2: El servidor

- [ ] **5. Los sistemas de la cuenta en el servidor**
  - Acepta:
    - la migración 0039 con `systems` y `system_content`, que pasan por `operation()`;
    - los permisos `systems.read` y `systems.write`;
    - las acciones:
      - `listSystems` (los del catálogo y los de la cuenta);
      - `getSystem`;
      - `createSystem` (desde cero o copiando, guardando de cuál y en qué versión);
      - `updateSystem` (validado; con la versión que se tenía, o conflicto);
      - `deleteSystem` (a la papelera; no si lo usa una campaña);
    - deshacer desde el historial;
    - hasta 50 por cuenta.
  - Comprueba:
    - integración contra Postgres: crear, copiar, cambiar, el conflicto, deshacer y borrar;
    - quien no es de la cuenta no ve sus sistemas, y `@fugas` lo comprueba por la API;
    - un sistema con errores no se guarda.
  - Archivos: `packages/db/src/schema/systems.ts`, `packages/db/src/repos/systems.ts`, `packages/db/drizzle/0039_*`,
    `packages/domain/src/policy.ts`, `packages/contracts/src/systems.ts`, `apps/server/src/actions/systems.ts`
    (+ pruebas).

- [ ] **6. Bajar y subir un sistema, con su contenido**
  - Acepta:
    - `exportSystem` da el sistema y su contenido en un archivo JSON;
    - `importSystem` crea uno nuevo, o reemplaza uno propio, desde un archivo:
      - se valida entero antes de guardar nada;
      - si algo falla, no guarda nada y devuelve los problemas;
    - el contenido se cuenta por tipo.
  - Comprueba: integración con un archivo bueno, uno roto, uno demasiado grande y uno de otra versión del formato.
  - Archivos: `apps/server/src/actions/systems.ts`, `packages/db/src/repos/systems.ts`,
    `packages/contracts/src/systems.ts` (+ pruebas).

- [ ] **7. La campaña con su sistema**
  - Acepta:
    - `createCampaign` y `updateCampaign` admiten el sistema (del catálogo o de la cuenta del mundo, o ninguno) y sus
      elecciones (fuentes, idioma y ajustes), validadas contra lo que declara el sistema;
    - `rollDice` usa los críticos del sistema de la campaña;
    - la ficha de dados recibe su tirada por defecto;
    - borrar un sistema que usa una campaña lo impide y dice cuál.
  - Comprueba:
    - integración: elegir, cambiar y quitar;
    - un sistema de otra cuenta no vale;
    - Fronteras sin críticos y el 5e de prueba con el natural del d20 al tirar.
  - Archivos: `packages/db/src/schema/campaigns.ts`, `packages/contracts/src/campaigns.ts`,
    `apps/server/src/actions/{campaigns,dice}.ts` (+ pruebas).

### Punto de control 2

- [ ] En local, por la API: crear, copiar, deshacer, subir un archivo roto y elegir el sistema en una campaña.

## Fase 3: La interfaz

- [ ] **8. «Sistemas» en Mis mundos**
  - Acepta:
    - «Sistemas» en la barra fuera de los mundos (y en el menú de la llama del móvil);
    - la lista con los tuyos y los de serie, y la vista previa al pasar;
    - «Sistema nuevo» (desde cero, copiando otro o de un archivo, con sus problemas si está roto);
    - la ventana del engranaje: nombre, versión, bajar, en qué campañas está y la zona de peligro;
    - su tutorial guiado y su paso en el de Mis mundos.
  - Comprueba: pruebas de la web (lista, crear, copiar, subir roto, borrar en uso) y e2e con axe.
  - Archivos: `apps/web/src/systems/{screen,new,settings}.tsx` (+ CSS y pruebas), `apps/web/src/components/ribbon.tsx`,
    `apps/web/src/router.tsx`, `apps/web/src/i18n.ts`, `apps/web/src/api/fake.ts`, `e2e/tests/sistemas.spec.ts`.

- [ ] **9. La elección del sistema en la campaña**
  - Acepta:
    - en la ventana de la campaña y en «Nueva campaña», el sistema;
    - con él, sus fuentes, su idioma y sus ajustes;
    - «Guardar» y «Cancelar» solo si hay cambios;
    - «Abrir» lleva a su editor.
  - Comprueba: pruebas de la web y e2e (elegir Fronteras y ver que la ficha de dados propone 2d6).
  - Archivos: `apps/web/src/routes/campaigns.tsx`, `apps/web/src/systems/campaign-system.tsx` (+ pruebas),
    `e2e/tests/sistemas.spec.ts`.

- [ ] **10. El editor: sus partes, General y los tipos**
  - Acepta:
    - `/sistemas/:id` con sus partes a la izquierda y los problemas de cada una;
    - General;
    - los tipos y sus campos (clase, nombre, clave fija una vez guardada, valor inicial, rango, ayuda y si es del
      máster);
    - la fórmula de un derivado, comprobada al escribirla, con `@` que propone los nombres (un combobox con el teclado);
    - «Guardar» y «Cancelar» solo si hay cambios, y el conflicto si otro lo cambió;
    - los del catálogo, para leer, con «Copiar para cambiarlo»;
    - en el móvil, la parte en un selector y el campo en una hoja.
  - Comprueba:
    - pruebas de la web: cada clase de campo, una fórmula mal escrita, `@`, guardar, el conflicto y el catálogo de solo
      lectura;
    - e2e con axe, también en el móvil.
  - Archivos: `apps/web/src/systems/editor/{editor,parts,general,types,field,formula-input}.tsx` (+ CSS y pruebas).

- [ ] **11. El editor: «Probar» al lado**
  - Acepta:
    - un documento de prueba del tipo elegido, con sus valores y objetos de prueba (equipados o no);
    - los derivados con su desglose, al momento;
    - las tiradas del tipo, que se tiran con `tryDice` (sin apuntar), con su franja;
    - en el móvil, en una hoja.
  - Comprueba: pruebas de la web (cambiar un valor cambia el derivado; el escudo suma; tirar da franja) y e2e.
  - Archivos: `apps/web/src/systems/editor/try.tsx` (+ CSS y pruebas), `packages/contracts/src/dice.ts` (si `tryDice`
    necesita la fórmula ya armada).

- [ ] **12. El editor: Tiradas, Dados, Fuentes, Ajustes y Avanzado**
  - Acepta:
    - Tiradas: fórmula, por cada, objetivo, franjas y modos;
    - Dados: la tirada por defecto y los críticos;
    - Fuentes y Ajustes de campaña;
    - Avanzado:
      - el JSON con su validación, las líneas marcadas y la lista de problemas que llevan a cada uno;
      - bajar el sistema, o subir un archivo que lo reemplaza (si está roto, no se guarda nada).
  - Comprueba: pruebas de la web de cada parte y e2e (criterio 2: Fronteras desde «En blanco»).
  - Archivos: `apps/web/src/systems/editor/{rolls,dice,sources,settings,advanced}.tsx` (+ pruebas),
    `e2e/tests/sistemas.spec.ts`.

### Punto de control 3

- [ ] En local, Enrique: la lista, crear, copiar, subir un archivo roto y elegir el sistema en una campaña.

### Punto de control 4

- [ ] En local, Enrique: hacer Fronteras en el editor, probarlo al lado y elegirlo en una campaña.

## Fase 4: La IA y el cierre

- [ ] **13. La IA y el cierre**
  - Acepta:
    - las herramientas:
      - `listar_sistemas`, `ver_sistema` (entero o por partes), `crear_sistema` (desde cero, del catálogo o de un
        archivo), `cambiar_sistema` (cambios por ruta, todo o nada, con la versión), `validar_sistema`,
        `probar_formula`, `probar_tirada` y `borrar_sistema`;
      - `cambiar_campana` con el sistema;
    - el recurso con la documentación del formato, que sale del esquema, y sus dos ejemplos;
    - las instrucciones del MCP con lo de los sistemas;
    - los textos de un sistema, como datos.
  - Comprueba:
    - cada herramienta en cada modo de IA;
    - el criterio 1 por el MCP (crear un 2d6, validarlo y probarlo);
    - `@fugas` por el MCP;
    - la escala, con un sistema de 2 MB;
    - las revisiones de código, seguridad e interfaz;
    - la batería entera en verde, y la tanda a la CI una vez.
  - Archivos: `apps/server/src/mcp/tools.ts` (o su archivo de sistemas), `apps/server/src/mcp/server.ts`,
    `packages/systems/src/docs.ts` (+ pruebas), `e2e/tests/fugas.spec.ts`.

### Final

- [ ] En staging, con Enrique: los criterios de éxito de `docs/specs/sistemas.md`, también desde claude.ai.
