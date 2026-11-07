# Spec: escenas-foundry (módulo 6)

Estado: **construido** (2026-11-07; falta la revisión). Sexta y última capacidad del módulo 6 (`docs/specs/modulo-6.md`). Entrevista:
`docs/modulos.md` § «### 6. Mesa» («las escenas de un zip de Foundry»). ADR-0014 (uso privado) y ADR-0018. Estudio:
`research/foundry/escenas-fichas-y-combate.md` § 6 (escenas en un zip, aventuras, ids, lo que se reaprovecha del
importador del módulo 4).

## Objetivo

Traer las escenas de un zip de Foundry (un módulo, una aventura o un compendio de escenas) con su imagen, su rejilla,
sus muros, puertas y luces, y sus fichas convertidas en criaturas preparadas.

## Requisitos

- **Desde «Traer de Foundry»** (el mismo cuadro del módulo 4), un zip que tenga escenas o aventuras: se listan sus
  escenas (con su miniatura) y se eligen cuáles y en qué página van (una página nueva por escena, bajo una que se
  elige, o la de una aventura con sus páginas).
- **Cada escena** pasa a una pestaña «Escena»: su imagen (sacada del zip y troceada en el navegador, sin subir el zip
  entero), su rejilla (las cuatro hexagonales de Foundry pasan a las dos nuestras con su desplazamiento), sus muros con
  sus restricciones, sus puertas (normales, secretas, con llave, abiertas o cerradas), sus luces y la oscuridad; las
  coordenadas sin el margen de Foundry.
- **Sus fichas**: cada actor de la escena busca su criatura en el compendio del sistema o del mundo (por su id de
  origen o su nombre); si la hay, queda como **criatura preparada** en la escena (sale al abrirla en una campaña,
  oculta o a la vista según la ficha); si no, se dice.
- **Una aventura** trae además sus diarios como páginas (con el importador del módulo 4) y sus actores al compendio del
  mundo, si el máster lo pide.
- **Reimportar** el mismo zip no duplica: cada escena recuerda su origen (el id de Foundry y el paquete).
- Los formatos de v10 a v14 (los cambios de la v13 y la v14: niveles, regiones, plantillas como regiones).

## Decisiones (propuestas de Claude, por confirmar al verlas)

1. **Las escenas de Foundry, como pestañas de páginas nuevas** (el lugar), no sueltas.
2. **Las criaturas preparadas** son un dato de la escena (del mundo): al abrirla en una campaña, se ponen en juego y en
   el mapa (o se ofrece hacerlo), no antes.
3. **Las notas de escena** de Foundry pasan a pines a sus páginas si se traen sus diarios.

## Construido (2026-11-07) y lo que queda

- **Núcleo** (`packages/systems/src/foundry/scene.ts`): una escena de la v9 a la v14 pasa a lo de Crisol en píxeles de
  su imagen: se resta el margen (con las cuentas de Foundry: casillas enteras en la cuadrada, la zancada y la media
  casilla en las hexagonales, el tamaño antiguo en los hexágonos de antes de la v10) y el desplazamiento del fondo
  (`shiftX` en la v14 y antes de la v10, `background.offsetX` de la v10 a la v13). Las pares e impares de Foundry, a
  `hex-rows` y `hex-columns` con su desplazamiento. Muros: 0 nada, 10 limitado, 20 del todo; los de cerca o de lejos
  (30, 40), limitados; su sentido (el 1 de Foundry deja pasar por nuestra derecha); puertas normales, secretas, con
  llave y abiertas. Luces con su cono (girado: en Foundry 0 es abajo), su oscuridad (`negative` o luminosidad
  negativa) y su encendido según la oscuridad. La oscuridad, de `environment` o suelta, y de día con la luz global.
  Una escena con varias plantas (v14) da una escena por planta, cada una con su fondo y lo suyo.
- **Leer el zip** (`apps/server/src/foundry/read.ts`): lo de dentro a cualquier profundidad (el delta de una ficha y
  sus efectos, los comportamientos de una región) y los paquetes de escenas y aventuras.
