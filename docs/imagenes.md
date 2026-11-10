# Imágenes de Crisol

Donde convenga una imagen, Claude escribe el prompt y Enrique la genera a mano con ChatGPT, en su cuenta (norma en
`docs/diseno.md`). Los prompts van en lenguaje natural, sin parámetros de otras herramientas, y dicen en la propia
frase el tamaño y la proporción. Primero se busca el estilo; luego, con el elegido, la guía y el resto de prompts.

## Buscar el estilo

Seis estilos candidatos, cada uno con **las mismas dos escenas**, para compararlos de tú a tú:

- **Entrar**: el paisaje de fondo de la pantalla de entrar. Va a pantalla completa, con el recuadro de entrar en el
  centro; por eso el centro de la imagen tiene que estar tranquilo y lo interesante, a los lados y abajo.
- **Tarjeta**: la portada de un mundo en su tarjeta de Mis mundos. Se recorta a una tira muy ancha (16:6) y se ve
  pequeña; por eso lo importante va en la franja del medio, bien recortado contra el fondo.

### Cómo generarlas

- **Una conversación nueva para cada imagen**, para que no se contagie el estilo de la anterior. Se pega el prompt tal
  cual; si ChatGPT pregunta algo, «hazla tal cual».
- El tamaño es **1536 × 1024 (3:2)**, el apaisado que ChatGPT hace bien. Entrar se recorta un poco arriba y abajo para
  llenar la pantalla; la tarjeta pierde la cuarta parte de arriba y la de abajo. Los prompts ya lo tienen en cuenta.
- Nombres: `a-entrar.png`, `a-tarjeta.png`, `b-entrar.png`… (la letra del estilo). Se dejan en
  `datos-locales/estilos/` del VPS (fuera de git) o se pasan como sea más cómodo: con ellas, Claude monta una lámina
  que las enseña de verdad, detrás del recuadro de Entrar y en una tarjeta, en oscuro y en claro.

### Qué mirar al comparar

- ¿Se lee bien el recuadro encima? ¿Queda tranquilo el centro?
- ¿Se reconoce la tarjeta en pequeño?
- ¿Casa con la app: grises neutros, la llama roja y naranja, el cristal?
- ¿Aguanta 15 imágenes seguidas sin cansar? ¿Sirve también para pantallas vacías y portadas por defecto?

---

### A · Óleo romántico

Paisaje del siglo XIX: luz dorada, cielos enormes, la naturaleza grandiosa y las figuras pequeñas. Es lo que más se
parece a los cuadros de dominio público de ahora.

**A · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2), pintada al óleo sobre lienzo, al estilo de la
> pintura romántica de paisaje del siglo XIX: luz dorada y atmosférica, un cielo enorme con nubes iluminadas por el
> sol que se pone, la naturaleza grandiosa y las figuras diminutas, pinceladas visibles, veladuras suaves y un barniz
> cálido algo envejecido. La escena: un valle de montaña al caer la tarde. A la izquierda, sobre un risco alto, una
> ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja serpenteando desde el fondo, entre
> colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la
> derecha, un camino de tierra con dos viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser
> tranquilo, solo cielo abierto y niebla sobre el valle, sin nada que llame la atención, porque encima irá un
> recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de
> agua, y sin marco: la pintura llega hasta los bordes.

**A · Tarjeta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2), pintada al óleo sobre lienzo, al estilo de la
> pintura romántica de paisaje del siglo XIX: luz dorada y atmosférica, cielo amplio con nubes iluminadas, pinceladas
> visibles, veladuras suaves y un barniz cálido algo envejecido. La escena: una torre de piedra en ruinas sobre un
> islote rocoso, en medio de un mar en calma al atardecer. Enroscado en la base de la torre duerme un dragón enorme,
> con la cola en el agua. En lo alto de la torre brilla una sola luz cálida y unas aves vuelan a lo lejos. La torre y
> el dragón van en el centro, bien recortados contra el cielo, para que se reconozcan aunque la imagen se vea muy
> pequeña. Todo lo importante tiene que caber en la franja horizontal del medio, porque la imagen se recortará a una
> tira casi tres veces más ancha que alta: la cuarta parte de arriba y la de abajo pueden ser solo cielo y agua. Sin
> texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

