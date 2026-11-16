# Ajustes del mapa, la pizarra y el tutorial (Enrique, 2026-11-16)

Pedidos al probar el módulo 9 en localhost. Se hacen en la rama `modulo-9/mapas` antes de subir.

## Tutorial
- [x] El botón del tutorial guiado («?», abajo a la derecha) se ha ido al fondo (debajo de lo demás) y sale cuadrado: debe ir
  encima y ser redondo, como antes. *Hecho: el «?» va al body (dentro de la página quedaba en su capa y los botones de
  la wiki lo hacían cuadrado); el de los dados sigue en su ficha.*

## Mapa
- [x] **Supr** borra lo elegido (también en la pizarra): comprobarlo en los dos con el foco donde sea. Ahora, en el mapa,
  Supr no borra y el lienzo se marca con la raya roja de foco por arriba (captura de Enrique): que borre, y que el foco
  del lienzo no pinte ese borde al pulsar una tecla. *Hecho: Supr (y Retroceso) borran con el foco en el lienzo, en una
  casilla, un color o un deslizador del panel, en la cabecera de la página o en ningún sitio (no donde se escribe); en la
  pizarra, también con el foco en nuestra píldora o en «Página…» (antes no hacía nada), y Escape deja la herramienta. El
  aro del foco del lienzo, solo si se llega con el tabulador, y por dentro.*
- [x] **Cerrar una región** es poco intuitivo: con doble clic se cierra pero añade un punto de más. Cerrar sin punto extra.
  Pulsar el primer vértice **no la cierra** (la pista dice «Intro o el primero, cerrar» y no se entiende): que pulsar el
  primer vértice la cierre de verdad (resaltándolo al acercarse) y que la pista lo diga claro («pulsa el primer punto o
  Intro para cerrar»). *Hecho: a 12 px del primer vértice, se agranda en rojo, la goma se le pega y pulsar la cierra; el
  doble clic cierra sin dejar el punto que pone él; la pista: «Pulsa el primer punto o Intro para cerrar».*
- [x] En las opciones de una región, al abrir **«Aspecto»** el contenedor y lo de dentro se deforman: no debe moverse nada.
  *Hecho: los deslizadores ya no toman el estilo de campo (salían altos y con caja), sus etiquetas van como las demás y
  el sitio de la barra de desplazamiento está guardado (al salir no estrecha el panel).*
- [x] El **tamaño de letra** de una región sale 96 en vez de 100. *Hecho: el tope es 100 (en el deslizador y en el
  contrato, que es lo que admite el servidor y la IA).*
- [x] Al elegir **«Página»** en una región o un pin: un desplegable con las páginas que no desentone (como el de «Página…»
  de la pizarra), no el nativo. *Hecho: un desplegable de cristal que flota bajo el campo (fuera del panel, sin moverlo),
  con las que empiezan por lo escrito primero, su ruta en gris y, si ninguna se llama así, «Página nueva: «…»»; flechas,
  Intro y Escape.*
- [x] Algunas **formas de pin** mueven el sitio donde se clava el pin, y también el tamaño: el punto de anclaje y el tamaño,
  iguales en todas las formas. *Hecho: cada forma se encaja en la misma caja (su lado mayor, igual) y todas se clavan
  abajo en el centro; solo el icono suelto («Solo el icono»), por el centro.*
- [x] **«Revelar…»** del panel de una región o un pin no se entiende: rehacerlo (claro, como el ojo del árbol). *Hecho:
  junto a «Oculto a los jugadores», un ojo con su estado («Lo conoce / No lo conoce»; «la» en una región o una ruta).
  Con una campaña, pulsarlo lo cambia al momento; con varias, dice cuántas («Lo conocen 1 de 2») y abre la lista de
  campañas con su marca, como «Revelar a…» del árbol. Marca sin avisar (como el árbol); si la campaña no conoce la
  página, lo dice («aún no conoce la página»). El modelo encajaba (las marcas de pin y de región ya existían): solo
  faltaba leerlas, con una acción nueva, `getItemKnowledge`.*
- [x] El **icono** se elige antes que «Solo el icono», y son iconos del paquete que tenemos (no emojis sueltos). *Hecho:
  «Icono» va antes de «Tamaño»; es un botón con el de ahora que abre, a la izquierda del panel, el buscador de los
  iconos de rol (el mismo de las páginas) y «Quitar el icono». Se pintan dentro de la forma, en la tinta que se lee sobre
  su color, y sueltos con «Solo el icono». Los emojis de antes se siguen viendo (y la IA aún puede ponerlos).*
- [x] La herramienta **Texto** deja dibujar una caja para saber dónde irá el texto. *Hecho: arrastrar dibuja una caja
  discontinua; el texto va en su centro con la letra a su alto (pulsar sin arrastrar, donde se pulsa y de serie). La
  pista: «Dibuja una caja donde irá el texto».*
- [x] Un **texto del mapa no se puede elegir** para editarlo ni borrarlo con Supr: que se elija al pulsarlo (y doble clic
  para editarlo) como las regiones y las rutas. *Hecho: se elige pulsando en toda su caja (sus letras no recibían el
  ratón), el doble clic lleva a escribirlo (su texto, ya elegido) y Supr lo quita. Al pulsar algo ya elegido, el foco va
  al mapa (antes se quedaba en el panel y Supr borraba lo escrito).*
- [x] **Medir**: su panel sale en otro sitio; ahora tapa la barra de herramientas de abajo. *Hecho: en la página del
  mundo va arriba a la izquierda del mapa (que ahí está libre); con la columna de herramientas de antes, sigue abajo.*
- [x] Los **desplegables nativos** (p. ej. «Se ve el nombre») salen con las opciones en claro: en oscuro, como la app.
  *Hecho, en toda la app: las opciones llevan fondo opaco y texto de la app (el navegador pintaba la lista con el fondo
  del desplegable, que es de cristal translúcido, sobre blanco). La lista abierta no sale en las capturas: a probar.*

## Pizarra
- [ ] Al alejar se **difumina** (cuanto más lejos, más) y al acercar se ven **dientes de sierra** hasta que se para: que se
  vea nítida al hacer zoom.

## Panel de la página
- [ ] El bloque **«Tabla de páginas»** nace apuntando a una plantilla «pnj» y un campo «faccion» que en una cuenta vacía no
  existen: el servidor lo rechaza al guardar. Debe nacer sin configurar (pidiendo la plantilla y su campo de enlace, de las
  que haya; si no hay ninguna, decirlo en una línea) y guardarse así.
- [ ] Su error comparte el código `BAD_TABLE` con las tablas aleatorias y la app enseña «Las filas no cubren bien la
  fórmula», que no tiene nada que ver: un código propio y un mensaje claro («Elige la plantilla y su campo»).

## La página
- [ ] Con la columna estrecha (1200 px con el panel abierto) **la letra del texto sale diminuta** (~11 px): la hoja ajusta
  la letra al ancho y no tiene mínimo. Un mínimo legible (≥ 1rem) y el ancho de lectura de siempre.
- [ ] El **título largo se corta** con «…» en la cabecera grande: que se lea entero (que baje de línea o encoja un poco).
