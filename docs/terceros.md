# Lo que viene de terceros

Desde el ADR-0014, Crisol puede usar código, textos y datos de lo estudiado. Cada cosa traída se apunta aquí con su
origen, su versión y su licencia, y lleva la misma cabecera en su archivo. Si Crisol se vende algún día, esta lista dice
qué hay que repasar.

| Qué | Dónde está en Crisol | De dónde | Versión | Licencia |
| --- | --- | --- | --- | --- |
| Los compendios de dnd5e, como comprobación de nuestro contenido (no se copian al repo: se exportan a `datos-locales/dnd5e/`) | `scripts/srd/dnd5e-exportar.ts`, `scripts/srd/dnd5e.ts`, `scripts/srd/comparar-dnd5e.ts` | Sistema dnd5e de Foundry VTT (Andrew Clayton y colaboradores) | 6.0.6 | MIT; su contenido, SRD 5.1 y 5.2.1 (CC BY 4.0) |
| La mecánica de los objetos mágicos que el texto no da con números (las acciones que lanzan un conjuro, con su salvación, su CD y su daño; sus cargas) | `packages/systems/src/examples/5e/content/objetos_magicos.json` (generado con `scripts/srd/magicos.ts` y `scripts/srd/dnd5e.ts`) | Compendios `items` y `equipment24` del sistema dnd5e de Foundry VTT | 6.0.6 | MIT; su contenido, SRD 5.1 y 5.2.1 (CC BY 4.0) |
| El formato de los sistemas y módulos de Foundry VTT, para importarlos: sus manifiestos (`system.json`, `module.json`, `packFolders`, `documentTypes`), sus compendios LevelDB (claves `!items!id`, `!actors.items!actor.item`…) y NeDB, sus documentos (objetos, actores, diarios con páginas, tablas con resultados) y sus enriquecedores de texto (`@UUID[…]{…}`, `[[/r …]]`, `&Reference[…]`, `[[lookup …]]`). Solo el formato, leído de sus archivos: no se copia código | `packages/systems/src/foundry/`, `apps/server/src/foundry/read.ts` | Foundry VTT (Foundry Gaming LLC) | 14 (y los de la v9 en adelante) | Formato de sus datos; sin código suyo |
| El formato de las escenas y aventuras de Foundry VTT, para traerlas a un mundo (sus campos de la v9 a la v14: rejilla, niveles, muros, luces, fichas, notas; las claves anidadas de LevelDB) y las cuentas de su lienzo: el margen (`calculateDimensions` de `common/grid/square.mjs`, `gridless.mjs` y `hexagonal.mjs`, y `_calculatePreV10Dimensions`), dónde empieza la casilla (0, 0) de las hexagonales (`getTopLeftPoint`) y el sentido de los muros de un solo lado (`clockwise-sweep.mjs`), reescritas en unas líneas | `packages/systems/src/foundry/scene.ts`, `apps/server/src/foundry/read.ts` | Foundry VTT (Foundry Gaming LLC) | 14.369 | EULA de Foundry VTT; uso privado (ADR-0014): unas fórmulas reescritas, sin copiar sus archivos |
| Cómo enseña dnd5e sus tiradas y valores en los textos (`[[/attack extended]]`, `[[/damage average]]`, `[[/save]]`, `[[lookup @labels.description.template]]`): la competencia por VD, la característica de un arma sutil, las plantillas de área | `packages/systems/src/foundry/dnd5e.ts` | Sistema dnd5e de Foundry VTT (Andrew Clayton y colaboradores), leído de sus compendios | 6.0.6 | MIT; su contenido, SRD 5.2.1 (CC BY 4.0) |
| El modelo de la búsqueda por significado: `multilingual-e5-small` cuantizado a int8 (ONNX) y su tokenizador SentencePiece. No va en el repo: lo baja la imagen de Docker (comprobado por su huella) y, en desarrollo, va en `datos-locales/modelos/` | `Dockerfile` (etapa `model`), `apps/server/src/library/model-worker.ts` | `intfloat/multilingual-e5-small` (Liang Wang y otros, Microsoft); su versión ONNX, `Xenova/multilingual-e5-small` | intfloat 614241f, Xenova 761b726 | MIT |
| La skill de diseño y revisión de interfaces **impeccable** (con sus agentes y su vigilante), solo una herramienta del desarrollo: no va en la app | `.claude/skills/impeccable`, `.claude/agents/impeccable-*.md` (su motor, fuera de git) | https://github.com/pbakaus/impeccable (Paul Bakaus) | skill 4.8.2, motor 0.1.21 | Apache-2.0 |

## Imágenes propias de la app (tanda 5, 2026-11-12)

Generadas por Enrique con ChatGPT en su cuenta, en el estilo elegido (F, `docs/imagenes.md`), o capturas de la propia
app. Pasadas a WebP con el Chromium de Playwright.

| Archivo | Qué | Origen |
| --- | --- | --- |
| `apps/web/public/ambiente/inicio.webp` | El fondo de ambiente (480 px: va muy difuminado) | El valle del ocaso, `datos-locales/estilos/f-entrar.png`, generada por Enrique con ChatGPT (2026-11-11). Provisional hasta la imagen «ambiente» |
| `apps/web/public/portada/portada.webp` | La imagen de la portada pública | La misma del valle (provisional hasta la imagen «portada») |
| `apps/web/public/portada/{mundo,mesa,ficha}.webp` | Las estampas de la portada | Capturas de Crisol (de sus pruebas) |

## Fondos de las pantallas de cuenta (2026-11-08)

En `apps/web/public/fondos/` (lista en `apps/web/src/account/backdrops.ts`), recortados y pasados a WebP.

