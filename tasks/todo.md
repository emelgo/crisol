# Tareas: srd-5e

Plan: `tasks/plan.md`. Spec: `docs/specs/srd-5e.md`. Cada tarea, con TDD y en una porción que funciona; al acabar,
`pnpm lint` entero, las pruebas de lo tocado y un commit.

## Fase 1: La mecánica

- [x] **1. El documento de contenido: concepto, mecánica y página** — hecha (`packages/systems/src/mechanics.ts`). En un efecto, los nombres son los de quien lo lleva, `@este` es el documento y `@ajustes`, los de la campaña
  - Acepta:
    - un documento de contenido lleva `concept`, `mechanics` (efectos, recursos, acciones, concesiones, escalado y
      grado de automatización) y `ref` (fuente y página);
    - las fuentes del sistema, su edición, su editorial, su fecha y su atribución;
    - validar dice cada problema de la mecánica por su ruta y sus nombres, como las fórmulas.
  - Comprueba: pruebas de cada parte nueva (válida y no válida); los fixtures de hoy siguen valiendo.
  - Archivos: `packages/systems/src/format.ts`, `file.ts`, `validate.ts` (+ pruebas).

- [x] **2. Los efectos al calcular** — hecha (`evaluate.ts`; pruebas en `effects.test.ts`). La base sustituye a la de siempre (con armadura, la suya) y, de varias, gana la mayor; el grado de competencia es un mínimo en su grado; `evaluate` devuelve las ventajas por tirada y lee `settings` para `@ajustes`
  - Acepta:
    - `evaluate` aplica los efectos de lo que lleva (y de los estados activos) con sus operaciones, en su orden fijo
      (base, fijar, sumar, mínimo y máximo), con su condición;
    - el desglose dice cada efecto con su origen;
    - los bonos de hoy (`modifiers`) siguen dando lo mismo.
  - Comprueba: pruebas de cada operación y del orden; la CA con armadura, sin armadura y con Defensa sin armadura;
    un objeto sin sintonizar no da nada; el ritmo de nivel 20.
  - Archivos: `packages/systems/src/evaluate.ts`, `formulas/system.ts` (+ pruebas, `ritmo.test.ts`).

- [x] **3. Recursos, tiradas por objeto y escalado** — hecha (`actions.ts`, `rolls.ts`, `evaluate.ts`; pruebas en `actions.test.ts`). Los recursos salen en `evaluate(...).resources`, con lo gastado en `uses` del objeto (o del documento, en una criatura); `rollsOf` recibe el documento para las tiradas por objeto; `prepareAction`, `tryAction` y `actionsOf` arman y tiran las acciones de un documento, con su escalado (`by`, `action` y `parts`, nuevos) y el crítico. Queda para la tarea 4: `ajustes` como nombre reservado y `@ajustes` en las fórmulas del sistema
  - Acepta:
    - los recursos que da un objeto o un rasgo, con su máximo y cómo se recuperan, en lo calculado;
    - una tirada `for: { items }` sale por cada objeto que lleve, con `@este` como el objeto;
    - un conjuro se tira a un nivel de espacio, con su escalado (por espacio o por nivel del personaje).
  - Comprueba: pruebas de cada recurso, la tirada de cada arma y Bola de fuego a nivel 3 y 5.
  - Archivos: `packages/systems/src/rolls.ts`, `evaluate.ts`, `format.ts` (+ pruebas).

- [x] **4. Conceptos, ediciones y ajustes** — hecha (`content.ts`, `choices.ts`; pruebas en `content.test.ts`). `visibleContent` dice lo que se ve con las fuentes activas y `duplicates` (nuevo en lo que elige la campaña: `newest`, por defecto, o `both`), con «Legado» cuando la versión de otra edición más nueva también se ve; `resolveConcept` resuelve por tipo y concepto con la edición de quien pide; `@ajustes` vale en todas las fórmulas del sistema y `ajustes` es un nombre reservado
  - Acepta:
    - una función pura dice qué contenido se ve con lo que eligió la campaña (ediciones y «lo que está en las dos»),
      con «Legado» en lo de 2014 que tiene versión de 2024;
    - las referencias por concepto se resuelven con la edición que toca;
    - las fórmulas leen los ajustes de la campaña (`@ajustes`).
  - Comprueba: pruebas de cada combinación de ediciones y de cada referencia.
  - Archivos: `packages/systems/src/content.ts` (nuevo), `choices.ts`, `evaluate.ts` (+ pruebas).

### Punto de control 1

