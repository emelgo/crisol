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

- [x] **7. Sacar el contenido: el equipo y el Guerrero** — hecha (`scripts/srd/`: `node scripts/srd/extraer.ts` y `comprobar.ts`, con los PDF en `datos-locales/srd/`): las armas, las armaduras, el equipo de aventurero, las herramientas, las monturas, los arreos, los vehículos y las mercancías de las dos ediciones, con su texto donde el SRD lo tiene, y el guerrero con el campeón (474 documentos, en los dos idiomas y con su página). El texto de las tablas se corta por sus columnas (`pdftotext -bbox`); lo que no se empareja solo va en listas revisadas (`pares.ts`); la mecánica escrita a mano, en `mecanica.ts` y `guerrero.ts`
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

- [x] **9. La campaña: ediciones, lo repetido, reglas y multiclase** — hecha (`campaign-system.tsx`): las ediciones con sus fuentes, «Lo que está en las dos», los ajustes de pocas opciones en botones juntos (las reglas generales) con su ayuda, la muestra hecha con el contenido de verdad y la atribución; sin ninguna fuente no se guarda (tampoco en el servidor). La multiclase mixta sale siempre, como un ajuste más
  - Acepta, como en el diseño aprobado: las ediciones, «Lo que está en las dos», las reglas generales, la multiclase
    mixta y la muestra de lo que se ve; se guarda en la campaña y la IA lo respeta al buscar y al probar.
  - Comprueba: pruebas de la web, de integración y e2e con axe (criterio 5).
  - Archivos: `apps/web/src/systems/campaign-system.tsx` (+ CSS, pruebas), `packages/systems/src/choices.ts`,
    `packages/contracts/src/campaigns.ts`.

- [x] **10. La IA: el contenido** — hecha: `buscar_contenido` (con `campaignId`, lo que eligió la campaña), `leer_contenido`, `guardar_contenido` y `borrar_contenido` (con la versión del sistema, validados, con su historial; borrar pide aprobación también en copiloto) y `probar_accion`; en `probar_formula`, `probar_tirada` y `probar_accion`, documentos del contenido por su clave (con `from`, lo elegido y lo gastado); `formato_sistemas` explica el contenido y su mecánica con ejemplos de un 2d6 y de un 5e (validados). El guerrero de nivel 5 por la API: CA 16, PG 44, +6 y dos ataques
  - Archivos: `apps/server/src/mcp/tools.ts`, `packages/contracts/src/systems.ts` (+ pruebas).

### Punto de control 2

- [ ] En local, Enrique, desde claude.ai: el guerrero de nivel 5 con la IA (criterio 3) y las ediciones de la campaña,
  en su muestra y en lo que encuentra la IA (criterio 5).

## Fase 3: El resto del contenido

Cada una: sacarlo con los scripts, escribir su mecánica, su página, los dos idiomas y sus pruebas (valida, cuenta,
referencias en las dos ediciones).

