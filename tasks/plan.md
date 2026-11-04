# Plan: Módulo 3 — srd-5e

Estado: **aprobado** por Enrique el 2026-11-04 («ok»). Spec: `docs/specs/srd-5e.md` (aprobada) · ADR-0012 (aceptado) · Mapa del módulo: `docs/specs/modulo-3.md` · Diseño:
fila 3 del lienzo «Crisol: sistemas» (aprobada; fuentes en `out/lienzo-sistemas/`) · Estudio:
`research/dndbeyond/contenido-5e-y-mecanica.md` · Tareas con detalle: `tasks/todo.md` · Fecha: 2026-11-04. Los planes
anteriores están en `tasks/fundacion/`, `tasks/wiki/`, `tasks/plantillas/`, `tasks/dados/` y `tasks/sistemas/`.

## Resumen

Se construye en cuatro fases:
1. **La mecánica**, en el paquete puro: efectos, recursos, acciones por objeto, escalado, conceptos y ediciones. Se
   prueba con los casos más difíciles escritos a mano, antes de sacar nada de los PDF.
2. **Un 5e de punta a punta, con poco contenido**: el sistema, su contenido de serie en el código, el equipo y el
   Guerrero de las dos ediciones; las ediciones en la campaña y la IA, que lo busca y lo prueba. Así se ve entero muy
   pronto (el guerrero de nivel 5), y el resto del contenido entra por un camino ya probado. (Sin «Probar»: el editor
   de sistemas se quita entero al acabar `srd-5e`; Enrique, 2026-11-04.)
3. **El resto del contenido, por categorías**: estados y reglas, conjuros, objetos mágicos, criaturas, especies,
   trasfondos y dotes, y las demás clases y subclases.
4. **Los personajes de referencia y el cierre.**

Todo va en la rama `modulo-3/srd-5e`. Se comprueba en local y la CI (cuota mensual) se pasa una sola vez, al final de la
tanda. Entonces se fusiona y se despliega en staging. Las tareas de contenido son las más largas del módulo: cada una
puede llevar más de una sesión.

## Decisiones de la arquitectura

- **El documento de contenido crece** (ADR-0012), además de su tipo, su clave, su fuente y sus valores:
  - `concept`: la clave que une sus versiones entre ediciones;
  - `mechanics`: sus efectos, recursos, acciones, lo que concede, su escalado y su grado de automatización;
  - `ref`: la página del PDF de la que sale.

  Las fuentes del sistema llevan su edición, su editorial, su fecha (para saber cuál es más nueva) y su atribución.
- **Los efectos sustituyen a los bonos de hoy** (`modifiers` del tipo), que pasan a ser un caso de los efectos: lo
  escrito sigue valiendo. Las operaciones:
  - base (la CA: gana la mayor de las que se apliquen);
  - fijar, sumar, mínimo y máximo;
  - grado de competencia;
  - ventaja y desventaja (se anotan para la tirada);
  - añadir a una lista.

  Se aplican en ese orden y salen en el desglose con su origen. La condición es una fórmula sobre el objeto y quien lo
  lleva.
- **Las tiradas por objeto**: una tirada del sistema puede ir «por cada objeto que lleve de estos tipos» (`for: { items
  }`), con `@este` como el objeto. Es el ataque de cada arma y de cada conjuro. Un conjuro se tira a un nivel de espacio
  (`level`), con su escalado.
- **Los ajustes de la campaña, en las fórmulas** (`@ajustes.reglas`), y una función pura que dice qué contenido se ve
  con lo que eligió la campaña (ediciones y «lo que está en las dos»), con la marca «Legado».
- **El contenido de serie, en el código, fuera de la web**: JSON por categorías en `packages/systems/src/catalog/5e/`,
  en una entrada aparte del paquete (`@crisol/systems/catalog/5e`) que solo importa el servidor. A la web llega por
  acciones nuevas (buscar en el contenido y leer unos documentos), no en su paquete.
- **Sacar el contenido, con scripts de desarrollo** (`scripts/srd/`): `pdftotext` de los cuatro PDF (en
  `datos-locales/srd/`), un analizador por categoría (los conjuros, las criaturas y los objetos tienen forma fija), el
  emparejamiento del inglés con el español por su orden y su nombre, y un borrador por documento. La IA ayuda a escribir
  la mecánica, que comprueban las pruebas. Lo sacado se guarda en el repositorio; los PDF, no.
