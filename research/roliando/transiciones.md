# Transiciones y animaciones de Roliando

Módulo de Crisol: interfaz (movimiento) · Fecha: 2026-11-10 · Versión estudiada: roliando.com, interfaz «Tinta» (0.1,
del 2026-11-06)

## Pregunta

Enrique quiere el movimiento de Roliando: al entrar, al cambiar de pantalla, el carrusel de tarjetas del Taller (la del
centro se agranda y se ilumina), los menús y las ventanas. Para cada efecto: qué se mueve, cuánto dura, con qué curva y
qué lo dispara, descrito para rehacerlo a nuestra manera (sin su CSS ni su código).

**Cómo se midió.** Con el navegador de Playwright y la cuenta de prueba: estilos calculados de los elementos, la lista
de animaciones en curso de la página y un registro de cada animación y transición que empezaba (nombre, elemento,
duración, retardo y curva) mientras se hacía clic. Las animaciones hechas por script se capturaron igual. Lo de abajo
son medidas reales, redondeadas.

## Lo que hacen

### Un sistema de movimiento con nombre

Todo sale de un juego pequeño de **duraciones y curvas con nombre**, que se reutiliza en toda la app:

| Duración | Para qué |
|---|---|
| 80 ms | Respuesta instantánea (resaltar al pasar, pulsar) |
| 140 ms | Un toque: botones, flechas, menús |
| 150 ms | Salidas (siempre más cortas que las entradas) |
| 220 ms | Base: velos, paneles laterales, puntos del carrusel |
| 380 ms | Trazar un subrayado a pincel |
| 400 ms | Cambio de escena: telón, contenido que entra |
| 480 ms | «Muelle»: el carrusel y lo que debe sentirse físico |
| 1,1 s | Vuelta del indicador de carga |
| 14 s | Zoom lento de la ilustración destacada |

| Curva | Forma aproximada | Uso |
|---|---|---|
| «Tinta» | Sale muy rápido y frena largo (como `cubic-bezier(.22, 1, .36, 1)`, un «ease-out» fuerte) | La de casi todo lo que entra |
| «Toque» | Salida rápida con frenada suave (≈ `.2, .8, .2, 1`) | Pulsar y pasar por encima |
| «Sello» | Frenada aún más larga (≈ `.25, 1, .5, 1`) | Puntos y marcas que cambian de estado |
| «Pincel» | Lenta–rápida–lenta (≈ `.7, 0, .2, 1`) | Brillos que barren |
| «Sale» | Acelera al irse (≈ `.4, 0, .9, .6`) | Cerrar ventanas y menús |
| «Muelle» | Muelle con un rebote de apenas un 2 % y asentamiento suave, escrito como curva por tramos | El carrusel |

Y dos umbrales de carga: un indicador **no aparece si la espera dura menos de 0,2 s** y, si aparece, **se queda al
menos 0,4 s** para no parpadear (0,3 y 0,6 s al arrancar la app). Los avisos duran 5,2 s y los que tienen «deshacer»,
8 s. Los escalonados van de 50 ms por bloque y 30 ms por fila.

**Movimiento reducido, dos veces**: respetan la preferencia del sistema (más de ochenta bloques de estilo la atienden) y
además tienen un **modo «quieto» propio de la app**, que cambia los desplazamientos por fundidos de 120 ms, para el
parallax y no dibuja los subrayados.

### 1. Al entrar (pantalla de cuenta y arranque)

- **Arranque en frío**: fondo verde muy oscuro con el emblema dorado y el nombre en el centro, con un halo suave; luego
  aparece la cabecera y un **esqueleto** (líneas finas) con un **brillo que barre** de izquierda a derecha en 2,6 s con
  curva «pincel», cuatro veces como mucho.
- **«Entrar»**: el lema de la izquierda y la columna del formulario **suben 10 px y aparecen** en 0,6 s con una curva de
  frenada fuerte; la columna sale **80 ms después** que el lema. Detrás, la ilustración a pantalla completa, quieta.
- **Inicio (tras entrar)**: la cabecera se funde (220 ms), el telón de fondo aparece (400 ms, «tinta») y entonces se
  dibuja la **rama**: un tronco a pincel que **crece de abajo arriba** (se descubre con un recorte) en 0,56 s; de él
  **cuelgan las campañas** como rombos que caen 14 px desde arriba, girando de −6° a 0° y apareciendo, en 0,4 s, la
  primera a los 0,24 s y cada una 50 ms después. Pasar por encima de un rombo lo crece al 104 % y lo ladea −2°.
