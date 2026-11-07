# Spec: mapas-jugadores (módulo 5)

Estado: **construido** (2026-11-06; en la rama `modulo-5/visibilidad`, aún sin PR). Tercera capacidad del módulo 5 (`docs/specs/modulo-5.md`). Entrevista:
`docs/modulos.md` § «### 5. Visibilidad por campaña». ADR-0017 y ADR-0007 (pestañas de página y mapas). Estudio:
`research/foundry/visibilidad-y-revelar.md` (los pines de una escena).

## Objetivo

Que los jugadores vean **los mapas de las páginas que conocen** con solo lo que han descubierto: cada pestaña, pin,
región y ruta se puede ocultar y revelar por separado, como «descubierto» en el Crisol actual. El máster revela desde
el propio mapa, en partida.

Para quién: el máster; los jugadores, en la wiki de su campaña; la IA.

## Requisitos

- **Siguen a su página**: una pestaña, un pin, una región o una ruta se ve si se ve su página, salvo que tenga su
  marca. «Oculto» (lo que ya se marca hoy, `hidden`) es la marca del mundo: «no lo conoce nadie». Una campaña la cambia
  con «Revelar» (a toda la campaña o a unos personajes) y la vuelve a ocultar.
- **En el mapa**, el máster marca y revela con el botón derecho (o una pulsación larga en el móvil) sobre el pin, la
  región o la ruta: «Ocultar a los jugadores», «Revelar…». Lo oculto se le ve atenuado, con su marca. En la barra de
  pestañas, lo mismo para una pestaña.
- **El jugador** ve el mapa solo con lo que ve:
  - un pin a una página que ve lleva a ella, con su vista previa;
  - un pin a una página que no ve sale con su etiqueta, sin enlace (el máster lo oculta si no debe saberse que está);
  - lo oculto no le llega (ni su posición, ni su etiqueta).
- Revelar un pin es **revelar**: aviso al jugador, lo nuevo marcado en el mapa y en «Lo que sabe el grupo».
- **Tiempo real**: si el máster revela un pin con el mapa abierto, al jugador le aparece; si lo oculta, desaparece.
- **La IA**: `revelar` y `ocultar` admiten pestañas, pines, regiones y rutas; `ver_mapa` del jugador da solo lo suyo;
  `poner_pin` y `cambiar_pin` admiten `hidden`, como hoy.

## Decisiones (propuestas del estudio, por confirmar al ver las pantallas)

1. **Un pin a lo que no se ve, con su etiqueta y sin enlace**: el pin es parte del mapa; si no debe verse, se oculta.
2. **Las capas** del Crisol actual no existen aún en Crisol (los mapas de mundo con capas son el módulo 9): cuando
   lleguen, se ocultan igual que una pestaña.

## Construido (2026-11-06) y lo que queda

- **Servidor** (con `conocimiento`): `listPageTabs` y `getMap` le dan al jugador las pestañas y los pines que ve
  (siguen a su página; `hidden` es la marca del mundo; una campaña la cambia con su marca, también por personajes); un
  pin a una página que no ve llega sin ella; la imagen del mapa se le sirve. Se revelan con `reveal` (aviso y lo nuevo).
- **Web**: el jugador ve los mapas de sus páginas en lectura (con una ficha del pin: su nombre y «Abrir» si conoce la
  página); el máster ve atenuados los pines ocultos y, en el panel de un pin y en el menú de una pestaña, «Oculto a los
  jugadores» y «Revelar…».
- **Pruebas**: las de `knowledge.integration.test.ts` y la e2e `mapas-jugadores.spec.ts`.
- **Queda**: el botón derecho sobre un pin con «Ocultar a los jugadores / Revelar…» (hoy, en su panel); las regiones y
  las rutas (aún no se dibujan en el mapa, `map_elements`); lo nuevo marcado en el mapa.

## Pruebas

- Servidor: `getMap` y `listPageTabs` de un jugador no traen lo oculto (ni su posición); revelar un pin a un personaje
  se lo da solo a su dueño; tiempo real sin lo oculto; la colaboración niega los documentos de pestañas ocultas.
- E2E: el máster oculta un pin, lo revela en partida y la jugadora lo ve aparecer.
- La prueba de fugas, ampliada con los mapas.

## Fuera

- La niebla, la visión y las escenas de la mesa (módulo 6).
- Las capas y los mapas de mundo (módulo 9).
