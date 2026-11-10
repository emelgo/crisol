# El registro de partida (Game Log) en D&D Beyond

Módulo de Crisol: 7. Sala de jugadores · Fecha: 2026-11-10 · Versión estudiada: la web en vivo del 2026-11-10

## Pregunta

Qué muestra el registro de las campañas (tiradas, mensajes de texto), con qué visibilidad (para mí, para el máster,
para todos), cómo se ve en el móvil y si Maps tiene algo de chat o presencia.

Lo ya sabido de Maps (quién está conectado, imágenes enseñadas, vista de espectador, registro de tiradas dentro de
Maps) está en `mapas.md` § 4 y § 5; las campañas y sus invitaciones, en `campanas-e-invitaciones.md`.

## Lo que hacen

Grado de certeza: **[O]** observado en vivo con la sesión de Enrique; **[P]** leído en el paquete público de la web
(el JavaScript del registro, descargado de su CDN, sin ejecutarlo aparte); **[I]** lo que dice su ayuda o se deduce.

### Cómo se estudió

- Una sonda propia (`playwright-core`, en el scratchpad) abrió el Chromium 156 con el perfil de Enrique en un Xvfb sin
  TCP. **Solo lectura**: paraba toda petición que no fuera GET, HEAD u OPTIONS y **todo WebSocket**; la única excepción
  fue la petición que da el pase de corta duración con el que la web lee el registro (no cambia nada de la cuenta). Se
  abrió una campaña, se pulsó el botón «Game Log» (solo abre un panel) y se miró en ancho de PC y de móvil (390 px).
- De la respuesta del registro solo se apuntaron los **nombres de los campos y sus valores posibles**, no su contenido.
  Las capturas se borraron al acabar. No se envió ningún mensaje ni tirada.

### Qué muestra

- **Solo tiradas** [O, P]: las 22 entradas guardadas de la campaña eran tiradas. El cliente del registro conoce cuatro
  clases de evento: tirada pendiente, rechazada y resuelta (los dados 3D ruedan antes de dar el resultado), y «la
  partida está en directo», que pone Maps al activar un mapa. **No hay mensajes de texto**: ni cuadro para escribir ni
  clase de evento para ello. La conversación va fuera (Discord, voz).
- **Cada entrada** [O]: retrato y nombre de quien tira (personaje, criatura o el máster), qué tiró (por ejemplo «Daga:
  para impactar», «Sabiduría: salvación», «Acrobacias: prueba», «Personalizada: tirada»), el total grande a la derecha,
  y debajo la fórmula y los dados (con el set de dados usado) al desplegar; fecha y hora. Los tipos que se vieron: tirada,
  salvación, daño, para impactar y prueba, con un color por tipo.
- **De dónde vienen** [I, ver `mapas.md`]: la hoja (web o app), el creador de encuentros, el bot de Discord y Maps.
- **Paginación** [O]: la web pide los mensajes de una partida por páginas, con una clave para seguir pidiendo los
  anteriores; las nuevas llegan por WebSocket (que la sonda no dejó abrir).

### Visibilidad

- **Tres destinos** [P]: «Todos» (la campaña), «Yo» y, para un jugador, «el máster». Es un ajuste **por defecto** del
  usuario (un desplegable «Enviar a (por defecto)» arriba del registro), que se aplica a sus tiradas.
- **En el dato** [O]: cada mensaje lleva su alcance (la partida o un usuario) y su destino (el id de la partida o el de
  un usuario). Lo que va a un usuario se pinta con un rótulo «A: YO» o «A: DM» según quién lo mire [P, O: se vieron
  tiradas «A: YO»].
- **Quién lo filtra** [I]: la petición del registro lleva el usuario; no se comprobó si el servidor esconde los mensajes
  ajenos dirigidos a otro usuario o si los esconde el navegador (no se puede probar sin escribir).

### En el móvil

- **El mismo panel** [O]: a 390 px el registro ocupa toda la pantalla como una columna, con las mismas tarjetas (retrato,
  nombre, tipo y total grande). No hay una versión distinta; el resto de la página queda tapado.
- La app del móvil y la hoja también lo abren como panel lateral [I].

### Maps

- **Chat**: no [I, ayuda y paquete]: Maps enseña el mismo registro de tiradas. **Presencia**: sí, quién está conectado y
  con qué personaje (`mapas.md` § 5), y un aviso de «en directo» en el registro al activar un mapa [P].

## Compromisos y límites

- **Un registro sin palabras**: muy limpio para tiradas y cómodo en el móvil, pero obliga a otra herramienta para hablar
  y para los susurros, y no guarda lo que se enseñó ni lo que pasó en la partida.
- **El destino es un ajuste que se queda puesto**: el mismo riesgo que en Foundry de dejarse una tirada en «solo yo».
- **Tarjetas grandes y legibles**: el total es lo primero que se ve; el detalle, desplegando.

## Qué nos llevamos a Crisol

- **Tarjetas de tirada como las suyas**: quién, qué y el total grande, el detalle plegado; en el móvil, el registro a
  pantalla completa con las mismas tarjetas.
- **Tres destinos sencillos** (todos, el máster, solo yo) con un rótulo claro en cada entrada privada; en Crisol se
  añaden los susurros a unos jugadores y el máster ve todo lo privado, marcado.
- **Lo que haremos distinto**: un solo registro de la partida con mensajes de texto, tiradas y lo que se enseña (Enrique
  quiere la conversación escrita dentro, aunque la voz vaya por Discord); el destino se elige por mensaje y vuelve a
  «todos»; el filtrado, siempre en el servidor.

## Fuentes

- Observación en vivo con la sesión de Enrique (solo lectura), 2026-11-10.
- El paquete público del cliente del registro en el CDN de D&D Beyond (game-log-client), 2026-11-10.
- `research/dndbeyond/mapas.md` (ayuda oficial de Maps y su registro de cambios).