- [x] Hecho (`fixtures/dificiles.ts`, `dificiles.test.ts`): además, la ventaja y la desventaja de los efectos se aplican solas en la tirada (el modo con `gives`), el daño dice su media y lo que concede un concepto puede decir su tipo. Los casos difíciles, escritos a mano en un fixture, dan lo que deben: Defensa sin armadura del monje, Bola de fuego
  a nivel 3 y 5, Escudo como reacción, el Anillo de protección sintonizado, la Furia activa y un dragón con sus acciones.
  El ritmo, en verde.

## Fase 2: Un 5e de punta a punta

- [x] **5. El sistema 5e** — hecho (`catalog/5e/system.ts`; pruebas en `catalog/5e/system.test.ts`), con lo que pedía al motor: los valores de cada elemento de un conjunto, `@portador`, `first()` y las listas con opciones (tipos de daño, propiedades). Las clases suman al personaje con efectos (sus salvaciones, sus competencias, su nivel de lanzador, la magia de pacto); las distancias van en pies y los pesos en libras (enseñarlos en metros y kilos en español, con la hoja)
  - Acepta: el 5e de serie (id `5e`), con sus tipos y campos, sus fórmulas, sus tiradas, sus fuentes (SRD 5.1 y 5.2.1,
    con su atribución) y sus ajustes (las reglas de 2014 o de 2024, la multiclase mixta), en los dos idiomas.
  - Comprueba: valida; con un personaje escrito a mano, sus características, competencia, salvaciones, habilidades,
    CA, PG, iniciativa, pasiva y lanzamiento de conjuros.
  - Archivos: `packages/systems/src/catalog/5e/system.ts` (nuevo), `catalog/index.ts` (+ pruebas).

- [x] **6. El contenido de serie y las acciones para buscarlo** — hecha: `@crisol/systems/catalog/content` (JSON en `catalog/5e/content/`, que solo lee el servidor; la web tiene prohibido importarlo en `biome.json`), `searchSystemContent` y `getSystemContent`, y copiar, bajar y subir con el concepto, la mecánica y la página (migración 0040). Para empezar, cuatro documentos escritos a mano (la espada larga y la cota de malla de las dos ediciones), que la tarea 7 saca ya con los scripts
  - Acepta:
    - el contenido de los sistemas de serie, en una entrada aparte del paquete que solo usa el servidor;
    - las acciones para buscar en el contenido (por tipo, nombre, edición e idioma) y leer unos documentos;
    - copiar o bajar el 5e lleva su contenido.
  - Comprueba: pruebas de integración (buscar, leer, copiar, bajar) y que la web no lo empaqueta.
  - Archivos: `packages/contracts/src/systems.ts`, `apps/server/src/actions/systems.ts`, `packages/systems/package.json`,
    `apps/web/src/api/fake.ts` (+ pruebas).

- [ ] **7. Sacar el contenido: el equipo y el Guerrero** — en marcha. Hecho: los scripts (`scripts/srd/`: el texto por columnas con `pdftotext -bbox`, las tablas, el texto de las clases y el emparejado con sus listas revisadas), las armas, las armaduras, el equipo de aventurero y las herramientas de 2014, y el guerrero de las dos ediciones (con el campeón; el de nivel 5 hecho con el contenido da CA 16, PG 44 y +6). Falta: de 2024, las tablas de munición, canalizadores y símbolos sagrados y las herramientas; las monturas y vehículos de las dos ediciones y las mercancías de 2014; la descripción de cada objeto
  - Acepta:
    - los scripts de `scripts/srd/` sacan el texto normalizado de los cuatro PDF y emparejan inglés y español;
    - el equipo (armas con su maestría, armaduras, objetos, herramientas) y el Guerrero de las dos ediciones, con su
      mecánica y su página;
    - `comprobar.ts` cuenta lo sacado contra lo medido.
  - Comprueba: todo valida, los dos idiomas en cada documento y las cuentas cuadran.
  - Archivos: `scripts/srd/{extraer,comprobar,texto}.ts`, `packages/systems/src/catalog/5e/{equipo,clases}.json`
    (+ pruebas).

- [-] **8. «Probar»: añadir del contenido** — quitada: el editor de sistemas, con su «Probar», se quita entero al acabar
  `srd-5e` (Enrique, 2026-11-04; `docs/diseno.md`). Probar con el contenido va en la tarea 10, con la IA.

