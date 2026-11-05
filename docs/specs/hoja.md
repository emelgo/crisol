# Spec: hoja (módulo 3)

Estado: **en marcha** (Enrique, 2026-11-05: «termina el módulo 3 de una vez»: sin entrevista aparte; lo abierto va
con las propuestas del estudio, marcadas abajo). Quinta capacidad del módulo 3 (`docs/specs/modulo-3.md`), después de
`personajes`. Estudio: `research/dndbeyond/creador-y-hoja.md` § «La hoja», «Tiradas desde la hoja», «Inventario y
recursos» y «Qué nos llevamos a Crisol». Lo que hace el Crisol actual: `docs/inventario-sistemas.md` § 5.

## Objetivo

Que en partida **se juegue con la hoja del personaje**: sus valores calculados (de `personajes`) con lo de la
partida encima (los PG, los usos gastados, lo que lleva y su estado), **tirar a un clic** desde cualquier número o
acción a nombre del personaje, al registro de la campaña, y descansar. La hoja la compone **cada sistema por bloques**;
la del 5e, al estilo de D&D Beyond con el aspecto de Crisol. Sin composición, una hoja por defecto sale de sus campos.

Para quién: el jugador con su personaje (y el máster con todos), en el ordenador y en el móvil; y la IA, que ve la
hoja, tira por el personaje, aplica daño o curación y descansa.

## Mapa

| Id | Qué hace | Depende de |
|---|---|---|
| `partida` | Lo de la partida encima de las elecciones: valores (PG, temporales, inspiración, notas), usos gastados y lo que lleva (del compendio, con cantidad, equipado y sintonizado); descansar | `personajes` |
| `bloques` | La sección `sheet` del formato: bloques neutros (cifras, conjunto, recurso, lista, objetos, acciones, usos, texto, pestañas, fila), validados; la hoja por defecto; la del 5e | `sistemas` |
| `tirar` | Tirar desde la hoja: las tiradas del sistema (una prueba, una salvación, una habilidad) y las acciones de lo que lleva (ataque, daño, curación), en el servidor y al registro, con ventaja, crítico y a quién | `dados` |
| `pantalla` | La hoja en la página del personaje (pestaña «Ficha»), con el panel de cada valor (su desglose) y el móvil (lo vital arriba, una sección cada vez) | las de arriba |
| `ia` | Ver la hoja, tirar por el personaje, daño y curación, descansar | las de arriba |

## Requisitos

- **Lo de la partida va aparte** de las elecciones (ADR-0013): `play` guarda los valores que cambian jugando (por la
  clave del campo), los usos gastados de cada recurso (por objeto) y lo que lleva (por su clave del contenido, con su
  id, su cantidad y su estado). La hoja es `evaluate` de las elecciones más eso. Solo se escribe jugando lo que el
  sistema marca con `play` (las monedas, la inspiración, las notas; en un campo de objetos, lo que se lleva) y los
  recursos, con su forma y sus límites; lo demás se rechaza (y lo guardado de antes que ya no vale se deja fuera).
- **Bloques neutros**, sin nada de un juego concreto: cada uno dice qué campos lee y qué se puede tirar. Los del 5e
  (identidad, franja vital, características, salvaciones, habilidades, acciones, usos, conjuros, inventario, rasgos,
  notas) son una composición de esos bloques en su sistema.
- **Tirar a un clic**, con su nombre («Thora · Atletismo»): el servidor calcula la fórmula con la hoja del momento y
  tira; queda en el registro de la campaña con su visibilidad. Ventaja y desventaja, y el crítico de los daños.
- **Daño y curación** a un recurso (los PG, con los temporales primero); **descansar** lo hace el servidor: recupera
  lo que dice cada recurso (corto, largo, al amanecer; lo que vuelve con dados, tirado) y llena los recursos del
  personaje: en el corto, los que llevan `recovery: short` (la magia de pacto); en el largo, todos.
- **El inventario**: añadir del compendio, quitar, cantidad, equipar y sintonizar (lo equipado entra en el cálculo).
- **Todo con el teclado y en el móvil**, WCAG 2.1 AA.

## Decisiones (propuestas del estudio, sin entrevista)

1. Componer la hoja: **la decide el sistema** (el máster no la reordena en su campaña, por ahora).
2. A quién va una tirada: **las de siempre** (`dados`): el jugador, todos, para mí y al máster; el máster, todos y oculta.
3. Ventaja: **la hoja la propone** cuando la sabe (los efectos de `evaluate`); el jugador elige.
4. El inventario del grupo: **después** (módulo 4), con el compendio del mundo.

## Pruebas

- `packages/systems`: los bloques (válidos y no), la hoja por defecto, lo de la partida en `evaluate`, descansar.
- Servidor: tirar por un personaje (fórmula con la hoja, al registro, permisos), daño y curación, el inventario.
- Web: la hoja del 5e (cifras, tirar, PG, usos, inventario) y la de un sistema sin composición.
- E2E: una jugadora tira Atletismo y un ataque desde la hoja, recibe daño, descansa y equipa un escudo (la CA sube).

## Fuera

La hoja en PDF e imprimible, el inventario del grupo, compañeros y monturas, y reordenar la hoja por campaña.
