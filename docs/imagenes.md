# Imágenes de Crisol

Donde convenga una imagen **de la app**, Claude escribe el prompt y Enrique la genera a mano con ChatGPT, en su cuenta
(norma en `docs/diseno.md`). Son las de la app: los fondos de Entrar, la portada pública, el fondo de ambiente de Inicio
y las pantallas vacías. **Las portadas de mundos, campañas, sistemas y libros son del usuario**: no se generan.

Los prompts van en lenguaje natural, sin parámetros de otras herramientas, y dicen en la propia frase el tamaño y la
proporción. Primero se busca el estilo; luego, con el elegido, la guía y el resto de prompts.

## Buscar el estilo

**La dirección, de Enrique (2026-11-11): al estilo de Foundry VTT, Roliando o LegendKeeper.** Las tres usan la misma
familia, fantasía épica pintada, oscura y de cine, y cambian el tono: LegendKeeper, grandes paisajes luminosos; Foundry,
oscuridad con luz de fuego; Roliando, épica fría y desaturada bajo un velo oscuro. Por eso los seis candidatos son
variaciones dentro de esa familia, no estilos distintos. Los prompts no nombran ninguna app: describen el estilo.

Cada estilo, con **las mismas dos escenas**, para compararlos de tú a tú:

- **Entrar**: el paisaje de fondo de la pantalla de entrar (y de la portada pública). Va a pantalla completa, con el
  recuadro de entrar en el centro; por eso el centro de la imagen tiene que estar tranquilo y lo interesante, a los
  lados y abajo.
- **Vacío**: la ilustración de una pantalla vacía (Mis mundos sin ningún mundo, por ejemplo). Va pequeña, sobre el
  fondo de la app, en el tema oscuro y en el claro; por eso, con fondo transparente y los bordes deshaciéndose.

### Cómo generarlas

- **Una conversación nueva para cada imagen**, para que no se contagie el estilo de la anterior. Se pega el prompt tal
  cual; si ChatGPT pregunta algo, «hazla tal cual».
- **Entrar** es de **1536 × 1024 (3:2)**, el apaisado que ChatGPT hace bien; se recorta un poco arriba y abajo para
  llenar la pantalla. **Vacío** es cuadrada, de **1024 × 1024**, en PNG con fondo transparente; si sale con fondo,
  pedir «otra vez, con el fondo transparente».
- Nombres: `a-entrar.png`, `a-vacio.png`, `b-entrar.png`… (la letra del estilo). Se dejan en `datos-locales/estilos/`
  del VPS (fuera de git) o se pasan como sea más cómodo: con ellas, Claude monta una lámina que las enseña de verdad,
  detrás del recuadro de Entrar y en una pantalla vacía, en oscuro y en claro.

### Qué mirar al comparar

- ¿Se lee bien el recuadro encima? ¿Queda tranquilo el centro?
- ¿Casa con la app: grises neutros, la llama roja y naranja, el cristal?
- ¿La ilustración vacía queda bien en oscuro y en claro?
- ¿Aguanta 15 fondos seguidos sin cansar?

---

### A · Épica luminosa

Grandes paisajes de arte conceptual con luz dorada y escala enorme (el aire de LegendKeeper).

**A · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica, como el
> arte conceptual de una gran película, con una escala enorme, mucha profundidad, luz dorada de atardecer que atraviesa
> la bruma, cielos inmensos con nubes iluminadas y colores ricos pero naturales; pincelada visible en lo lejano y
> detalle nítido en lo cercano; tiene que parecer un cuadro pintado, no una foto ni un render en 3D. La escena: un
> valle de montaña al caer la tarde. A la izquierda, sobre un risco alto, una ciudadela de piedra con unas pocas
> ventanas encendidas. Un río ancho baja serpenteando desde el fondo, entre colinas, y refleja el último resplandor
> del cielo. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la derecha, un camino de tierra con dos
> viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser tranquilo, solo cielo abierto y niebla
> sobre el valle, sin nada que llame la atención, porque encima irá un recuadro de texto; lo interesante va a los
> lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los
> bordes.