---

### B · Pintura digital de cine

Arte conceptual de película: contraluz, capas de bruma, detalle donde se mira. Es lo que más se parece a las imágenes
de Pixabay de ahora.

**B · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía, como el arte
> conceptual de una película, con iluminación de cine a contraluz, profundidad hecha con capas de bruma, detalle
> nítido en los puntos de interés y pinceladas sueltas en lo demás, colores ricos pero creíbles; tiene que parecer un
> cuadro pintado, no una foto ni un render en 3D. La escena: un valle de montaña al caer la tarde. A la izquierda,
> sobre un risco alto, una ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja serpenteando
> desde el fondo, entre colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un bosque oscuro
> de pinos. Abajo a la derecha, un camino de tierra con dos viajeros diminutos con capa y un farol. El centro de la
> imagen tiene que ser tranquilo, solo cielo abierto y niebla sobre el valle, sin nada que llame la atención, porque
> encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni
> marcas de agua, y sin marco: la pintura llega hasta los bordes.

**B · Tarjeta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una pintura digital de fantasía, como el arte
> conceptual de una película, con iluminación de cine a contraluz, capas de bruma, detalle nítido donde se mira y
> pinceladas sueltas en lo demás; tiene que parecer un cuadro pintado, no una foto ni un render en 3D. La escena: una
> torre de piedra en ruinas sobre un islote rocoso, en medio de un mar en calma al atardecer. Enroscado en la base de
> la torre duerme un dragón enorme, con la cola en el agua. En lo alto de la torre brilla una sola luz cálida y unas
> aves vuelan a lo lejos. La torre y el dragón van en el centro, bien recortados contra el cielo, para que se
> reconozcan aunque la imagen se vea muy pequeña. Todo lo importante tiene que caber en la franja horizontal del
> medio, porque la imagen se recortará a una tira casi tres veces más ancha que alta: la cuarta parte de arriba y la
> de abajo pueden ser solo cielo y agua. Sin texto, letras, firmas ni marcas de agua, y sin marco: la pintura llega
> hasta los bordes.

---

### C · Grabado con brasa

Tinta negra sobre papel marfil, como un libro de leyendas antiguo, con un solo color: el rojo de brasa de la llama de
Crisol.

**C · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): un grabado antiguo a buril, como la ilustración de
> un libro de leyendas del siglo XIX, todo en tinta negra sobre papel marfil, con tramas de líneas finas y cruzadas
> para las sombras y mucho contraste. El único color es un rojo anaranjado de brasa, solo en las luces (las ventanas,
> el farol) y en un resplandor leve del cielo. La escena: un valle de montaña al caer la tarde. A la izquierda, sobre
> un risco alto, una ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja serpenteando desde el
> fondo, entre colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un bosque oscuro de
> pinos. Abajo a la derecha, un camino de tierra con dos viajeros diminutos con capa y un farol. El centro de la
> imagen tiene que ser tranquilo, solo cielo abierto y niebla sobre el valle, con muy pocas líneas, porque encima irá
> un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras, firmas ni marcas de
> agua, y sin marco ni orla: el grabado llega hasta los bordes.

