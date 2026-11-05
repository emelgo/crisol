# ADR-0014: De momento, Crisol es de uso privado; se puede usar código y datos de lo estudiado

Estado: aceptada (Enrique, 2026-11-05: «el abogado dice que no pasa nada, además estoy pensando que voy a hacer la app
solo para mi y mis jugadores de momento, así que podemos usar código y todo porque no lo voy a distribuir»)

## Contexto

Hasta ahora Crisol se hacía para venderse: por eso la «sala limpia» (Foundry y D&D Beyond solo se estudiaban, sin
traer ni código ni datos suyos) y ninguna dependencia copyleft. La capacidad `foundry` del módulo 3 (importar los datos
de un sistema de Foundry) esperaba al abogado.

Lo que hay que saber de cada fuente:
- **El sistema dnd5e de Foundry** es MIT, y el contenido de sus compendios es el SRD (CC BY 4.0). Se puede usar
  igual que Homebrewery: con su aviso de copyright y su origen.
- **El núcleo de Foundry** tiene su EULA: permite instalarlo y usarlo, y prohíbe publicar partes del programa o
  revenderlo. Enrique tiene su licencia y el visto bueno de su abogado.
- **D&D Beyond** y su contenido de pago son de Wizards of the Coast; Enrique tiene licencia para usarlos él.

## Decisión

- **De momento, Crisol es para Enrique y sus jugadores**, no se distribuye ni se vende.
- **Se puede usar código, textos y datos de lo estudiado** (Foundry, dnd5e, D&D Beyond) cuando sirva, con el visto
  bueno del abogado de Enrique. Termina la espera de `foundry`.
- **Cada cosa traída lleva su origen**: una cabecera en el archivo (de dónde, qué versión, qué licencia) y su entrada
  en `docs/terceros.md`. Así, si algún día Crisol se vende, se sabe qué hay que quitar o volver a hacer.
- **Se mantienen** las demás normas: la comprobación de licencias de las dependencias (no estorba y deja la puerta
  abierta a venderlo) y que `apps/` y `packages/` no lean `research/`.

## Consecuencias

- Mejorar el contenido y la mecánica con lo que ya tiene resuelto dnd5e (sus actividades, efectos y avances) es
  posible sin rehacerlo a mano.
- Si Crisol vuelve a ser un producto, hará falta repasar `docs/terceros.md` y sustituir lo que no se pueda vender.
- `CLAUDE.md` y `research/README.md` cambian sus normas de sala limpia por esta.