**A · Vacío**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica,
> como el arte conceptual de una gran película, con luz dorada y cálida, colores ricos pero naturales y pincelada
> visible. Es una ilustración pequeña y aislada, sin escenario detrás: sobre una tabla de madera vieja, un libro grande
> abierto con las páginas en blanco, una pluma en su tintero, unos dados de rol de varias caras y un pequeño crisol de
> piedra con brasas encendidas que dan la luz. Todo agrupado en el centro, visto un poco desde arriba, y los bordes del
> dibujo se deshacen en pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin texto,
> letras, firmas ni marcas de agua.

---

### B · Oscuridad con luz de fuego

Oscura y dramática, con contraluz y el naranja del fuego contra azules fríos (el aire de Foundry VTT).

**B · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía oscura y
> dramática, con mucho contraste entre sombras profundas y la luz naranja del fuego contra azules y grises fríos,
> contraluz, humo y niebla en capas, y pincelada visible; tiene que parecer un cuadro pintado, no una foto ni un render
> en 3D. La escena: un valle de montaña al caer la noche. A la izquierda, sobre un risco alto, una ciudadela de piedra
> con unas pocas ventanas encendidas y el resplandor de una forja. Un río ancho baja serpenteando desde el fondo, entre
> colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la
> derecha, un camino de tierra con dos viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser
> tranquilo, solo cielo oscuro y niebla sobre el valle, sin nada que llame la atención, porque encima irá un recuadro
> de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin
> marco: la pintura llega hasta los bordes.

**B · Vacío**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía oscura
> y dramática, con mucho contraste entre sombras profundas y la luz naranja del fuego, y pincelada visible. Es una
> ilustración pequeña y aislada, sin escenario detrás: sobre una tabla de madera vieja, un libro grande abierto con las
> páginas en blanco, una pluma en su tintero, unos dados de rol de varias caras y un pequeño crisol de piedra con
> brasas encendidas que dan la única luz, con unas chispas y un hilo de humo. Todo agrupado en el centro, visto un poco
> desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la transparencia, sin rectángulo ni
> sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

---

### C · Épica fría y desaturada

De película, con colores apagados (azul acero, verde musgo, gris piedra) y un único acento cálido, como bajo un velo
oscuro (el aire de Roliando).

**C · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica con aire de
> fotograma de película, en colores fríos y apagados (azul acero, verde musgo, gris piedra) con un único acento cálido
> en las luces, bruma densa, luz suave y difusa, y un grano fino por encima; tiene que parecer un cuadro pintado, no
> una foto ni un render en 3D. La escena: un valle de montaña al caer la tarde. A la izquierda, sobre un risco alto,
> una ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja serpenteando desde el fondo, entre
> colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la
> derecha, un camino de tierra con dos viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser
> tranquilo, solo cielo abierto y niebla sobre el valle, sin nada que llame la atención, porque encima irá un recuadro
> de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin
> marco: la pintura llega hasta los bordes.

**C · Vacío**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> con aire de fotograma de película, en colores fríos y apagados (azul acero, verde musgo, gris piedra) con un único
> acento cálido, luz suave y un grano fino. Es una ilustración pequeña y aislada, sin escenario detrás: sobre una tabla
> de madera vieja, un libro grande abierto con las páginas en blanco, una pluma en su tintero, unos dados de rol de
> varias caras y un pequeño crisol de piedra con brasas encendidas, el único color cálido. Todo agrupado en el centro,
> visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la transparencia, sin
> rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

---

### D · Óleo de fantasía

La misma épica, pero pintada como un óleo: pincelada gruesa, veladuras y un barniz cálido. Más artesanal; casa con los
cuadros de dominio público de ahora.

**D · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura de fantasía épica hecha como un óleo
> sobre lienzo, con pincelada gruesa y visible, veladuras suaves, luz atmosférica de atardecer, cielo grande con nubes
> iluminadas y un barniz cálido algo envejecido; la naturaleza grandiosa y las figuras pequeñas. La escena: un valle de
> montaña al caer la tarde. A la izquierda, sobre un risco alto, una ciudadela de piedra con unas pocas ventanas
> encendidas. Un río ancho baja serpenteando desde el fondo, entre colinas, y refleja el último resplandor del cielo. A
> la derecha, la ladera de un bosque oscuro de pinos. Abajo a la derecha, un camino de tierra con dos viajeros
> diminutos con capa y un farol. El centro de la imagen tiene que ser tranquilo, solo cielo abierto y niebla sobre el
> valle, sin nada que llame la atención, porque encima irá un recuadro de texto; lo interesante va a los lados y en el
> tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