- [x] **11. Los estados y el texto de las reglas** — hecha (`scripts/srd/estados.ts`, `capitulos.ts` y `reglas.ts`): los 15 estados de cada edición con su mecánica (desventajas en las tiradas, velocidad a 0, resistencias; el cansancio con lo de cada nivel según las reglas de la campaña: en 2014, por niveles; en 2024, −2 a las pruebas d20 y −5 pies por nivel), y 260 documentos de reglas (72 de 2014 y 188 de 2024: cada sección de los capítulos de reglas, con sus apartados, tablas y recuadros en Markdown, y las 140 entradas del glosario de 2024). El motor tiene una operación nueva, `mul` (multiplicar: la velocidad a la mitad). Las tablas de armas y armaduras no van en el texto (ya son contenido). Rarezas de maquetación conocidas: algún recuadro cae en la sección de al lado en un idioma
- [x] **12. Los conjuros de 2014** — hechos (`scripts/srd/conjuros.ts`): los 319, con su cabecera en los dos idiomas, sus clases (de las listas) y su mecánica sacada del texto en inglés (ataque o salvación, daño por partes, curación, escalado por espacio o por nivel en los trucos); los que cambian la hoja mientras duran (Armadura de mago, Escudo, Celeridad, Piel robliza…), con sus efectos escritos a mano. El conjuro tiene un campo nuevo, `mod` (su modificador para lanzar: el suyo, el de quien lo lanza o 0). Se emparejan por su firma (nivel, escuela, componentes, dados, alcance en metros y duración) y una lista revisada
- [x] **13. Los conjuros de 2024** — hechos, igual: los 339, con sus clases de la cabecera. Los dos con su concepto (por el nombre en inglés; Branding Smite y Feeblemind cambian de nombre); el Escudo, `conjuro_escudo` (el escudo ya es una armadura). 318 con acción y 340 solo texto
- [x] **14. Los objetos mágicos** — hechos (`scripts/srd/magicos.ts`): 238 de 2014 y 258 de 2024, con su categoría en los dos idiomas, su rareza, su sintonía y su mecánica sacada del texto (bonos a la CA y a las salvaciones, los brazales sin armadura, las características que fijan, las resistencias, las cargas con lo que recuperan al amanecer y lo que cura una poción): 128 con mecánica, los demás con su texto. Se emparejan por parecido dentro de su grupo (clase, rareza y sintonía: sus dados, sus números y el sustantivo de su nombre) y una lista revisada (los manuales y los tomos, que solo cambian de característica)
- [x] **15. Las criaturas de 2014** — hechas (`scripts/srd/criaturas.ts`): las 317 (los monstruos, las criaturas diversas y los PNJ), con su perfil entero como datos y como texto, y sus acciones con su ataque o su salvación, su daño por partes, su recarga, sus usos al día, su coste y las acciones legendarias como recurso. El bono de ataque, la CD y el daño, con la fórmula (competencia y modificador) que da lo del SRD; si ninguna lo da, el valor tal cual. Una prueba comprueba en todas que sus fórmulas dan lo de su perfil (salvaciones, habilidades, Percepción pasiva, iniciativa, ataques y CD): más de 4000 comprobaciones
- [x] **16. Las criaturas de 2024** — hechas, igual: las 330 (con los animales), con sus salvaciones de la tabla y su iniciativa (un campo nuevo del 5e, `bono_iniciativa`, lleva lo que suman aparte). Las de 2014 que en 2024 se llaman de otra forma (Goblin → Goblin Warrior, Thug → Tough…) comparten concepto
- [x] **17. Las especies, los trasfondos y las dotes** — hechas (`scripts/srd/origenes.ts`): en 2014, las 9 razas y sus 4 subrazas, el acólito y Apresador; en 2024, las 9 especies, los 4 trasfondos y las 17 dotes. Cada especie concede sus rasgos (125 documentos de tipo «rasgo», emparejados por una lista revisada: en 2024 cada idioma los ordena por orden alfabético) y una subraza, su especie; un trasfondo de 2024, sus habilidades y su dote de origen. Su mecánica, la clara: aumentos de característica (y elegir dos, el semielfo), velocidad, PG por nivel (la dureza enana), resistencias, habilidades, y las dotes Alerta, Tiro con arco, Defensa y Habilidoso
- [x] **18. Las clases y subclases de 2014** — hechas (`scripts/srd/rasgos.ts`): las 11 que faltaban, con su subclase del SRD. Sus rasgos salen solos del PDF (su título, su texto y su nivel, que en 2014 dice su texto: «At 3rd level», «By 7th level»), emparejados por su orden; la subclase es el último rasgo de cada clase. Escritos a mano: los datos de cada clase (dado de golpe, salvaciones, competencias, habilidades a elegir, la característica para lanzar y lo que suma al nivel de lanzador, también el medio lanzador y la magia de pacto) y la mecánica de los rasgos clave (la furia con sus usos, su daño, su ventaja y sus resistencias; la defensa sin armadura del bárbaro y del monje; el ataque adicional; el ki o la concentración, los puntos de hechicería, la inspiración bárdica, imponer las manos y el ataque furtivo que escala)
- [x] **19. Las clases y subclases de 2024** — hechas, igual: sus rasgos por su título («Level 3: Frenzy»), emparejados dentro de cada nivel por su parecido (cada idioma los ordena alfabéticamente) y los nombres comunes; las listas de conjuros y las opciones (invocaciones, metamagia), como rasgos sin nivel. 3170 documentos en total, que validan; una prueba hace un bárbaro de nivel 5 con su furia, el lanzamiento de un mago, un paladín y un brujo, y el ataque furtivo de un pícaro

### Punto de control 4

- [ ] En local, Enrique: una muestra al azar de cada categoría (unos 20) contra el PDF, con su página al lado. Lista:
  `tasks/muestra-srd-5e.md` (`node scripts/srd/muestra.ts`, siempre la misma); cómo, en `tasks/probar.md`.

## Fase 4: Las referencias y el cierre

- [x] **20. Los personajes de referencia** — hechos (`catalog/5e/referencia.ts` y su prueba): los 96 (las 12 clases a nivel 1, 5, 11 y 20, en las dos ediciones) dan lo de las tablas del SRD (nivel, competencia, PG, nivel de lanzador y espacios de cada nivel, ataques, furias, ki, puntos de hechicería, imponer las manos, magia de pacto y ataque furtivo), y los 24 hechos a mano con su equipo, su CA, su ataque, su CD y sus PG. Arreglado lo que falló (imponer las manos de 2024). El ritmo: un mago de nivel 20 con sus rasgos, 40 conjuros y equipo, unos 5 ms; buscar en todo el contenido, unos 15 ms
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