**C · Tarjeta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): un grabado antiguo a buril, como la ilustración de
> un libro de leyendas del siglo XIX, todo en tinta negra sobre papel marfil, con tramas de líneas finas y cruzadas
> para las sombras y mucho contraste. El único color es un rojo anaranjado de brasa, solo en la luz de la torre, en su
> reflejo en el agua y en un resplandor leve del cielo. La escena: una torre de piedra en ruinas sobre un islote
> rocoso, en medio de un mar en calma al atardecer. Enroscado en la base de la torre duerme un dragón enorme, con la
> cola en el agua. En lo alto de la torre brilla una sola luz y unas aves vuelan a lo lejos. La torre y el dragón van
> en el centro, bien recortados contra el cielo, para que se reconozcan aunque la imagen se vea muy pequeña. Todo lo
> importante tiene que caber en la franja horizontal del medio, porque la imagen se recortará a una tira casi tres
> veces más ancha que alta: la cuarta parte de arriba y la de abajo pueden ser solo cielo y agua. Sin texto, letras,
> firmas ni marcas de agua, y sin marco ni orla: el grabado llega hasta los bordes.

---

### D · Siluetas en la niebla

Capas de siluetas que se aclaran con la distancia, casi en un solo color, con un acento de brasa. Lo más tranquilo:
deja mucho aire para el cristal.

**D · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una ilustración atmosférica y minimalista hecha
> de capas de siluetas que se aclaran con la distancia, como un paisaje entre la bruma; casi monocroma, en grises
> cálidos y azul pizarra, con un único acento de luz naranja de brasa; formas simples y limpias, sin contornos, con un
> grano fino de papel; mucha calma y mucho aire. La escena: un valle de montaña al caer la tarde. A la izquierda,
> sobre un risco alto, la silueta de una ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja
> serpenteando desde el fondo, entre colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un
> bosque oscuro de pinos. Abajo a la derecha, un camino con dos viajeros diminutos con capa y un farol. El centro de
> la imagen tiene que ser tranquilo, solo cielo abierto y niebla sobre el valle, sin nada que llame la atención,
> porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras,
> firmas ni marcas de agua, y sin marco: la ilustración llega hasta los bordes.

**D · Tarjeta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una ilustración atmosférica y minimalista hecha
> de capas de siluetas que se aclaran con la distancia, como un paisaje entre la bruma; casi monocroma, en grises
> cálidos y azul pizarra, con un único acento de luz naranja de brasa; formas simples y limpias, sin contornos, con un
> grano fino de papel. La escena: una torre de piedra en ruinas sobre un islote rocoso, en medio de un mar en calma al
> atardecer. Enroscado en la base de la torre duerme un dragón enorme, con la cola en el agua. En lo alto de la torre
> brilla una sola luz naranja y unas aves vuelan a lo lejos. La torre y el dragón van en el centro, como una silueta
> clara y reconocible contra el cielo, aunque la imagen se vea muy pequeña. Todo lo importante tiene que caber en la
> franja horizontal del medio, porque la imagen se recortará a una tira casi tres veces más ancha que alta: la cuarta
> parte de arriba y la de abajo pueden ser solo cielo y agua. Sin texto, letras, firmas ni marcas de agua, y sin
> marco: la ilustración llega hasta los bordes.

---

### E · Portada de rol clásica

Fantasía pintada a mano como las portadas de novelas y juegos de rol de los ochenta: color saturado, drama, aventura.

**E · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una ilustración de fantasía clásica pintada a mano
> en acrílico y óleo, como las portadas de las novelas y los juegos de rol de los años ochenta: colores saturados,
> luz dramática, un aire de aventura y algo de nostalgia, con el acabado de una pintura sobre tabla. La escena: un
> valle de montaña al caer la tarde. A la izquierda, sobre un risco alto, una ciudadela de piedra con unas pocas
> ventanas encendidas. Un río ancho baja serpenteando desde el fondo, entre colinas, y refleja el último resplandor
> del cielo. A la derecha, la ladera de un bosque oscuro de pinos. Abajo a la derecha, un camino de tierra con dos
> viajeros diminutos con capa y un farol. El centro de la imagen tiene que ser tranquilo, solo cielo abierto y niebla
> sobre el valle, sin nada que llame la atención, porque encima irá un recuadro de texto; lo interesante va a los
> lados y en el tercio de abajo. Sin texto, letras, títulos, logotipos, firmas ni marcas de agua, y sin marco: la
> pintura llega hasta los bordes.