- **Un documento por cosa, también los rasgos de clase**: una clase lleva su progresión (nivel, competencia, rasgos,
  recursos, espacios) y sus rasgos son documentos propios. Así ninguno pasa de los 64 KB.

## Fases y tareas

Detalle (acepta, comprueba, archivos) en `tasks/todo.md`.

### Fase 1: La mecánica

1. El documento de contenido: concepto, mecánica y página; las fuentes con su edición; su validación.
2. Los efectos al calcular: las operaciones, su orden, sus condiciones y su desglose.
3. Recursos, tiradas por objeto y escalado.
4. Conceptos, ediciones y ajustes: lo que se ve en una campaña y `@ajustes`.

**Punto de control 1**: los casos difíciles escritos a mano dan lo que deben, entre ellos Defensa sin armadura del
monje, Bola de fuego a nivel 3 y 5, Escudo como reacción, el Anillo de protección sintonizado, la Furia activa y un
dragón. Además, el ritmo.

### Fase 2: Un 5e de punta a punta

5. El sistema 5e: tipos, campos, fórmulas, tiradas, fuentes y ajustes.
6. El contenido de serie en el código y las acciones para buscarlo y leerlo; copiar el 5e lleva su contenido.
7. Los scripts para sacar el contenido, con el equipo y el Guerrero de las dos ediciones.
8. (Quitada: «Probar» con el contenido; el editor de sistemas se quita entero.)
9. La campaña: las ediciones, lo que está en las dos, las reglas y la multiclase.
10. La IA: buscar y leer el contenido, y probarlo con documentos del contenido.

**Punto de control 2** (Enrique, desde claude.ai): el guerrero de nivel 5 con la IA (criterio 3) y las ediciones de
la campaña (criterio 5).

### Fase 3: El resto del contenido

11. Los estados y el texto de las reglas, de las dos ediciones.
12. Los conjuros de 2014.
13. Los conjuros de 2024.
14. Los objetos mágicos de las dos ediciones.
15. Las criaturas de 2014.
16. Las criaturas de 2024.
17. Las especies, los trasfondos y las dotes.
18. Las clases y subclases de 2014.
19. Las clases y subclases de 2024.

**Punto de control 4** (Enrique, en local): una muestra al azar de cada categoría contra el PDF, con su página al lado.

### Fase 4: Las referencias y el cierre

20. Los personajes de referencia (96 de las tablas y unos 24 hechos a mano) y lo que haya que arreglar.
21. El cierre: revisiones, batería, una pasada de la CI, PR, merge con `[skip ci]` y staging.

**Final** (Enrique, en staging): los criterios de éxito de la spec, también desde claude.ai.

## Riesgos

| Riesgo | Impacto | Qué se hace |
|---|---|---|
| El texto de los PDF sale partido (dos columnas, guiones y espacios raros; el 5.1 inglés, palabra a palabra) | Alto | Normalizar antes; un analizador por categoría; la página en cada documento; contar contra lo medido |
| El modelo de la mecánica no llega para algún rasgo | Alto | Los casos más difíciles primero (punto de control 1); lo que no llegue, como texto con su grado declarado |
| Errores al escribir la mecánica de cientos de cosas | Alto | Las pruebas (validar, cada referencia en las dos ediciones, las criaturas contra sus valores del SRD, los personajes de referencia) y la muestra de Enrique |
| El español y el inglés no se emparejan | Medio | Por orden y por nombre, con una prueba que exige los dos idiomas en cada documento; los que no casen, a mano |
| El contenido pesa en la web | Medio | En una entrada aparte del paquete, solo en el servidor; a la web, por acciones y solo lo que se pide |
| Un documento pasa de 64 KB (una clase con todo) | Bajo | Los rasgos, como documentos propios |
| El ritmo con todo el contenido (efectos de muchos objetos) | Medio | El personaje de nivel 20 con su equipo en el ritmo de cada tarea; buscar con índice |

## Lo que no está en este plan

Lo que la spec deja fuera (el compendio, el creador, la hoja, el marketplace, Fateforge, Foundry y escalar una criatura).
