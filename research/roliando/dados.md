# Los dados en Roliando

Módulo de Crisol: 3 (dados) · Fecha: 2026-11-10 · Versión estudiada: roliando.com, mesa de la demo pública sin cuenta
(`/demo`, interfaz «Tinta»), con three.js r184 en el paquete

## Pregunta

Enrique quiere que los dados de Crisol vayan más fluidos. Qué hace Roliando entre pulsar y ver el número, qué dibuja la
animación, si la física es real, cuánto tarda cada fase, a cuántos fotogramas va, y qué hay de crítico, visibilidad,
historial, repetir y aspectos de dados.

**Cómo se estudió y sus límites.** No se pudo entrar con la cuenta de prueba: el clasificador de permisos de esta sesión
bloqueó leer las credenciales del `.env`. Todo sale de la **demo pública** (una mesa entera de 5e que vive en el
navegador, sin servidor: «la partida se guarda en este navegador y en ningún otro sitio»). Se midió con el navegador de
Playwright: un registro de fotogramas con `requestAnimationFrame`, `PerformanceObserver` de «longtask», cuenta de
llamadas de dibujo WebGL por fotograma, mensajes entre la página y sus workers, y la red. **El VPS no tiene GPU**: Chrome
dibuja WebGL por software (SwiftShader). Eso decide qué se pudo medir, como se ve abajo. Marcas: **[medido]**,
**[visto]**, **[deducido]**.

## Lo que hacen

### Tres maneras de enseñar una tirada

| Modo | Cuándo | Qué se ve |
|---|---|---|
| **Dados 3D** | Ajuste de mesa «Dados 3D en la mesa» encendido (por defecto) y una GPU que lo aguante | Dados con física sobre toda la pantalla [visto] |
| **Ruleta** | Con los dados 3D encendidos pero **una GPU floja o por software** | Una tira de números que corre tras una ventanita, como una tragaperras, una por dado [visto, medido] |
| **Nada** | Dados 3D apagados | El número sale al instante en el aviso y en el chat [medido] |

- **Detectan la GPU** al cargar: crean un lienzo WebGL de prueba, leen el nombre del renderizador y, si es por software,
  caen a la ruleta y guardan que ya avisaron al usuario (una sola vez) [medido]. Al disfrazar el renderizador como una
  GPU de verdad (solo para medir), la app pasó a los dados 3D [medido].
- Además, por tipo de tirada se puede apagar la animación: ataque, daño, salvación, prueba e iniciativa, cada uno con su
  interruptor [visto].

### La ruleta (lo que ve una máquina floja)

- Al pulsar, la ruleta aparece **en 20–30 ms** arriba en el centro del mapa (una caja de unos 280 × 80 px con la ventana
  enmarcada) [medido, 6 tiradas].
- La tira se desplaza con una sola animación CSS de `transform` de **1,5 s** con una curva que sale disparada y frena muy
  largo (≈ `cubic-bezier(.1, .85, .2, 1)`): casi todo el recorrido ocurre en el primer tercio [medido].
- Al aterrizar, la ventana y la cifra cambian de color en 220 ms con su curva «Tinta» [medido].
- **El número sale en el aviso a los 1,52–1,56 s** (justo al aterrizar) y en el chat a los 1,62–1,77 s [medido, 6 tiradas].
- Con 10d6 hay **diez ruletas** a la vez, en dos columnas [visto].
- Fluidez: la animación va en el compositor (solo `transform`), así que el hilo principal puede ir lento sin que la tira
  dé tirones. El hilo principal marcó **37–41 fps** durante la ruleta (en reposo, 52–60) y **una tarea larga de 70–195 ms
  justo al aterrizar**, cuando se escribe la tirada en el chat y el registro [medido, 3 + 3 tiradas].

### Los dados 3D

- **Son Dice So Nice**, el módulo de dados de Foundry, metido en la web: la red pide sus texturas, sus mapas PBR, un
  entorno HDR, sus sonidos de choque, y las texturas de otro módulo de temas de dados; en la página aparece un
  «shim» con su nombre [medido]. Dice So Nice se distribuye con licencia **AGPL** (según su ficha pública; no se leyó su
  repositorio) [deducido].
- **Carga**: al abrir la mesa ya se baja un módulo pequeño de «arena de dados» (5 kB); el grueso (three.js, la arena,
  colores) **se baja en la primera tirada 3D**, junto con unas veinte texturas de temas, el HDR y los sonidos [medido].
