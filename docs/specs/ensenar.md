# Spec: enseñar a los jugadores (módulo 7)

Capacidad `ensenar` del módulo 7 (`docs/specs/modulo-7.md`). Amplía «Enseñar a los jugadores» (`showPage`, ADR-0019).
Estudio: `research/foundry/sala-de-jugadores.md` § enseñar.

## Objetivo

Que el máster ponga delante de los jugadores, al momento, una página o una imagen: a todos, a unos o en la Pantalla,
como quien pasa un dibujo o una carta por la mesa.

**Historias**

- Como máster, desde una página (en su ventana de la Mesa) o desde un archivo, pulso «Enseñar» y elijo: a todos, a
  unos jugadores o en la Pantalla.
- Como jugador, se me abre al momento (la página en su ventana o hoja; la imagen a pantalla completa, con zoom); la
  cierro cuando quiero y la vuelvo a abrir desde el registro.
- En la tele, la imagen o la página ocupa la Pantalla por encima de la escena hasta que el máster la quita.
- Como máster, si la página no la conoce alguno, se me ofrece revelarla a la vez (queda en lo que sabe) o enseñarla
  solo a quien la conoce.
- Como IA, enseño una página o una imagen.

## Comportamiento

- **Qué**: una página del mundo (con su texto y su panel, como la lee ese jugador: sin secretos que no conozca) o una
  imagen (un archivo del mundo; también la imagen de una pestaña o una criatura).
- **A quién**: todos los jugadores conectados de la campaña, unos jugadores (elegidos de la sala) o la Pantalla. Se
  puede combinar (a todos y en la Pantalla).
- **Página que no conoce**: no se da un permiso de mentira (Foundry lo da solo en el navegador y se pierde al
  recargar). O se revela a la vez (con `reveal`, que queda en lo que sabe y pide confirmación porque no se puede
  «des-saber») o a ese jugador no le llega, y el máster ve a cuántos no ha llegado.
- **Imagen**: enseñarla da a esos jugadores acceso a ese archivo (con un enlace firmado de un día); no lo añade a nada
  más.
- **Al llegar**: en la Mesa del jugador, una ventana (PC) o la hoja desde abajo (móvil) con la página, o la imagen a
  pantalla completa con zoom y cerrar; en la Pantalla, la imagen o la página encima de la escena, con fundido; la
  Pantalla la quita cuando el máster pulsa «Quitar de la Pantalla» (o enseña otra cosa).
- **En el registro**: una entrada «Enseñado» con su miniatura, a quién y «Abrir» (solo para quien la recibió y el
  máster).
- **Permiso**: solo el máster, comprobado en el servidor (en Foundry cualquiera puede mandar el aviso).

### IA (MCP)

`ensenar_pagina` (ya existe: gana `to` y `screen`) y `ensenar_imagen` (`fileId`, `to`, `screen`); `quitar_de_pantalla`.

## Contratos (propuesta)

- `showPage({ campaignId, pageId, to?: userId[], screen?: boolean, reveal?: boolean })` → `{ shown, unknown }`.
- `showImage({ campaignId, fileId, to?: userId[], screen?: boolean, caption? })` → `{ shown }`.
- `clearScreenShow({ campaignId })`.
- Tiempo real: `shown` gana `kind: 'page' | 'image'`, la imagen firmada y `entryId`; la Pantalla recibe por el canal de
  la mesa `{ type: 'show', … } | { type: 'show', clear: true }`. En `campaign_tables`, lo que enseña la Pantalla
  (para que una Pantalla que se recarga lo siga enseñando).

## Pruebas

- Integración: enseñar a todos, a uno y en la Pantalla; un jugador que no la conoce no la recibe (ni su texto); con
  `reveal`, se apunta; un jugador no puede enseñar; la imagen firmada solo para los destinatarios; el registro guarda
  la entrada; el MCP.
- Web: el menú «Enseñar» (destinos), la imagen a pantalla completa, la Pantalla con lo enseñado y quitarlo, «Abrir»
  desde el registro.
- e2e: el máster enseña una imagen a la jugadora y ella la ve; la Pantalla la enseña y se quita.

## Criterios de éxito

1. Lo enseñado llega en menos de un segundo y solo a quien debe; al recargar, el jugador lo encuentra en el registro.
2. Ningún jugador puede enseñar nada aunque llame a la API.
3. En la Pantalla, lo enseñado se ve encima de la escena y sigue tras recargarla.