- [ ] **9. La campaña: ediciones, lo repetido, reglas y multiclase**
  - Acepta, como en el diseño aprobado: las ediciones, «Lo que está en las dos», las reglas generales, la multiclase
    mixta y la muestra de lo que se ve; se guarda en la campaña y la IA lo respeta al buscar y al probar.
  - Comprueba: pruebas de la web, de integración y e2e con axe (criterio 5).
  - Archivos: `apps/web/src/systems/campaign-system.tsx` (+ CSS, pruebas), `packages/systems/src/choices.ts`,
    `packages/contracts/src/campaigns.ts`.

- [ ] **10. La IA: el contenido**
  - Acepta (Enrique, 2026-11-04: «cuando se cree un sistema, el MCP debe poder crear las automatizaciones también»):
    - crear, cambiar y borrar documentos del contenido de un sistema propio, con su mecánica (efectos, recursos,
      acciones, escalado, lo que concede), validados enteros y por su ruta, con su historial y en cada modo de IA;
    - la documentación del formato (`formato_sistemas`) explica el documento de contenido y su mecánica, con ejemplos
      de 5e y de un 2d6, para que la IA la escriba en cualquier sistema;
  - Acepta también: buscar y leer el contenido de un sistema; `probar_formula` y `probar_tirada` con documentos del contenido
    (una clase con su nivel, lo equipado, lo sintonizado, lo activo): lo calculado con su desglose, los recursos, las
    tiradas por cada objeto y las acciones (con su nivel); los textos del contenido, como datos.
  - Comprueba: cada herramienta en cada modo de IA; el guerrero de nivel 5 con cota de malla y espada larga da CA 16,
    PG 44 y un ataque de +6 (criterio 3); un conjuro por el MCP (criterio 4, con los conjuros de la tarea 12); `@fugas`.
  - Archivos: `apps/server/src/mcp/tools.ts`, `packages/contracts/src/systems.ts` (+ pruebas).

### Punto de control 2

- [ ] En local, Enrique, desde claude.ai: el guerrero de nivel 5 con la IA (criterio 3) y las ediciones de la campaña,
  en su muestra y en lo que encuentra la IA (criterio 5).

## Fase 3: El resto del contenido

Cada una: sacarlo con los scripts, escribir su mecánica, su página, los dos idiomas y sus pruebas (valida, cuenta,
referencias en las dos ediciones).

- [ ] **11. Los estados y el texto de las reglas** (las dos ediciones; los estados con sus efectos; las reglas que
  cambian, como ajustes).
- [ ] **12. Los conjuros de 2014** (319, con su ataque o su salvación, su daño en partes, su escalado y su duración).
- [ ] **13. Los conjuros de 2024** (339).
- [ ] **14. Los objetos mágicos** (unos 236 de 2014 y 254 de 2024, con sus efectos, su sintonía y sus cargas).
- [ ] **15. Las criaturas de 2014** (unas 317, con sus acciones como datos; sus fórmulas dan los valores del SRD).
- [ ] **16. Las criaturas de 2024** (unas 327).
- [ ] **17. Las especies, los trasfondos y las dotes** (las dos ediciones).
- [ ] **18. Las clases y subclases de 2014** (las 11 que faltan y sus subclases, con su progresión, sus rasgos y sus
  recursos).
- [ ] **19. Las clases y subclases de 2024** (ídem, con las maestrías de armas).

### Punto de control 4

- [ ] En local, Enrique: una muestra al azar de cada categoría (unos 20) contra el PDF, con su página al lado.

## Fase 4: Las referencias y el cierre

- [ ] **20. Los personajes de referencia**
  - Acepta: 96 personajes (cada clase en los niveles 1, 5, 11 y 20, en las dos ediciones) dan lo que dicen las tablas del
    SRD; unos 24, hechos a mano con su equipo, dan su CA, su ataque, su CD y sus PG. Lo que falle, arreglado.
  - Comprueba: sus pruebas; el ritmo (nivel 20 con todo, < 20 ms; buscar, < 100 ms).
  - Archivos: `packages/systems/src/catalog/5e/referencia/` (+ pruebas).

- [ ] **21. El cierre**
  - Acepta: las revisiones de código, seguridad e interfaz, con lo importante arreglado; la batería entera en verde;
    una pasada de la CI; PR; merge con `[skip ci]`; staging.
  - Comprueba: la batería (`pnpm test:coverage --concurrency=3`, lint, tipos, licencias, sala limpia, límites,
    cobertura de lo cambiado y `pnpm e2e`).

### Final

- [ ] En staging, con Enrique: los criterios de éxito de `docs/specs/srd-5e.md`, también desde claude.ai.