- **Lienzo**: uno a pantalla completa (1280 × 800 en la prueba), sin recibir clics, por encima del mapa [medido].
- **Física en un worker** propio: la página le manda, por dado, «crea la forma», luego la lista de dados con
  posición, velocidad y giro iniciales, y después «simula la tirada» con un paso de 1/60 s; el worker devuelve **todo el
  recorrido de una vez** en búferes binarios (posiciones y cuaterniones), más la lista de choques para los sonidos [medido].
  Es decir: **física real precalculada y reproducida**, igual que Crisol [deducido de los mensajes].
- La simulación de 1d20 tardó **300–390 ms** desde el «simula» hasta la respuesta, con el hilo principal ahogado por el
  dibujo por software (sin él sería menos) [medido].
- Con 10d6 son **diez idas y vueltas «crea la forma»**, una por dado y cada una esperando al hilo principal, antes de
  simular: con la página cargada eso sumó varios segundos [medido]. Bien hecho, sería una sola petición [deducido].
- **Fluidez medida (por software, no representativa)**: 1–2 fps, fotogramas de 0,8–1,9 s, unas 85 llamadas de dibujo por
  fotograma a 1280 × 800 y unas 18 a 640 × 420; el aviso con el número llegó a los **4,4–7,9 s** [medido, 3 tiradas a cada
  tamaño]. Con una GPU de verdad no se pudo medir aquí. Por eso mismo ellos caen a la ruleta: con SwiftShader son
  inservibles [deducido].

### Lanzar

- **Ventana «Dados»** flotante (se mueve, se minimiza, se ancla) con dos pestañas [visto]:
  - **«De tu ficha»**: buscador y filtros (Acciones, Objetos, Pruebas, Todo) con la lista de pruebas, salvaciones y
    acciones del personaje; un clic tira [visto].
  - **«Tirada libre»**: cantidad y bonificador con ±, fórmula escrita (con ejemplo debajo), botones d2, d4, d6, d8, d10,
    d12, d20, d100 y dF (**un clic en el dado tira al momento**; el «+» de al lado lo añade a la fórmula), Normal / Ventaja
    / Desventaja y «Solo para mí» [visto]. La fórmula libre no aceptó mezclar dados (`2d20+1d8`: «No entiendo esa
    fórmula») [visto].
- **Barra de acciones** abajo, con el retrato, PG, CA y acciones en ranuras numeradas (pestañas Ataques, Objetos,
  Recursos, Utilidad, Pruebas) [visto].
- **Chat**: `/tira` o `/r` con fórmula o con una prueba de la ficha (`/r sab`); `/yo` para narrar; sugerencias al escribir
  «/» [visto]. Los dobles corchetes se ven como una ficha de dados dentro del mensaje, pero no se pudo pulsar [visto].
- **Ataques con objetivo**: al pulsar un arma, «toca el objetivo en el mapa», y sobre cada objetivo posible sale su CA y la
  **probabilidad de acertar** («CA 16 · 55 %»); si está lejos, pregunta si moverse hacia él gastando movimiento [visto].
- **Iniciativa**: al empezar el combate tira sola la de las criaturas y avisa de que los jugadores tiran la suya
  («Tirando por 7 criaturas; 4 jugadores tiran la suya») [visto].

### El resultado

- **Aviso** abajo a la derecha: el total grande en una mancha de tinta, la fórmula al lado y una ×; sale al aterrizar
  [visto, medido].
- En ataques, el aviso ya trae el desenlace: «23 · Bruenna: Gran hacha → Osgo · ACIERTA contra CA 16»; el daño, en otro
  aviso, y otro más con lo restado («−12 cortante a Osgo»), más un número flotante sobre la ficha [visto].
- **Crítico**: la palabra en el aviso y en el chat («CRÍTICO»; el 1 natural, «PIFIA») [visto].
- **Chat**: cada tirada es un mensaje con quién, fórmula, total y los dados, y un «Detalle» plegado con la cuenta; filtros
  arriba de «Mensajes» y «Tiradas» con su recuento [visto]. El ataque es una **tarjeta** con arma → objetivo, CA, «Si
  acierta: 1d12+3 cortante», los pasos «Ataque — Daño — Aplicado» y «Golpea a Osgo · 12 cortante» [visto].
