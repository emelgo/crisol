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

- **La colocación de Ajustes es la referencia**: una columna en el centro, con el título y el contenido alineados.
  Nada suelto «en medio sin sentido».
- **Crear algo se hace con un botón que abre un cuadro**, no con un formulario suelto en la pantalla.
- **Las pantallas de cuenta (entrar, crear la cuenta)** van centradas y con aspecto profesional.

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