- **Servidor**: migración 0060 (`scenes.prepared`, `scenes.pins` y la tabla `foundry_origins`, fuera del historial:
  se va en cascada con lo que se deshace o se purga). `inspectFoundryScenes` (cada escena con su miniatura, su imagen,
  su rejilla, lo que trae y si ya se trajo) e `importFoundryScenes`. Una aventura: su página (con su subtítulo y su
  descripción) y sus diarios como subpáginas (con `htmlToMarkdown` del módulo 4); sus escenas, debajo. Cada escena,
  una página nueva con su pestaña «Escena» y, en una operación, su rejilla, su vista inicial, su oscuridad, sus muros,
  sus luces, sus criaturas preparadas y sus pines. La imagen la trocea la web después (`setSceneImage`). Prueba:
  `apps/server/src/actions/foundry-scenes.integration.test.ts` (un módulo escrito a mano con un paquete LevelDB y una
  aventura NeDB).
- **Web**: en «Sistema nuevo», un zip con escenas o aventuras enseña su apartado «Escenas»: el mundo, bajo qué página,
  las escenas sueltas y las aventuras (con las suyas) con su miniatura sacada del zip, y «Ya traída: se actualiza».
  Si el zip trae también compendios, primero se trae el sistema y el cuadro sigue con las escenas (sus criaturas se
  buscan en ese sistema). Cada mapa se saca del zip y se trocea en el hilo de siempre a las medidas de la escena (si
  la imagen mide otra cosa, se estira como en Foundry); sin imagen en el zip (o en vídeo), un mapa liso de su tamaño,
  para que sus muros y fichas caigan en su sitio. Al acabar, cada escena con sus criaturas preparadas y las que no
  (sin criatura en el compendio, personajes, sin actor) y lo que no se trae. E2E `e2e/tests/escenas-foundry.spec.ts`;
  capturas `out/capturas/foundry-*.png`.
- **Decisiones tomadas al construir** (por confirmar):
  - **Las criaturas preparadas salen solas, sin preguntar**, la primera vez que una campaña abre (o presenta) la
    escena, ocultas o a la vista como venía cada ficha: como en Foundry, son parte de la escena; abrirla otra vez no
    las repite. Si el estado de la campaña en la escena nació antes por otro camino (la IA puso fichas sin abrirla),
    no salen solas: `ver_escena` las lista y se ponen con `poner_fichas`. Las que la campaña no tiene en su compendio
    (otro sistema) se saltan.
  - **Buscar su criatura**: por su origen (la clave del módulo 4 acaba con un resumen de «paquete/id»: el de
    `_stats.compendiumSource` del actor o el de cada paquete de actores del zip) y, si no, por su nombre (sin tildes
    ni el «(1)» de las copias); primero en el sistema traído en el mismo cuadro y después en los de las campañas del
    mundo. La enlazada es la única; la no enlazada, una copia numerada.
  - **Las notas, a pines** de la escena si su diario está traído (en esa vez o antes); al abrirla una campaña, salen
    como marcas pin del máster (ocultas a la pantalla) de las herramientas de la mesa, que llevan a la página.
  - **Reimportar** cambia en su sitio la escena (rejilla, vista, oscuridad, muros y luces, preparadas y pines, y su
    mapa) y el texto de sus diarios; deja el título de la página. Si la página está en la papelera, se trae otra vez.
- **Queda**: los actores de una aventura al compendio del mundo (pasarlos a los tipos de su sistema); los zips de un
  mundo (`world.json`); leer el zip por partes (hoy el navegador lo abre entero, como en el módulo 4); el delta de las
  fichas (PG y efectos de partida); las fichas sin criatura como marcadores con su imagen; los pines en la pestaña de
  la wiki; la regla de diagonales del mundo de Foundry (queda la de la escena); la revisión.

## Pruebas

- **Núcleo**: la conversión de una escena de v13 y de v14 (rejilla, muros, puertas, luces, margen).
- **Integración**: traer un paquete de escenas y una aventura de prueba (escritos a mano, sin contenido de pago); las
  criaturas preparadas; reimportar sin duplicar.
- **E2E**: traer un zip con una escena y abrirla en la mesa con sus muros y sus fichas.

## Fuera

Las regiones de Foundry con comportamientos (teletransporte, daño): se traen como notas, si acaso; los sonidos de la
escena (módulo 7); los tiles animados.
