# Ajustes del mapa, la pizarra y el tutorial (Enrique, 2026-11-16)

Pedidos al probar el módulo 9 en localhost. Se hacen en la rama `modulo-9/mapas` antes de subir.

## Tutorial
- [ ] El botón del tutorial guiado («?», abajo a la derecha) se ha ido al fondo (debajo de lo demás) y sale cuadrado: debe ir
  encima y ser redondo, como antes.

## Mapa
- [ ] **Supr** borra lo elegido (también en la pizarra): comprobarlo en los dos con el foco donde sea.
- [ ] **Cerrar una región** es poco intuitivo: con doble clic se cierra pero añade un punto de más. Cerrar sin punto extra
  (y que pulsar el primer punto, o Intro, también la cierre, con una pista que se vea).
- [ ] En las opciones de una región, al abrir **«Aspecto»** el contenedor y lo de dentro se deforman: no debe moverse nada.
- [ ] El **tamaño de letra** de una región sale 96 en vez de 100.
- [ ] Al elegir **«Página»** en una región o un pin: un desplegable con las páginas que no desentone (como el de «Página…»
  de la pizarra), no el nativo.
- [ ] Algunas **formas de pin** mueven el sitio donde se clava el pin, y también el tamaño: el punto de anclaje y el tamaño,
  iguales en todas las formas.
- [ ] **«Revelar…»** del panel de una región o un pin no se entiende: rehacerlo (claro, como el ojo del árbol).
- [ ] El **icono** se elige antes que «Solo el icono», y son iconos del paquete que tenemos (no emojis sueltos).
- [ ] La herramienta **Texto** deja dibujar una caja para saber dónde irá el texto.
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