- Menú de cada mensaje: copiar, ver ficha, «tarjeta de tirada», marcar como no leído, borrar. **No hay «repetir»** en el
  mensaje [visto].
- **Visibilidad**: en la ventana solo se vio «Solo para mí»; en los ajustes de sonido hay «silenciar tiradas secretas»
  [visto]. Lo que ven los demás no se pudo comprobar sin una segunda cuenta.

### Aspectos de dados (Taller)

Ya descrito con cuenta en `crear-y-compatibilidad.md` (estudio de pintura por cara, acabados, efecto de tirada, «Probar en
3D», guardar de pago, importar temas de Dice So Nice). Hoy no se pudo volver a abrir. Lo nuevo: la primera tirada 3D baja
**todas** las texturas de temas aunque se use una sola [medido].

## Compromisos y límites

- Ganan mucho al **no fiarlo todo al 3D**: detectar la GPU y caer a algo barato hace que en un portátil flojo la tirada
  sea instantánea y suave, y el número salga a 1,5 s fijos.
- La ruleta, con 1,5 s fijos y una curva que frena largo, **se siente rápida** porque casi todo el movimiento pasa en los
  primeros 400 ms.
- Usar Dice So Nice les da temas y acabados de serie, pero cargan mucho en la primera tirada (three.js, HDR, veinte
  texturas, sonidos) y arrastran su licencia **AGPL** (copyleft).
- La conversación con el worker por dado (crear forma, esperar, siguiente) es lenta con muchos dados y con el hilo
  principal ocupado.
- La escritura en el chat al aterrizar provoca una tarea larga (hasta 195 ms) justo cuando el ojo mira el resultado.

## Qué nos llevamos a Crisol

Cómo va Crisol hoy (`apps/web/src/dice/`): al pulsar, el lanzador **espera la respuesta del servidor** (`rollDice`); con
ella, la bandeja **carga three.js y la escena la primera vez**, el worker **simula la tirada entera** (hasta 720 pasos de
1/120 s) y solo entonces empieza la reproducción (hasta 2,5 s); el número sale al parar. La escena usa sombras de 2048 px
suaves, antialias, tono ACES y hasta 2× de densidad, siempre, sin mirar la GPU. La física y la reproducción interpolada
ya son buenas; lo que se nota es la **espera antes de que se mueva nada** y el coste en máquinas flojas.

Cambios concretos, de más a menos efecto:

1. **Simular a la vez que se pregunta al servidor.** El cambio de números (relabel) solo necesita la cara final, así que
   el worker puede empezar en el clic con los dados de la fórmula y, cuando llegue el resultado, renumerar y arrancar. La
   espera pasa a ser «la mayor de las dos» en vez de «la suma».
2. **Calentar en reposo.** Al entrar en la campaña, con `requestIdleCallback`: importar la escena, crear el worker y sus
   formas, compilar los materiales (`renderer.compile`) y preparar las texturas de caras del color del jugador. Así la
   primera tirada no paga la carga (Roliando la paga y se nota).
3. **Calidad según la máquina**, como ellos: mirar el renderizador y medir los primeros fotogramas; en una GPU floja,
   densidad 1×, sombras sencillas o ninguna y sin antialias, y en una por software, una alternativa 2D (una ruleta o los
   dados planos) en vez de 3D. Hoy Crisol trata igual un móvil viejo que un PC de juegos.
4. **Movimiento visible en menos de 50 ms.** Que algo se mueva en el clic (el dado «sale de la mano» o la bandeja se
   ilumina) aunque la simulación aún no esté; y acortar la tirada a ~1,5–1,8 s con la frenada larga, que es lo que hace
   que la ruleta se sienta rápida.
5. **Detalles de coste**: devolver el recorrido del worker en `Float32Array` transferibles (hoy son objetos por
   fotograma), y escribir el registro y el historial **después** de que el número esté en pantalla (un `setTimeout` o
   `requestIdleCallback`), para que la tarea larga no caiga en el aterrizaje.

Además, para el lanzador: la **probabilidad de acertar sobre cada objetivo** al elegirlo, y que **un clic en un dado tire
al momento** mientras el «+» lo añade a la fórmula. **No** traer Dice So Nice ni su código: es AGPL (norma del proyecto).