**E · Tarjeta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una ilustración de fantasía clásica pintada a mano
> en acrílico y óleo, como las portadas de las novelas y los juegos de rol de los años ochenta: colores saturados,
> luz dramática y el acabado de una pintura sobre tabla. La escena: una torre de piedra en ruinas sobre un islote
> rocoso, en medio de un mar en calma al atardecer. Enroscado en la base de la torre duerme un dragón enorme, con la
> cola en el agua. En lo alto de la torre brilla una sola luz cálida y unas aves vuelan a lo lejos. La torre y el
> dragón van en el centro, bien recortados contra el cielo, para que se reconozcan aunque la imagen se vea muy
> pequeña. Todo lo importante tiene que caber en la franja horizontal del medio, porque la imagen se recortará a una
> tira casi tres veces más ancha que alta: la cuarta parte de arriba y la de abajo pueden ser solo cielo y agua. Sin
> texto, letras, títulos, logotipos, firmas ni marcas de agua, y sin marco: la pintura llega hasta los bordes.

---

### F · Acuarela de cuaderno de viaje

Pluma sepia y aguadas sobre papel crema, como el cuaderno de un explorador. La más clara: pensada también para el tema
claro.

**F · Entrar**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una acuarela con tinta sepia, como una lámina del
> cuaderno de viaje de un explorador; trazo de pluma suelto y seguro, aguadas transparentes que dejan ver el papel
> crema, alguna mancha sutil, colores suaves y algo apagados. La escena: un valle de montaña al caer la tarde. A la
> izquierda, sobre un risco alto, una ciudadela de piedra con unas pocas ventanas encendidas. Un río ancho baja
> serpenteando desde el fondo, entre colinas, y refleja el último resplandor del cielo. A la derecha, la ladera de un
> bosque oscuro de pinos. Abajo a la derecha, un camino de tierra con dos viajeros diminutos con capa y un farol. El
> centro de la imagen tiene que ser tranquilo, solo cielo abierto y niebla sobre el valle, casi papel en blanco,
> porque encima irá un recuadro de texto; lo interesante va a los lados y en el tercio de abajo. Sin texto, letras,
> anotaciones, firmas ni marcas de agua, y sin marco: la acuarela llega hasta los bordes, sin márgenes de papel.

**F · Tarjeta**

> Haz una imagen horizontal de 1536 × 1024 píxeles (proporción 3:2): una acuarela con tinta sepia, como una lámina del
> cuaderno de viaje de un explorador; trazo de pluma suelto y seguro, aguadas transparentes que dejan ver el papel
> crema, colores suaves y algo apagados. La escena: una torre de piedra en ruinas sobre un islote rocoso, en medio de
> un mar en calma al atardecer. Enroscado en la base de la torre duerme un dragón enorme, con la cola en el agua. En lo
> alto de la torre brilla una sola luz cálida y unas aves vuelan a lo lejos. La torre y el dragón van en el centro,
> con un trazo claro, para que se reconozcan aunque la imagen se vea muy pequeña. Todo lo importante tiene que caber
> en la franja horizontal del medio, porque la imagen se recortará a una tira casi tres veces más ancha que alta: la
> cuarta parte de arriba y la de abajo pueden ser solo cielo y agua. Sin texto, letras, anotaciones, firmas ni marcas
> de agua, y sin marco: la acuarela llega hasta los bordes, sin márgenes de papel.

## Guía de estilo

Cuando Enrique elija: la frase base del estilo, la paleta, lo que nunca sale y el resto de prompts (fondos de Entrar,
la portada pública, el ambiente de Inicio, las portadas por defecto y las pantallas vacías).
