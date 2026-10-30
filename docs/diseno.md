# Normas de diseño de Crisol

Lo que Enrique ha ido decidiendo sobre la interfaz. Vale para toda la app y para las pantallas que vengan. Cada norma
lleva, cuando la hay, su frase. Se añade aquí lo nuevo; no en otros documentos.

## Identidad

- **Mezcla del Crisol antiguo y del nuevo** (2026-10-30). Del antiguo:
  - grises neutros, con el oscuro por defecto;
  - cada nivel de título con su color;
  - enlaces en azul;
  - el rojo solo en lo importante.

  Del nuevo:
  - Barlow para el texto;
  - Barlow Condensed en mayúsculas para los títulos;
  - las esquinas cortadas de los recuadros.
- **La marca es la llama** del Crisol antiguo, de rojo abajo a naranja arriba (`components/brand.tsx`): en la barra,
  en la cabecera, en la pestaña del navegador y **mientras algo carga** (latiendo en el centro). «El icono actual no
  trasmite nada».
- **Las barras de desplazamiento, finas y del color de los bordes**, sin flechas; en una ventana solo se desplaza el
  contenido: «la barra lateral de los popup desentona bastante».
- **Nada de aspecto «de IA»**:
  - ni todo en mayúsculas condensadas;
  - ni filas de botones con borde, todos con el mismo peso;
  - ni textos de ayuda fijos en pantalla.
- **Se dice «IA», no «Claude»**: Crisol se conecta a cualquier IA. El nombre de la app conectada sale solo donde se ve
  qué está conectado.

## Armazón y navegación

- **Con sesión no hay barra arriba**. A la izquierda, una barra con iconos y su nombre debajo. Dentro de un mundo
  cambia y enseña su contenido. **Sin barra de estado abajo**: «la barra que hay abajo sirve de algo? sino quitala».
- **Con sesión, la portada y Entrar llevan directos a Mis mundos**. Una portada que solo enlaza a Mis mundos es redundante.
- **Lo de la barra lateral se abre encima**, como una ventana, sin quitar lo que se está viendo: Historial, Papelera,
  Ajustes, Perfil. «Ajustes y todo lo de la barra lateral debe ser como un popup, para no quitar la vista que se
  tiene en el momento». Se cierra con la X, con Escape o pulsando fuera, y se vuelve a donde se estaba; un enlace
  de dentro la cierra y lleva a su sitio. **Sin enlace de vuelta** arriba («Mis mundos»): en una ventana no tiene
  sentido.
- **El menú de la cuenta** (la inicial, abajo en la barra): quién eres, Perfil, Ajustes y Cerrar sesión. El tema va en
  Ajustes, no en el menú. Se abre al lado del botón y nunca se corta.

## Pantallas

- **Los cambios no son bruscos**: un elemento nuevo entra animado (sube un poco y crece) y uno borrado encoge y se
  desvanece antes de irse; los cuadros, las ventanas y el menú de la cuenta se abren con un pequeño crecimiento y
  fundido. Todo, sin animación si el sistema pide menos movimiento.

- **La colocación de Ajustes es la referencia**: una columna en el centro, con el título y el contenido alineados.
  Nada suelto «en medio sin sentido».
- **Crear algo se hace con un botón que abre un cuadro**, no con un formulario suelto en la pantalla. **El de crear es
  prácticamente el de sus ajustes** (para un mundo: portada, nombre, descripción y color), para dejarlo bien hecho
  sin tener que entrar después en ajustes.
- **«Nuevo …» va como un recuadro más de la lista**, con la misma forma (esquinas cortadas), vacío y con el borde
  discontinuo, tras el último (no un botón arriba). Sin ninguno, la pantalla vacía con su botón grande.
- **Las pantallas de cuenta (entrar, crear la cuenta)** van centradas y con aspecto profesional.
- **Todo cuadro o ventana encima lleva la X arriba a la derecha y se cierra al pulsar fuera** (y con Escape).
- **Las acciones de un elemento van en su engranaje**, abajo a la derecha de su tarjeta, siempre a la vista: abre su
  ventana, donde se cambia todo (nombre incluido) y donde irá lo que se añada. Nada de «Renombrar» y «Borrar» sueltos.
