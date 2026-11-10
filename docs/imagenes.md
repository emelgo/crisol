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

## Guía de estilo

Cuando Enrique elija: la frase base del estilo, la paleta, lo que nunca sale y el resto de prompts (fondos de Entrar,
la portada pública, el ambiente de Inicio y las pantallas vacías).