**D · Vacío**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura de fantasía hecha como un
> óleo sobre lienzo, con pincelada gruesa y visible, veladuras suaves y luz cálida. Es una ilustración pequeña y
> aislada, sin escenario detrás: sobre una tabla de madera vieja, un libro grande abierto con las páginas en blanco,
> una pluma en su tintero, unos dados de rol de varias caras y un pequeño crisol de piedra con brasas encendidas que
> dan la luz. Todo agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en
> pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de
> agua.

---

### E · Noche de luna

La misma épica, de noche: azules profundos, luna y estrellas, y luces cálidas en ventanas y faroles. La más tranquila,
buena para el recuadro y el cristal.

**E · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica de noche,
> con azules profundos y violetas, una luna grande entre nubes finas, estrellas, niebla plateada en el valle y pequeñas
> luces cálidas de ventanas y faroles; calma y mucho aire; tiene que parecer un cuadro pintado, no una foto ni un
> render en 3D. La escena: un valle de montaña de noche. A la izquierda, sobre un risco alto, una ciudadela de piedra
> con unas pocas ventanas encendidas. Un río ancho baja serpenteando desde el fondo, entre colinas, y refleja la luz
> de la luna. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la derecha, un camino de tierra con dos
> viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser tranquilo, solo cielo nocturno y niebla
> sobre el valle, sin nada que llame la atención, porque encima irá un recuadro de texto; lo interesante va a los
> lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los
> bordes.

**E · Vacío**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía de
> noche, con azules profundos, un poco de luz de luna fría y el calor de unas brasas. Es una ilustración pequeña y
> aislada, sin escenario detrás: sobre una tabla de madera vieja, un libro grande abierto con las páginas en blanco,
> una pluma en su tintero, unos dados de rol de varias caras y un pequeño crisol de piedra con brasas encendidas que
> dan la luz cálida. Todo agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en
> pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de
> agua.

---

### F · Pintura estilizada

La misma épica con formas más simples: grandes masas de color, pinceladas amplias y menos detalle, como el arte de un
videojuego de fantasía de estilo pintado. Envejece mejor y se repite sin cansar.

**F · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer contra sombras azuladas y una paleta armoniosa; nada
> realista ni fotográfico. La escena: un valle de montaña al caer la tarde. A la izquierda, sobre un risco alto, una
> ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja serpenteando desde el fondo, entre colinas,
> y refleja el último resplandor del cielo. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la derecha,
> un camino de tierra con dos viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser tranquilo,
> solo cielo abierto y niebla sobre el valle, sin nada que llame la atención, porque encima irá un recuadro de texto;
> lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.

**F · Vacío**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de
> color, pinceladas amplias y seguras, poco detalle menudo y luz cálida. Es una ilustración pequeña y aislada, sin
> escenario detrás: sobre una tabla de madera vieja, un libro grande abierto con las páginas en blanco, una pluma en su
> tintero, unos dados de rol de varias caras y un pequeño crisol de piedra con brasas encendidas que dan la luz. Todo
> agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la
> transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

## Guía de estilo: F, pintura estilizada

**Elegido por Enrique (2026-11-11)**: F. Su orden: F > A > C > D > B > E («todas me gustan si sabemos usarlas bien
según el contexto»). Todas las imágenes de la app van en F, para que se vean de la misma familia.

- **Las que faltan por hacer, en `docs/imagenes-por-hacer.md`** (Enrique, 2026-11-12: «para no liarme»); aquí queda la
  guía y el historial. **La frase base cambió el 2026-11-12**: la de abajo ponía la misma luz de atardecer (y hojas
  rojas) en todas; la nueva, en `imagenes-por-hacer.md`, deja que cada escena diga su luz.
