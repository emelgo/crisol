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
- [ ] En las opciones de una región, al abrir **«Aspecto»** el contenedor y lo de dentro se deforman: no debe moverse nada.
- [ ] El **tamaño de letra** de una región sale 96 en vez de 100.
- [ ] Al elegir **«Página»** en una región o un pin: un desplegable con las páginas que no desentone (como el de «Página…»
  de la pizarra), no el nativo.
- [ ] Algunas **formas de pin** mueven el sitio donde se clava el pin, y también el tamaño: el punto de anclaje y el tamaño,
  iguales en todas las formas.
- [ ] **«Revelar…»** del panel de una región o un pin no se entiende: rehacerlo (claro, como el ojo del árbol).
- [ ] El **icono** se elige antes que «Solo el icono», y son iconos del paquete que tenemos (no emojis sueltos).
- [ ] La herramienta **Texto** deja dibujar una caja para saber dónde irá el texto.
- [ ] Un **texto del mapa no se puede elegir** para editarlo ni borrarlo con Supr: que se elija al pulsarlo (y doble clic
  para editarlo) como las regiones y las rutas.
- [ ] **Medir**: su panel sale en otro sitio; ahora tapa la barra de herramientas de abajo.
- [ ] Los **desplegables nativos** (p. ej. «Se ve el nombre») salen con las opciones en claro: en oscuro, como la app.

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