- **La portada pública** (sin cuenta): **ascuas** que suben despacio por toda la pantalla (doce partículas de 2 px que
  aparecen, suben tres cuartos de la altura con una deriva lateral propia y se apagan, de 9 a 16 s cada una, en bucle);
  la imagen de cada sección se **desliza en vertical al ritmo del desplazamiento** (parallax ligado al scroll, ±7 % con
  la imagen al 114 %); y los bloques **suben 70 a 120 px y aparecen** según entran en pantalla, también ligados al
  scroll (no a un tiempo), con un filete que se extiende de 0 a ancho completo bajo los números de sección.

### 2. Al cambiar de pantalla

No hay deslizamiento de página entera. El cambio se nota por cuatro cosas a la vez:

- Un **indicador de navegación**: una franja corta y clara que **barre de lado a lado** del borde superior en 1,1 s,
  lenta–rápida–lenta, en bucle mientras carga.
- El **telón de fondo** de la sección (una ilustración a pantalla completa, un poco más grande que la ventana para que
  quepa el parallax) **se funde** a la nueva en 400 ms con curva «tinta».
- El contenido aparece como **esqueleto con brillo** si tarda más de 0,2 s.
- En la barra de arriba, la sección activa tiene detrás una **mancha de pincel** de color crema; al cambiar, la mancha
  aparece en la nueva sección con un recorte rapidísimo (80 ms) y el enlace se hunde un pelo al pulsarlo.

Los paneles laterales entran **desde 12 px a la derecha con fundido** en 220 ms; los títulos de página llevan un
**subrayado a pincel** debajo.

### 3. El carrusel del Taller (la tarjeta del centro)

Es el efecto que más le gustó a Enrique. Diez columnas altas en fila; la del centro es la activa.

- **Las de los lados**: al **90 %** de tamaño, **desaturadas** (una capa gris en modo «saturación» al 75 %) y **apagadas**
  (un velo oscuro al 40 %); el velo degradado de abajo es más ligero y solo se ve el icono y el nombre.
- **La del centro**: a **tamaño completo**, con **todo su color** (las dos capas se van a 0), un velo degradado más
  denso abajo para leer, el título más grande, y debajo **lo último tocado**, «Ver todos» y «Crear».
- **Al cambiar de columna** (flechas, puntos, teclado, arrastrar o clic en una lateral), en el mismo instante:
  - la **pista entera se desplaza** para centrar la nueva, y cada columna **escala** 0,9 ↔ 1, ambas en **480 ms con el
    muelle** (llega, se pasa un 2 % y vuelve);
  - el gris y el velo oscuro **se funden** en 480 ms con curva «tinta» (la nueva se colorea, la vieja se apaga);
  - el **punto** del indicador de abajo (rombos) crece al 135 % y se rellena en 220 ms con curva «sello»;
  - la ilustración de la activa empieza un **zoom lento** («Ken Burns»): de 104 % a 116 % subiendo un 2 %, en **14 s**,
    y se queda ahí;
  - a los **160 ms**, el bloque de abajo (lista, «Ver todos», «Crear») **sube 10 px y aparece** en 400 ms;
  - a los **200 ms**, el **subrayado a pincel** del título **se traza de izquierda a derecha** en 380 ms.
- **Al pasar el ratón**, la ilustración de cada columna se desplaza unos píxeles siguiendo al puntero (parallax dentro de
  la tarjeta, 480 ms de suavizado). El zoom lento solo se activa con ratón; en táctil no.
- **Arrastrar** quita la transición (la pista sigue al dedo) y al soltar vuelve el muelle. **Con teclado** no hay
  transición ni trazo: cambia al momento.
- Las flechas se hunden 1 px y bajan al 98 % al pulsarlas (140 ms).
- Por debajo de 1100 px de ancho no hay carrusel: rejilla de tarjetas, sin escalas ni grises.

### 4. Menús

- **Abrir**: el menú **aparece desde el 92 % de tamaño** con fundido, en **140 ms**, con curva «tinta»; crece desde el
  botón que lo abre (su origen está en ese punto).
- **Cerrar**: sin movimiento apreciable (se va al momento).
- **Pasar por una opción**: aparece detrás una **mancha de pincel** al 10 % (14 % la activa) en 140 ms; pulsar la hunde
  1 px y la baja al 98 %.
- Los separadores son trazos de pincel finos, no líneas.

### 5. Ventanas y diálogos

- **Abrir**: el **velo** oscuro de detrás (negro al 72 %) **se funde** en 220 ms; la ventana aparece ya en su sitio, sin
  zoom (no se midió animación de entrada en la superficie).