- **La frase base** (la primera; ya no se usa):

> Una pintura digital de fantasía épica estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas
> simplificadas, grandes masas de color, pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de
> fuego contra sombras violetas y azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino
> apagado y algún toque granate; nada realista ni fotográfico.

- **La paleta**: violeta pizarra y azul en las sombras; naranja y ámbar en las luces; verde pino apagado; un toque
  granate, el rojo de la marca (un estandarte, una tela). Nada de neón, azules eléctricos ni colores chillones.
- **La luz**: siempre una fuente cálida (atardecer, fuego, farol, ventanas) contra sombras frías. Es lo que la ata a
  la llama de Crisol.
- **Los fondos** (Entrar, la portada pública): 1536 × 1024, apaisados, con el centro tranquilo para el recuadro y lo
  interesante a los lados y abajo. Figuras siempre diminutas, de espaldas o lejos.
- **Las pantallas vacías**: 1024 × 1024, PNG con fondo transparente, un bodegón pequeño de objetos de mesa de rol o de
  fragua, con los bordes en pinceladas sueltas.
- **Nunca**: texto, letras, runas legibles, firmas, marcas de agua, logotipos ni marcos; caras en primer plano o
  mirando a cámara; personajes, escudos o lugares reconocibles de otras obras; aspecto de foto o de render en 3D.

**Cómo se entregan**: una conversación nueva para cada una; nombres como `fondo-02-costa.png` o `vacio-mundos.png`, en
`datos-locales/imagenes/`. Al llegar, Claude las pasa a WebP (1920 y 1280 de ancho los fondos; 512 los vacíos), anota
el tinte medio de cada fondo y su origen en `docs/terceros.md` (generada con ChatGPT por Enrique, con la fecha).

### Fondos de Entrar

Van pasando, como ahora (doce a dieciséis). El primero ya está: el valle del ocaso (`f-entrar.png`).

