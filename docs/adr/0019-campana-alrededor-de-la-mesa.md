# ADR-0019: La campaña, alrededor de la Mesa

Estado: aceptada (Enrique, 2026-11-08 y 2026-11-09: «está genial» al lienzo y «me gusta lo que has dicho» a lo de las
campañas) · Tras el módulo 6

## Contexto

Tras probar los módulos 5 y 6, Enrique pidió rehacer la campaña: «la mesa debería ser lo que se ve al abrir la campaña
como en foundryvtt»; «dentro de la mesa es donde deberíamos tener el compendio»; la Mesa «es poco intuitiva» y «debería
parecerse a dndbeyond y foundryvtt»; «en una campaña al darle a la wiki se cambia la vista, no me gusta»; «el
inventario del grupo debería ser como en dndbeyond, desde la hoja de personaje». La campaña era una portada (miembros e
invitación) con vistas sueltas en la barra (Páginas, Personajes, Compendio, Grupo, En juego, Mesa, Revelado,
Biblioteca), y la Mesa, una más, difícil de encontrar.

El lienzo «Campaña en la Mesa» (https://claude.ai/artifact/1gY6Mun8KisrJ6d2fXGbLj; `out/lienzo-campana/`) lo enseñó
con siete tableros y catorce decisiones que Enrique dio por buenas. Después añadió que **las campañas se abren en otra
pestaña**, como la partida en D&D Beyond, y preguntó si un mundo debía tener una sola campaña, para no liarse
compartiendo con grupos distintos.

## Decisión

1. **El máster abre la campaña en la Mesa** a pantalla completa (`/mundos/$w/campanas/$c`), con una **barra de
   pestañas a la derecha** (`tabletop/sidebar.tsx`): Tiradas, Combate, Escenas, Personajes, Compendio, Páginas y Ajustes.
   Se abre la última usada (la primera vez, Escenas), `?panel=` elige una y la barra se pliega a una columna de iconos.
   Las herramientas que necesitan panel (visión, marcas, pantalla del máster) lo siguen tapando.
2. **Las vistas sueltas desaparecen de la barra**: En juego, en Escenas («En esta escena») y en Compendio (lo que está
   en juego, con su ojo); Biblioteca, en Compendio («Libros»); Revelado, en Páginas; Grupo, en la ficha; la portada
   (miembros, invitación, borrar), en Ajustes. Sus direcciones viejas llevan al máster a su pestaña
   (`ToMesaIfMaster`); «ver como» un personaje (`?como=`) se queda.
3. **La barra izquierda** se queda en lo mínimo: el máster, la Mesa y el mundo (para escribir con calma); quien juega,
   su ficha y su Mesa.
4. **Ventanas sobre la Mesa** (`tabletop/windows.tsx`, sin dependencias): páginas, el compendio, cada libro y cada hoja
   se abren encima del mapa; se mueven por la cabecera, se estiran por la esquina (también con el teclado), se minimizan
   abajo a la izquierda y recuerdan dónde estaban (en el navegador). Un enlace a una página dentro de una ventana abre
   otra ventana. Las páginas del máster son las de la wiki (`EntryView`, con su edición en vivo); las de quien juega, su
   lectura (`PlayerPage`).
5. **Enseñar a los jugadores**: la acción `showPage` (y su herramienta MCP `ensenar_pagina`) manda por el canal en
   tiempo real `{ type: 'shown' }` a los jugadores de la campaña que conocen la página; su Mesa la abre en ventana y,
   fuera de ella, les sale «Te enseñan». Si alguno no la conoce, la ventana del máster lo dice y deja revelarla y
   enseñarla de una vez.
6. **Quien juega abre la campaña en su ficha** (la última que abrió; sin personaje, crear uno) con «Ir a la Mesa», y
   **su Mesa** (`/mesa`) es lo que ve el grupo: el canal de la mesa admite un tercer espectador, `player`, que recibe lo
   mismo que la tele y no manda nada en vivo; entra cualquiera de la campaña (`campaign.read`), y las teselas de la tele
   también se le sirven. No ve Escenas ni Ajustes.
7. **«Del grupo» en la ficha**, debajo de «Lo mío»: el inventario del grupo con sus monedas y **quién puso cada cosa**
   (`addedBy` en cada objeto del JSON del grupo: el personaje de quien vino o el de quien lo añadió); se pasa
   arrastrando en PC y con «Mover» en el móvil.
8. **Las campañas se abren en otra pestaña del navegador**, como en D&D Beyond.
9. **Varias campañas por mundo** (no una sola): Eana tiene varios grupos que comparten el mundo y su reloj. Para no
   liarse, **lo que se comparte va a la campaña desde la que se hace**: desde su Mesa, revelar y enseñar van a ella sin
   preguntar (`CurrentCampaignContext`); desde la wiki del mundo, se elige (con una sola campaña, no se pregunta).

## Consecuencias

- La Mesa crece: `mesa.tsx` sigue siendo grande; la barra, las pestañas y las ventanas van en sus propios archivos.
- La tele y la Mesa de los jugadores ven lo mismo; la visión por personaje (lo que ve cada uno) queda para cuando se
  juegue online.
- «Archivar» la campaña (decisión 13 del lienzo) no existe aún en el servidor: queda para después.
- Las pruebas que entraban por las vistas viejas del máster entran ahora por su Mesa (con su canal y su lienzo de
  mentira, `tabletop/fakes.ts`).
