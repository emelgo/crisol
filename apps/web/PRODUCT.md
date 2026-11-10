# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **El máster** (Enrique): prepara sus mundos y lleva sus campañas, siempre desde el PC (mundo, páginas, archivos,
  sistemas, la Mesa). El móvil del máster no se diseña.
- **Los jugadores**: leen lo que saben de su campaña, llevan su ficha, tiran dados y, desde el módulo 7, escriben en
  el registro, mueven su ficha y apuntan sus notas; sobre todo desde el móvil, que tiene que ir bien.
- **La Pantalla** (la tele de la mesa, o la pantalla de los jugadores a distancia): la ve todo el grupo; siempre oscura.

Se juega sobre todo en persona, con la Pantalla en la tele y cada uno con su móvil; a distancia (con Discord para la
voz) tiene que funcionar igual de bien.

## Product Purpose

Mundos de rol y mesa virtual en español, con IA: la wiki del mundo (páginas como hojas), tipos de página y plantillas,
sistemas de reglas, fichas y dados, compendio y libros, lo que sabe cada campaña, la Mesa (escenas, fichas, visión,
combate) y la sala de jugadores. Es la reescritura del Crisol antiguo (Obsidian y Atlas). De momento, solo para Enrique
y sus jugadores (ADR-0014).

## Positioning

Todo en un sitio y en español, con cualquier IA conectada por MCP que puede hacer lo mismo que el máster; el servidor
decide lo que ve cada uno (lo que sabe cada campaña, lo que ve el grupo en la Mesa), no la interfaz.

## Operating Context

- Partidas en persona: el máster en su PC con la Mesa, la Pantalla en la tele por HDMI y los jugadores con el móvil.
- A distancia: cada uno en su casa con su Mesa; voz por Discord o una llamada aparte.
- Preparación: el máster entre partidas, en el PC, a menudo con la IA.

## Capabilities and Constraints

- Catálogo de módulos y estado en `docs/modulos.md`; especificaciones en `docs/specs/`; decisiones en `docs/adr/`.
- Textos de la interfaz en español por i18n, cortos. En la interfaz no salen «Obsidian», «Atlas», «Foundry» ni
  «D&D Beyond»; se dice «IA», no «Claude»; no se dice «wiki» ni «tele» (es la «Pantalla»).
- Nada de dependencias copyleft.
- Medidas de D&D (pies, millas, libras), también en español.

## Brand Commitments

- **Las normas de Enrique en `docs/diseno.md` mandan** sobre cualquier propuesta: identidad (mezcla del Crisol antiguo
  y del nuevo, la llama como marca), armazón, pantallas, animaciones con temática de crisol, cristal sobre la Mesa,
  textos y tutoriales guiados.

## Evidence on Hand

- La app en marcha (`apps/web`), los lienzos aprobados de cada módulo (fuentes en `out/lienzo-*`).
- No hay testimonios, clientes ni precios: no se inventan.

## Product Principles

1. Lo que dicta `docs/diseno.md` manda.
2. Textos cortos y sin sobreexplicar; las ayudas, genéricas.
3. Nada con aspecto «de IA».
4. El servidor decide lo que ve cada uno; la interfaz nunca es la única barrera.
5. El máster trabaja en PC; lo de la jugadora, también en el móvil.