- **Los mundos no llevan icono**: «no aportan nada».
- **El color de un mundo**: sin color, uno de los fijos o uno propio con el selector de color; los propios se
  recuerdan para usarlos otra vez. **Solo tiñe, sutil, el contorno de su tarjeta** (y el de su ventana); la portada no
  se colorea. **El contorno sale siempre**, entero, también alrededor de la portada. Sin imagen, el hueco de la portada lleva un tinte muy oscuro de ese color.
- **Toda la tarjeta es clicable** y lleva al elemento, no solo su nombre (salvo sus botones).
- **«Guardar» y «Cancelar» solo salen si hay cambios**, a la izquierda (Guardar primero), y se abren y se cierran
  suavemente al aparecer y al irse, sin saltos (`components/changes.tsx`); «Cancelar» los deshace.
- **Un cuadro dentro de otro** (ver la portada desde la ventana del mundo): al cerrarlo se vuelve al de fuera, no a la
  pantalla.
- **Borrar algo importante va en una zona de peligro** rojiza, al final de su ventana, y se confirma en otro cuadro
  escribiendo su nombre, que sale en el mensaje para poder copiarlo.
- **Las portadas, al pasar el ratón, se acercan un poco y dejan verlas**, como las de las hojas del Crisol antiguo.
  **Cambiarlas, solo en la ventana del elemento**, que la enseña arriba con lo que se va eligiendo (icono, color) antes
  de guardar. Cambiarla: las imágenes del mundo en miniatura, subir otra, quitarla, encuadrarla arrastrando y
  acercarla o alejarla (deslizador, rueda del ratón o + y -).

## Cuentas

- **Nombre de usuario**: es el apodo con el que se te ve en la app, y es único (sin distinguir mayúsculas). Nombre y
  apellido(s) van aparte, en dos recuadros: «Nombre por un lado y Apellido(s) en otro recuadro, así es más facil».
- **La contraseña**: con su medidor de seguridad y repetida. No se admite una fácil de adivinar.
- **Sin organización visible** al registrarse: cada cuenta tiene su espacio (ADR-0004).

## Formularios

- **Los errores, con mensajes propios** bajo cada campo, nunca con el globo del navegador («ese popup tan cutre»). El
  foco va al primer campo que falla.

## Textos

- **Cortos y sin sobreexplicar**: «No hay que sobreexplicar las cosas».
- **Las explicaciones, genéricas**: para qué sirve cada zona a grandes rasgos, sin enumerar lo que hay dentro, que
  cambiará. Por ejemplo, «Desde aquí podrás administrar la aplicación».
- **Nada de mensajes aclarativos** tras una acción («Volverán a salir»). Mejor una opción que se marca y se ve marcada.

## Tutorial guiado de cada vista

- **Se llama «tutorial guiado de la vista»**, no «recorrido».
- **Cada vista tiene el suyo**: un globo por zona, con «1 de 3», Atrás (desde el segundo) y Siguiente. Ni Saltar ni
  «Lo tengo claro»: «los jugadores tendrán que hacer la guía de todas las vistas la primera vez que entren».
- **Sale solo la primera vez**, hasta acabarlo. Con Escape se cierra sin acabar y vuelve a salir la próxima vez.
- **Un «?» abajo a la derecha lo vuelve a sacar**: casi transparente, pero que se vea, y con su color al pasar el
  ratón. No hay casilla en Ajustes.
- **Lo relacionado se resalta en el mismo paso**, sin un paso propio: «Mundo en la barra lateral se tiene que resaltar
  en el paso 1, no debe tener un paso propio porque es redundante». Si hace falta, lleva su propia nota corta junto a
  su recuadro (la de «Mundos»: «Dentro de un mundo, esta barra cambiará y mostrará su contenido»).

## IA

- **Las peticiones que esperan aprobación salen como tarjetas flotantes**, estés donde estés, como en el Crisol
  antiguo. Ni en Ajustes ni encima de la página: «ahi en ajustes no aporta nada si tengo que entrar cada vez que
  quiera verlo».
- **Los ajustes de la IA**, solo el conector y el modo.
