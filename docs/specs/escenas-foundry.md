# Spec: escenas-foundry (módulo 6)

Estado: **spec** (2026-11-07). Sexta y última capacidad del módulo 6 (`docs/specs/modulo-6.md`). Entrevista:
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

## Pruebas

- **Núcleo**: la conversión de una escena de v13 y de v14 (rejilla, muros, puertas, luces, margen).
- **Integración**: traer un paquete de escenas y una aventura de prueba (escritos a mano, sin contenido de pago); las
  criaturas preparadas; reimportar sin duplicar.
- **E2E**: traer un zip con una escena y abrirla en la mesa con sus muros y sus fichas.

## Fuera

Las regiones de Foundry con comportamientos (teletransporte, daño): se traen como notas, si acaso; los sonidos de la
escena (módulo 7); los tiles animados.