**fondo-02-costa · La costa**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: unos acantilados altos junto al mar al atardecer. A la izquierda, en lo alto de un cabo, un
> faro de piedra encendido; abajo, las olas rompen contra las rocas. A la derecha, una cala con un barco de vela anclado
> y unas casas de pescadores con luz en las ventanas. El mar se abre hacia el horizonte, en calma. El centro de la
> imagen tiene que ser tranquilo (cielo, niebla o agua con pocas pinceladas, sin nada que llame la atención), porque
> encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni
> marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-03-bosque · El bosque antiguo**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: un bosque de árboles enormes y viejos, con raíces que salen de la tierra y musgo por todas
> partes. A los lados, troncos gigantes y los restos de unas columnas de piedra cubiertas de hiedra; en el centro, un
> claro con rayos de luz que bajan entre la niebla. Abajo a la izquierda, un sendero con un ciervo que mira desde lejos.
> El centro de la imagen tiene que ser tranquilo (cielo, niebla o agua con pocas pinceladas, sin nada que llame la
> atención), porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto,
> letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-04-puerto · La ciudad de las torres**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: una ciudad portuaria de torres altas y tejados apiñados, vista desde una colina al anochecer,
> con farolillos encendidos en las calles y en los muelles. A la derecha, barcos con las velas recogidas; a la
> izquierda, un templo con una cúpula. Sobre la bahía, un cielo amplio con las primeras estrellas. El centro de la
> imagen tiene que ser tranquilo (cielo, niebla o agua con pocas pinceladas, sin nada que llame la atención), porque
> encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni
> marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-05-cumbres · Las cumbres**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: unas montañas nevadas y escarpadas al caer la tarde. Muy lejos, a la derecha, un dragón
> pequeño vuela entre las cumbres. Abajo a la izquierda, en un saliente de roca, un campamento con una hoguera encendida
> y tres figuras diminutas sentadas alrededor. Entre las montañas, un mar de nubes. El centro de la imagen tiene que ser
> tranquilo (cielo, niebla o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro
> de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin
> marco: la pintura llega hasta los bordes.

**fondo-06-desierto · Las ruinas del desierto**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: un desierto de dunas suaves al anochecer, con la luna saliendo grande sobre el horizonte. A la
> izquierda, las ruinas de un templo colosal medio enterrado en la arena, con estatuas rotas. Abajo a la derecha, una
> caravana diminuta de camellos y viajeros con antorchas. El centro de la imagen tiene que ser tranquilo (cielo, niebla
> o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro de texto; lo interesante
> va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega
> hasta los bordes.

**fondo-07-garganta · El puente de piedra**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: una garganta profunda entre paredes de roca, cruzada por un puente de piedra antiguo. A la
> derecha, una cascada cae desde lo alto y levanta niebla. En el puente, dos viajeros diminutos con un farol. Al fondo,
> la garganta se abre a un valle lejano iluminado por el sol que se pone. El centro de la imagen tiene que ser tranquilo
> (cielo, niebla o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro de texto;
> lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.

**fondo-08-cienaga · La ciénaga**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: una ciénaga al crepúsculo, con árboles retorcidos y agua quieta que refleja el cielo. A la
> izquierda, una cabaña sobre pilotes con una ventana encendida y humo saliendo de la chimenea. Luciérnagas sobre el
> agua; abajo a la derecha, una barca pequeña atada a un poste. El centro de la imagen tiene que ser tranquilo (cielo,
> niebla o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro de texto; lo
> interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.

**fondo-09-lago · El lago helado**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: un lago helado de noche, con una aurora suave de colores en el cielo. A la derecha, en una
> isla, una torre solitaria con una luz cálida en lo alto. A la izquierda, pinos cubiertos de nieve; abajo, en la
> orilla, unas huellas en la nieve que llevan hacia el hielo. El centro de la imagen tiene que ser tranquilo (cielo,
> niebla o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro de texto; lo
> interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.

**fondo-10-islotes · Los islotes del cielo**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: unos islotes de roca que flotan en el cielo, con árboles y cascadas que caen de sus bordes y
> se deshacen en niebla. En el más grande, a la izquierda, unas ruinas con un arco de piedra. Abajo, muy lejos, un valle
> verde con un río. Aves volando entre los islotes. El centro de la imagen tiene que ser tranquilo (cielo, niebla o agua
> con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro de texto; lo interesante va a los
> lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los
> bordes.

**fondo-11-fragua · La gran fragua**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: una caverna inmensa excavada en la montaña, donde trabaja una fragua antigua: a los lados,
> yunques, cadenas y escaleras talladas en la roca; abajo, ríos de metal fundido que dan una luz naranja intensa. En el
> centro, la bóveda oscura de la cueva se pierde en humo y penumbra violeta. Figuras diminutas trabajando junto a un
> crisol enorme. El centro de la imagen tiene que ser tranquilo (cielo, niebla o agua con pocas pinceladas, sin nada que
> llame la atención), porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin
> texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-12-aldea · La aldea del valle**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: una aldea con tejados de paja, molinos y campos dorados en un valle suave, al final de la
> tarde. Un camino de tierra serpentea hacia el fondo, donde se alza la torre de un mago sobre una colina. Abajo a la
> izquierda, un carro tirado por un caballo; a la derecha, un roble grande. El centro de la imagen tiene que ser
> tranquilo (cielo, niebla o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro
> de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin
> marco: la pintura llega hasta los bordes.

**fondo-13-zigurat · La selva**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: una selva espesa entre la niebla, con un zigurat de piedra cubierto de lianas que asoma a la
> izquierda por encima de los árboles. A la derecha, una cascada entre helechos gigantes. Abajo, un río con una canoa y
> dos figuras diminutas. Luz dorada que atraviesa la bruma. El centro de la imagen tiene que ser tranquilo (cielo,
> niebla o agua con pocas pinceladas, sin nada que llame la atención), porque encima irá un recuadro de texto; lo
> interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.


#### Por qué cambió la frase base

Las primeras salieron todas con la misma luz (atardecer naranja contra sombras violetas) y con hojas rojas en las
esquinas: la frase base de antes pedía «luz cálida de atardecer o de fuego contra sombras violetas» y «algún toque
granate» en todas. Ahora la frase base solo fija la manera de pintar y una paleta contenida; **la luz la dice cada
escena**, y se piden sin hojas rojas.

**Frase base nueva** (va al principio de cada prompt):

> Una pintura digital de fantasía épica estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas
> simplificadas, grandes masas de color, pinceladas amplias y seguras, poco detalle menudo, una paleta armoniosa y
> contenida, sin colores chillones ni neón; nada realista ni fotográfico. Sin hojas rojas ni ramas que enmarquen la
> imagen por las esquinas.

#### Seis rehechos con otra luz (2026-11-12, ya en la app)

Las doce que hay ya están en la app. Para que no sean todas atardecer, estas seis se rehacen con otra luz; las otras
seis se quedan (bahía al anochecer, ciudad al atardecer, forja con fuego, desierto con luna, aurora de noche y valle
dorado). Cada una sustituye a la de su nombre sin tocar código.

**fondo-campamento · Amanecer frío en las cumbres**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, una paleta armoniosa y contenida, sin colores chillones ni neón; nada realista
> ni fotográfico. Sin hojas rojas ni ramas que enmarquen la imagen por las esquinas. La luz: un amanecer frío, cielo
> rosa pálido y celeste, la nieve azulada y las primeras luces doradas solo en las cumbres más altas; nada de naranja
> fuerte. La escena: unas montañas nevadas y escarpadas. Muy lejos, a la derecha, un dragón pequeño vuela entre las
> cumbres. Abajo a la izquierda, en un saliente de roca, un campamento con una hoguera que ya se apaga y tres figuras
> diminutas recogiendo. Entre las montañas, un mar de nubes. El centro de la imagen tiene que ser tranquilo (cielo o
> nubes con pocas pinceladas), porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de
> abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-ciervo · Mediodía en el bosque antiguo**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, una paleta armoniosa y contenida, sin colores chillones ni neón; nada realista
> ni fotográfico. Sin hojas rojas ni ramas que enmarquen la imagen por las esquinas. La luz: mediodía, verde y dorada,
> filtrada entre las copas en haces que bajan hasta el suelo; sombras verde azuladas. La escena: un bosque de árboles
> enormes y viejos, con raíces que salen de la tierra y musgo por todas partes. A los lados, troncos gigantes y los
> restos de unas columnas de piedra cubiertas de hiedra; en el centro, un claro con la luz que baja entre una niebla
> fina. Abajo a la izquierda, un sendero con un ciervo que mira desde lejos. El centro de la imagen tiene que ser
> tranquilo, porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto,
> letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-puente · Tormenta sobre la garganta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, una paleta armoniosa y contenida, sin colores chillones ni neón; nada realista
> ni fotográfico. Sin hojas rojas ni ramas que enmarquen la imagen por las esquinas. La luz: tormenta, cielo gris
> pizarra cargado de nubes, lluvia en cortinas y un rayo lejano que ilumina el valle del fondo; la única luz cálida, el
> farol de los viajeros. La escena: una garganta profunda entre paredes de roca, cruzada por un puente de piedra
> antiguo. A la derecha, una cascada cae desde lo alto y levanta niebla. En el puente, dos viajeros diminutos con un
> farol, encogidos bajo sus capas. El centro de la imagen tiene que ser tranquilo (cielo o niebla con pocas
> pinceladas), porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto,
> letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

**fondo-pantano · Mañana de niebla en la ciénaga**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, una paleta armoniosa y contenida, sin colores chillones ni neón; nada realista
> ni fotográfico. Sin hojas rojas ni ramas que enmarquen la imagen por las esquinas. La luz: primera hora de la mañana,
> niebla espesa gris azulada y un sol pálido y blanco que apenas atraviesa; verdes apagados y grises. La escena: una
> ciénaga con árboles retorcidos y agua quieta. A la izquierda, una cabaña sobre pilotes con humo saliendo de la
> chimenea y la ventana ya apagada; abajo a la derecha, una barca pequeña atada a un poste; unas garzas entre los
> juncos. El centro de la imagen tiene que ser tranquilo (niebla o agua con pocas pinceladas), porque encima irá un
> recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua,
> y sin marco: la pintura llega hasta los bordes.

**fondo-archipielago · Día claro entre los islotes**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, una paleta armoniosa y contenida, sin colores chillones ni neón; nada realista
> ni fotográfico. Sin hojas rojas ni ramas que enmarquen la imagen por las esquinas. La luz: un día claro, cielo azul
> con grandes nubes blancas, sol alto y sombras suaves. La escena: unos islotes de roca que flotan en el cielo, con
> árboles verdes y cascadas que caen de sus bordes y se deshacen en niebla. En el más grande, a la izquierda, unas ruinas
> con un arco de piedra. Abajo, muy lejos, un valle verde con un río. Aves volando entre los islotes. El centro de la
> imagen tiene que ser tranquilo (cielo con pocas pinceladas), porque encima irá un recuadro de texto; lo interesante va
> a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta
> los bordes.

**fondo-cascada · Mediodía en la selva**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, una paleta armoniosa y contenida, sin colores chillones ni neón; nada realista
> ni fotográfico. Sin hojas rojas ni ramas que enmarquen la imagen por las esquinas. La luz: mediodía tropical,
> luminoso, cielo azul entre la bruma húmeda y verdes intensos pero no chillones. La escena: una selva espesa, con un
> zigurat de piedra cubierto de lianas que asoma a la izquierda por encima de los árboles. A la derecha, una cascada
> entre helechos gigantes. Abajo, un río turquesa con una canoa y dos figuras diminutas. El centro de la imagen tiene
> que ser tranquilo (cielo o bruma con pocas pinceladas), porque encima irá un recuadro de texto; lo interesante va a
> los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta
> los bordes.

### La portada pública

La imagen de la portada (a toda pantalla, con la llama, una frase, «Entrar» y «Tengo una invitación» encima, en el
centro).

**portada**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: un grupo de cuatro aventureros diminutos, de espaldas, en lo alto de una colina junto a una
> hoguera, contemplando un valle inmenso al anochecer: a la izquierda, una ciudadela sobre un risco; a la derecha, un
> bosque oscuro y montañas; en el fondo, un río que brilla y, muy lejos, la silueta de un dragón sobre las cumbres. La
> hoguera, abajo a la derecha, da la luz más cálida de la escena. El centro de la imagen tiene que ser tranquilo y algo
> más oscuro (cielo de anochecer con pocas pinceladas), porque encima irán el nombre, una frase y dos botones; lo
> interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.

### El ambiente de Inicio

Detrás de Mis mundos (y, mientras no haya otras, de Plantillas, Etiquetas, Sistemas y Archivos), suave y algo tenue,
debajo del cristal (2026-11-12: el cristal se ve de verdad, así que el fondo ya no va casi borrado). Se ve nítido en los
márgenes (a los lados de la columna del centro) y desenfocado a través de las fichas y tarjetas de cristal: lo
interesante, a los lados y abajo; el centro, donde van las tarjetas, tranquilo. Al llegar, Claude la pasa a WebP (1920
de ancho) y sustituye a `apps/web/public/ambiente/inicio.webp`, sin tocar código.

**ambiente**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía épica estilizada,
> como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color, pinceladas
> amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y azuladas, y una
> paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada realista ni
> fotográfico. La escena: un valle amplio al anochecer visto desde lo alto, con un río que serpentea hacia el fondo y
> brilla con la última luz. A la izquierda, en un risco, las torres de una ciudadela con alguna ventana encendida; a la
> derecha, un bosque de pinos oscuro que sube por la ladera; abajo, en primer término, niebla baja entre las rocas y
> una hoguera diminuta. El centro de la imagen, de arriba abajo, tiene que ser tranquilo y algo más oscuro (cielo y
> niebla con pocas pinceladas), porque encima irán unas tarjetas; lo interesante va en los dos lados y en el tercio de
> abajo. Contraste moderado: nada muy claro ni muy brillante, ni blancos puros; la luz más fuerte, un naranja apagado.
> Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

### Pantallas vacías

Una para cada pantalla de Inicio que puede estar vacía. La del libro y el crisol (`f-vacio.png`) puede servir para
«Página nueva» o para el compendio.

**vacio-mundos · Mis mundos, sin ninguno**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Sobre una tabla de madera vieja, un mapa en blanco desenrollado, sujeto por una piedra, con
> una brújula de latón, una pluma en su tintero y una vela encendida. Es una ilustración pequeña y aislada, sin
> escenario detrás: todo agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en
> pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de
> agua.

**vacio-plantillas · Plantillas, sin ninguna**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Sobre una tabla de madera vieja, un molde de fundición de piedra, vacío y abierto, junto a un
> pequeño crisol con brasas encendidas y unas tenazas. Es una ilustración pequeña y aislada, sin escenario detrás: todo
> agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la
> transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

**vacio-etiquetas · Etiquetas, sin ninguna**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Sobre una tabla de madera vieja, un manojo de etiquetas de pergamino en blanco atadas con un
> cordel rojo, con un sello de lacre y una pluma. Es una ilustración pequeña y aislada, sin escenario detrás: todo
> agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la
> transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

**vacio-sistemas · Sistemas, sin ninguno**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Sobre una tabla de madera vieja, un libro de reglas cerrado con cierres de latón, unos dados
> de rol de varias caras y un reloj de arena pequeño. Es una ilustración pequeña y aislada, sin escenario detrás: todo
> agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la
> transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

**vacio-capitulos · Un libro sin capítulos** (tanda 7, ya en la app)

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Sobre una tabla de madera vieja, un libro grande abierto con las páginas en blanco, dos cintas
> de marcapáginas colgando, una pluma apoyada en el pliegue y un tintero a su lado, junto a una vela encendida. Es una
> ilustración pequeña y aislada, sin escenario detrás: todo agrupado en el centro, visto un poco desde arriba, y los
> bordes del dibujo se deshacen en pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin
> texto, letras, firmas ni marcas de agua.

**vacio-archivos · Archivos, sin ninguno**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Un baúl de madera con herrajes, abierto y vacío, con un par de pergaminos enrollados apoyados
> a su lado y un farol encendido. Es una ilustración pequeña y aislada, sin escenario detrás: todo agrupado en el
> centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la transparencia,
> sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

**vacio-historial · Historial, sin nada**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Un libro de registro grande y cerrado, con un marcapáginas de cinta roja, junto a un reloj de
> arena con toda la arena abajo y una vela recién apagada con un hilo de humo. Es una ilustración pequeña y aislada, sin
> escenario detrás: todo agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en
> pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de
> agua.

**vacio-papelera · Papelera, vacía**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Un brasero de hierro apagado, con cenizas grises y frías y una última brasa pequeña que
> todavía brilla. Es una ilustración pequeña y aislada, sin escenario detrás: todo agrupado en el centro, visto un poco
> desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la transparencia, sin rectángulo ni
> sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

**vacio-sin-resultados · Sin resultados al buscar**

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Un farol encendido sobre un mapa antiguo sin marcas, con una lupa de latón a su lado, y la
> luz del farol que se pierde en la penumbra. Es una ilustración pequeña y aislada, sin escenario detrás: todo agrupado
> en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en pinceladas sueltas hacia la
> transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de agua.

**vacio-calendarios · Calendarios, sin ninguno** (módulo 8, ya en la app)

> Haz una imagen cuadrada de 1024 × 1024 píxeles, en PNG con fondo transparente: una pintura digital de fantasía épica
> estilizada, como el arte de un videojuego de fantasía de estilo pintado: formas simplificadas, grandes masas de color,
> pinceladas amplias y seguras, poco detalle menudo, luz cálida de atardecer o de fuego contra sombras violetas y
> azuladas, y una paleta armoniosa de violeta pizarra, naranja y ámbar, verde pino apagado y algún toque granate; nada
> realista ni fotográfico. Un astrolabio de latón junto a un almanaque cerrado con cintas de colores, dos pequeñas lunas
> de cristal (una plateada y otra cobriza) sobre un soporte y una vela encendida. Es una ilustración pequeña y aislada,
> sin escenario detrás: todo agrupado en el centro, visto un poco desde arriba, y los bordes del dibujo se deshacen en
> pinceladas sueltas hacia la transparencia, sin rectángulo ni sombra de fondo. Sin texto, letras, firmas ni marcas de
> agua.