| Archivo | Obra | Autor | Origen | Licencia |
| --- | --- | --- | --- | --- |
| `jinete-de-dragon.webp` | Jinete de dragón | GBTaylor | https://pixabay.com/illustrations/dragon-dragon-rider-ai-generated-8029890/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) · hecha con IA por su autor |
| `dragon-ciudad-en-llamas.webp` | Dragón sobre la ciudad en llamas | MythologyArt | https://pixabay.com/illustrations/dragon-fire-pagan-epic-fantasy-8780168/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) |
| `arbol-de-luz.webp` | El árbol de la luz | Alan_Frijns | https://pixabay.com/illustrations/ai-generated-tree-magical-mystical-8167332/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) · hecha con IA por su autor |
| `reino-dorado.webp` | El reino dorado | artandmusic909 | https://pixabay.com/illustrations/golden-kingdom-elven-kingdom-fantasy-8164867/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) |
| `castillo-nubes-doradas.webp` | Castillo entre nubes doradas | TheDigitalArtist | https://pixabay.com/illustrations/dragon-castle-fantasy-magic-4767447/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) |
| `dragon-en-el-bosque.webp` | Dragón en el bosque | Artie_Navarre | https://pixabay.com/illustrations/painting-the-framework-dragon-3564055/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) |
| `rios-de-fuego.webp` | Ríos de fuego entre montañas | NickyPe | https://pixabay.com/illustrations/ai-generated-mountains-night-8699087/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) · hecha con IA por su autor |
| `ciudad-purpura.webp` | Ciudad púrpura bajo la luna | Eynoxart | https://pixabay.com/illustrations/dark-academia-city-fantasy-art-7471412/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) · hecha con IA por su autor |
| `dragon-negro.webp` | Dragón negro | MythologyArt | https://pixabay.com/illustrations/black-dragon-dragon-fantasy-art-8808267/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) |
| `ciudad-de-torres.webp` | Ciudad de torres entre nubes | bojanboyss | https://pixabay.com/illustrations/ai-generated-towers-skyscrapers-8907200/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) · hecha con IA por su autor |
| `arbol-antiguo.webp` | El árbol antiguo en la niebla | JuliusH | https://pixabay.com/illustrations/ai-generated-tree-fog-forest-8487767/ | Licencia de Pixabay (uso libre, sin atribución obligatoria) · hecha con IA por su autor |
| `vasnetsov-encrucijada.webp` | El caballero en la encrucijada (1882) | Víktor Vasnetsov | https://commons.wikimedia.org/wiki/File:Victor_Vasnetsov_-_Knight_at_the_Crossroads_-_Google_Art_Project.jpg | Dominio público |
| `vasnetsov-bogatyres.webp` | Los bogatyres (1898) | Víktor Vasnetsov | https://commons.wikimedia.org/wiki/File:Viktor_Vasnetsov_-_%D0%91%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D0%B8_-_Google_Art_Project.jpg | Dominio público |
| `arbo-caceria-salvaje.webp` | La cacería salvaje de Odín (1872) | Peter Nicolai Arbo | https://commons.wikimedia.org/wiki/File:Peter_Nicolai_Arbo_-_The_wild_Hunt_of_Odin_-_NG.M.00258_-_National_Museum_of_Art,_Architecture_and_Design.jpg | Dominio público |
| `aivazovski-novena-ola.webp` | La novena ola (1850) | Iván Aivazovski | https://commons.wikimedia.org/wiki/File:Aivazovsky,_Ivan_-_The_Ninth_Wave.jpg | Dominio público |
| `bierstadt-sierra-nevada.webp` | Entre las montañas de Sierra Nevada (1868) | Albert Bierstadt | https://commons.wikimedia.org/wiki/File:Bierstadt_-_Among_the_Sierra_Nevada_Mountains_-_1868.jpg | Dominio público |
| `bocklin-isla-de-los-muertos.webp` | La isla de los muertos (1880) | Arnold Böcklin | https://commons.wikimedia.org/wiki/File:Arnold_B%C3%B6cklin_-_Die_Toteninsel_I_(Basel,_Kunstmuseum).jpg | Dominio público |
| `church-cotopaxi.webp` | Cotopaxi (1862) | Frederic Edwin Church | https://commons.wikimedia.org/wiki/File:Cotopaxi_church.jpg | Dominio público |
| `cole-viaje-de-la-vida.webp` | El viaje de la vida: la infancia (1842) | Thomas Cole | https://commons.wikimedia.org/wiki/File:Thomas_Cole_-_The_Voyage_of_Life_Childhood,_1842_(National_Gallery_of_Art).jpg | Dominio público |
| `friedrich-mar-de-hielo.webp` | El mar de hielo (1823) | Caspar David Friedrich | https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Das_Eismeer_-_Hamburger_Kunsthalle_-_02.jpg | Dominio público |
| `martin-el-bardo.webp` | El bardo (1817) | John Martin | https://commons.wikimedia.org/wiki/File:JohnMartin_The_Bard_RTNX.jpg | Dominio público |
| `martin-gran-dia-de-su-ira.webp` | El gran día de su ira (1853) | John Martin | https://commons.wikimedia.org/wiki/File:John_Martin_-_The_Great_Day_of_His_Wrath_-_Google_Art_Project.jpg | Dominio público |
| `martin-pandemonium.webp` | Pandemónium (1841) | John Martin | https://commons.wikimedia.org/wiki/File:John_Martin_Le_Pandemonium_Louvre.JPG | Dominio público |
| `turner-anibal-alpes.webp` | Tormenta de nieve: Aníbal cruzando los Alpes (1812) | J. M. W. Turner | https://commons.wikimedia.org/wiki/File:Turner,_Snow_Storm,_50508403226_b272cf84c3_o.jpg | Dominio público |
