# Spec: el sonido (módulo 7)

Capacidad `sonido` del módulo 7 (`docs/specs/modulo-7.md`). Estudio: `research/foundry/sonido.md`; el Crisol antiguo
(`apps/desktop/src/renderer/src/sonido/sonidoStore.ts`, `apps/player-web/src/shell/sonido.ts`,
`apps/core-host/src/game/youtubePage.ts`).

## Objetivo

«Tenerlo todo en Crisol»: la música de ambiente y los efectos se preparan en el mundo y se lanzan desde la Mesa, y
suenan a la vez en todos los aparatos de la partida (en la mesa, en el PC o la tele; a distancia, en cada casa).

**Historias**

- Como máster, preparo listas de **ambiente** (taberna, combate, bosque) y de **efectos** (trueno, puerta) con mis
  archivos de audio o con enlaces de YouTube.
- Como máster, en la Mesa lanzo una lista o un efecto con un clic; puedo tener un ambiente sonando y lanzar efectos
  encima; paro, paso de pista, cambio el volumen y hago fundidos.
- Como jugador (o en la Pantalla), lo oigo a la vez que los demás; si entro tarde, entra por donde va.
- Si el navegador bloquea el sonido, veo «Activar sonido» hasta pulsarlo (en la tele, grande).
- Como cualquiera, en mi aparato bajo o silencio el ambiente y los efectos por separado.
- Como IA, pongo, paro y cambio el sonido, y preparo listas.

## Comportamiento

### Las listas (del mundo)

- Del mundo (preparación, como las escenas): se usan en todas sus campañas. Cada lista: nombre, clase (ambiente o
  efectos), modo (secuencial, aleatorio, simultáneo o botonera), fundido (segundos) y sus pistas.
- Cada pista: nombre, fuente (un archivo de audio del mundo o un enlace de YouTube), volumen (0–1), repetir y su
  duración (la mide el navegador del máster al añadirla; para YouTube, su reproductor).
- Los efectos son una botonera: cada pista, un botón; suena una vez (o en bucle si repite) por encima del ambiente.

### Lo que suena (de la campaña)

- El estado es de cada campaña, en el servidor: qué pistas suenan, desde qué hora del servidor, en qué segundo
  empezaron, volumen, en pausa o no. Se guarda (si el servidor se reinicia, sigue por donde iba).
- **Sincronía por el reloj del servidor**: cada aparato mide su desfase con el servidor al conectar (y cada pocos
  minutos), calcula dónde debería ir cada pista y salta ahí al entrar o si se desvía más de medio segundo (1,5 s en
  YouTube).
- **El servidor pasa de pista** (secuencial, aleatorio con su orden guardado) cuando se acaba según su duración, sin
  depender de que el máster siga conectado (en Foundry la lista se cuelga si se va).
- Pausar guarda el segundo según el reloj del servidor.

### En cada aparato

- Suena donde esté abierta una Mesa (máster o jugador) o la Pantalla de la campaña. Cada aparato con su volumen de
  ambiente y de efectos y su silencio, guardados en él (el máster puede silenciar su PC y dejar que suene la tele).
- **Desbloqueo**: mientras el navegador no deje sonar, «Activar sonido» a la vista (en la Pantalla, centrado y grande;
  en las Mesas, en la barra); un toque lo desbloquea para esa pestaña.
- Archivos: servidos con permiso (enlace firmado), por flujo si son largos; la siguiente pista se precarga.

### YouTube

- Con el reproductor de YouTube insertado (su API IFrame), **a la vista**: un recuadro pequeño (al menos 200×200 px,
  como piden sus normas) en una esquina de la Mesa y de la Pantalla mientras suena, que se puede mover y plegar a su
  tamaño mínimo, nunca esconder.
- Solo suenan los vídeos que dejan insertarse: si uno no (errores 101 y 150), al añadirlo se avisa y no se guarda; si
  deja de poder en partida, se salta y se avisa al máster.
- En el móvil, el sistema lo para al bloquear la pantalla: se avisa una vez.
- Los anuncios desfasan a quien los recibe: se corrige al acabar.

### En la Mesa del máster

- Un control «Sonido» en la barra de la Mesa: lo que suena ahora (con volumen, pausa, siguiente, fundido) y las listas
  del mundo para lanzar; la botonera de efectos, a mano. Preparar listas, en una ventana (o en la configuración del
  mundo).

### IA (MCP)

`ver_sonido` (listas y lo que suena), `poner_sonido` (una lista o una pista), `parar_sonido`, `volumen_sonido`,
`crear_lista_sonido` y `cambiar_lista_sonido`.

## Contratos (propuesta)

- Tablas `sound_playlists` (del mundo, con historial) y `sound_tracks`; estado en `campaign_sound` (jsonb con las
  pistas sonando: `trackId`, `startedAt` del servidor, `offset`, `paused`, `volume`, el orden aleatorio).
- Acciones de listas (crear, cambiar, borrar) y de reproducción (`playSound`, `stopSound`, `pauseSound`,
  `setSoundVolume`, `nextTrack`), todas `table.manage`.
- Canal de la mesa: `{ type: 'sound', state, serverNow }` al entrar y al cambiar; `{ type: 'time' }` para medir el
  desfase.
- Un reloj en el servidor por campaña que pasa de pista (como la caducidad de estados en combate, sin bucle activo:
  un temporizador por pista).

## Pruebas

- Unitarias: la posición esperada con desfase; el paso de pista (secuencial, aleatorio, repetir); la regla de
  corrección.
- Integración: lanzar, parar, pausar y seguir; el servidor pasa de pista sin nadie conectado; reiniciar y seguir; solo
  el máster; archivos firmados; el MCP.
- Web: el panel de sonido, la botonera, «Activar sonido», volúmenes del aparato, el recuadro de YouTube.
- e2e: el máster lanza una pista y la Pantalla la reproduce en el mismo segundo (con un margen); una Pantalla que
  entra tarde va por donde debe.

## Criterios de éxito

1. Dos aparatos con la misma pista van con menos de medio segundo de diferencia.
2. Quien entra tarde oye la pista por donde va, no desde el principio.
3. Una lista sigue avanzando con el máster desconectado.
4. Ningún jugador puede lanzar sonido aunque llame a la API.
