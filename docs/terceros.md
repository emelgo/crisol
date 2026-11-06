# Lo que viene de terceros

Desde el ADR-0014, Crisol puede usar código, textos y datos de lo estudiado. Cada cosa traída se apunta aquí con su
origen, su versión y su licencia, y lleva la misma cabecera en su archivo. Si Crisol se vende algún día, esta lista dice
qué hay que repasar.

| Qué | Dónde está en Crisol | De dónde | Versión | Licencia |
| --- | --- | --- | --- | --- |
| Los compendios de dnd5e, como comprobación de nuestro contenido (no se copian al repo: se exportan a `datos-locales/dnd5e/`) | `scripts/srd/dnd5e-exportar.ts`, `scripts/srd/dnd5e.ts`, `scripts/srd/comparar-dnd5e.ts` | Sistema dnd5e de Foundry VTT (Andrew Clayton y colaboradores) | 6.0.6 | MIT; su contenido, SRD 5.1 y 5.2.1 (CC BY 4.0) |
| La mecánica de los objetos mágicos que el texto no da con números (las acciones que lanzan un conjuro, con su salvación, su CD y su daño; sus cargas) | `packages/systems/src/examples/5e/content/objetos_magicos.json` (generado con `scripts/srd/magicos.ts` y `scripts/srd/dnd5e.ts`) | Compendios `items` y `equipment24` del sistema dnd5e de Foundry VTT | 6.0.6 | MIT; su contenido, SRD 5.1 y 5.2.1 (CC BY 4.0) |
| El formato de los sistemas y módulos de Foundry VTT, para importarlos: sus manifiestos (`system.json`, `module.json`, `packFolders`, `documentTypes`), sus compendios LevelDB (claves `!items!id`, `!actors.items!actor.item`…) y NeDB, sus documentos (objetos, actores, diarios con páginas, tablas con resultados) y sus enriquecedores de texto (`@UUID[…]{…}`, `[[/r …]]`, `&Reference[…]`, `[[lookup …]]`). Solo el formato, leído de sus archivos: no se copia código | `packages/systems/src/foundry/`, `apps/server/src/foundry/read.ts` | Foundry VTT (Foundry Gaming LLC) | 14 (y los de la v9 en adelante) | Formato de sus datos; sin código suyo |
| Cómo enseña dnd5e sus tiradas y valores en los textos (`[[/attack extended]]`, `[[/damage average]]`, `[[/save]]`, `[[lookup @labels.description.template]]`): la competencia por VD, la característica de un arma sutil, las plantillas de área | `packages/systems/src/foundry/dnd5e.ts` | Sistema dnd5e de Foundry VTT (Andrew Clayton y colaboradores), leído de sus compendios | 6.0.6 | MIT; su contenido, SRD 5.2.1 (CC BY 4.0) |