- **Cerrar**: la ventana **se funde y encoge al 98 %** en **150 ms** con la curva de salida (acelera al irse), y el velo
  se va en 150 ms.
- Las ventanas flotantes (entrada del compendio, compartir) se pueden **minimizar, anclar y redimensionar**; su cabecera
  lleva un subrayado a pincel que se marca más cuando la ventana está al frente.
- Cuando el cuerpo de una ventana tiene scroll, el borde de abajo **se difumina** (una máscara de degradado ligada al
  desplazamiento) para indicar que hay más.

### 6. Pequeños gestos que dan carácter

- **Todo lo pulsable se hunde**: 1 px abajo y 98 % de tamaño al pulsar.
- **Resaltes a pincel** en vez de fondos planos: el elemento activo de una lista lateral, la pestaña elegida, los
  botones principales (una pincelada crema con bordes irregulares) y los subrayados de los títulos son máscaras de
  trazos de pincel.
- **Indicador de carga**: un **ensō** (círculo a pincel) que gira en 1,1 s.
- **Retratos «vivos»** de los usuarios (adornos de pago): latido al 104,5 %, flotar, pulso de opacidad, brasas, halo,
  giro de prisma, ascuas que suben, polvo que destella… todos lentos y en bucle.
- En la mesa (no medido a fondo): golpes con un **zoom de 112 % a 100 %**, **temblor** de pantalla, números que **suben
  y se desvanecen** sobre la ficha, y escenas de inmersión que «respiran» con un zoom lento.

## Compromisos y límites

- **Ganan coherencia**: pocas duraciones y curvas con nombre, salidas más cortas que entradas, nada de rebotes salvo un
  muelle muy contenido, y todo reducible. La sensación de «tinta y pincel» viene más de las **máscaras de pincel** y del
  orden de las cosas (color, luego texto, luego trazo) que de movimientos grandes.
- **El zoom de 14 s** solo se nota si uno se queda mirando; da vida sin distraer.
- **Las ventanas no animan al abrir**: se sienten inmediatas, pero el contraste con los menús (que sí crecen) es un poco
  incoherente.
- Hay mucho efecto decorativo (ascuas, retratos animados) que cuesta en móviles; lo compensan con el modo «quieto».

## Qué nos llevamos a Crisol

Las que más valen la pena, en orden:

1. **El carrusel con la tarjeta del centro destacada**: laterales al 90 %, desaturadas y apagadas; la central a tamaño
   completo y en color; al cambiar, desplazamiento y escala con un **muelle de 480 ms con un 2 % de rebote**, color en
   480 ms, contenido que sube a los 160 ms y subrayado que se traza a los 200 ms; zoom lento de 14 s en la imagen. Sirve
   para elegir **mundo, campaña o sistema** en Crisol, o para un «Crear» con tarjetas.
2. **Un juego de tokens de movimiento propio** en `docs/diseno.md` (si Enrique lo aprueba): cinco o seis duraciones y
   cuatro curvas con nombre, salidas más cortas que entradas, y los dos umbrales de carga (**no enseñar nada si tarda
   menos de 0,2 s; si se enseña, 0,4 s como mínimo**).
3. **Cambio de pantalla por telón**: fundido de la ilustración de fondo en 400 ms, franja de carga arriba y esqueleto
   con brillo, sin deslizar la página entera. Encaja con los fondos de «Entrar» que ya tiene Crisol.
4. **Entrada escalonada** al llegar a Inicio: lo principal crece (un recorte de abajo arriba, 0,56 s) y los elementos
   **caen y se enderezan** (14 px, −6°, 0,4 s) uno tras otro cada 50 ms. En Crisol, para las campañas o los mundos de
   la portada.
5. **Menús que crecen desde su botón** (92 % → 100 %, 140 ms) y **ventanas que se van encogiendo al 98 %** (150 ms,
   curva que acelera); velo en 220 ms. Nosotros sí animaríamos también la entrada de la ventana (96–98 % → 100 %, unos
   200 ms) para que case con los menús.
6. **Pulsar hunde** (1 px y 98 %) y **resaltes con forma de trazo** en lugar de fondos planos, con el estilo de Crisol
   (no hace falta que sea pincel).

Lo que haremos distinto: hacerlo con las transiciones de vista nativas donde convenga (cambio de pantalla, la tarjeta
que se abre en su página), con CSS y no con animaciones por script, y con el modo de movimiento reducido desde el
principio (preferencia del sistema, y un ajuste propio si hace falta). Sin ascuas ni retratos animados.
