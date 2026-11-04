# Módulo 3: sistemas de reglas, fichas y dados

Mapa de capacidades, aprobado por Enrique el 2026-11-04 («vamos»). Cada capacidad tiene su spec en `docs/specs/<id>.md`
y su ciclo (diseño, plan, construcción y revisión), en este orden. Las decisiones del módulo, en `docs/modulos.md`
§ «### 3. Sistemas, fichas y dados»; los estudios, en `research/foundry/sistemas-y-su-api.md` y
`research/dndbeyond/creador-y-hoja.md`.

| Id | Qué hace | Depende de |
|---|---|---|
| `dados` | La notación de dados y la tirada en el servidor; el registro de tiradas de la campaña, en vivo, con las privadas; los dados 3D; las tiradas escritas en la wiki; la IA tira | — |
| `sistemas` | Un sistema como datos, con la forma del manifiesto de Foundry (tipos, campos, fórmulas seguras, tiradas, pasos del creador); el catálogo de Crisol y los sistemas propios de la cuenta; la campaña elige su sistema | `dados` |
| `srd-5e` | El sistema 5e de serie, con el SRD 5.1 y el 5.2 como fuentes que se mezclan, en español y en inglés, con su atribución | `sistemas` |
| `personajes` | El personaje de una campaña (su jugador y el máster), el creador por pasos, los métodos de características, subir de nivel y sus versiones | `srd-5e` |
| `hoja` | La hoja por bloques (la del sistema, recolocable por el máster; la de 5e, al estilo de D&D Beyond), las tiradas desde ella, los recursos, el inventario y el del grupo, el móvil | `personajes`, `dados` |
| `foundry` | Importar los datos de un sistema de Foundry filtrando por licencia y el prototipo de dnd5e en solo lectura, aislado. Después del abogado y de su ADR | `sistemas`, `hoja` |

Orden: `dados` → `sistemas` → `srd-5e` → `personajes` → `hoja` → `foundry`.

Lo que se dio por hecho al aprobarlo (Enrique no lo cambió):

1. Las tiradas se resuelven en el servidor; los dados 3D solo animan el resultado.
2. Las fórmulas de un sistema son un lenguaje seguro propio, sin ejecutar código, igual en el servidor y en la web.
3. Los personajes son de la campaña, no del mundo, y un jugador puede tener varios.
4. Cada jugador solo ve sus personajes; el máster, todos.
5. Los PNJ con statblock son del módulo 4 y las fichas en el mapa, del 6.
6. Los dados 3D, con three.js y cannon-es (MIT): se pide permiso en la spec de `dados`.
7. Antes de la spec de `srd-5e`, se mira si la editorial tiene una versión oficial en español con la misma licencia.
