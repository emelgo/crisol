# Mapas de fantasía en Inkarnate

Módulo de Crisol: 9. Mapas con capas y pizarras · Fecha: 2026-11-12 · Versión estudiada: Inkarnate 2.0 (diciembre de
2025) con los cambios publicados hasta el 5 de noviembre de 2026, por su centro de ayuda y su registro de cambios

## Pregunta

Inkarnate es el editor de mapas de fantasía más usado. Queríamos saber cómo resuelve las capas, los textos (curvos,
estilos), las regiones y fronteras, los caminos y el dibujo en general; si tiene escala o regla; si un mapa se comparte
de forma interactiva o con partes ocultas para los jugadores; si usa IA; y en qué formato guarda la geometría.

**Cómo se leyó.** Solo la web pública: el centro de ayuda (help.inkarnate.com), su portada y sus preguntas frecuentes,
el registro de cambios y prensa sobre su polémica con la IA. Sin cuenta y sin abrir el editor. Reddit no se dejó leer y
el buscador dio poco. Grado de certeza:

- **[ayuda]**: centro de ayuda oficial. **[cambios]**: registro de cambios oficial (feedback.inkarnate.com/changelog).
- **[web]**: portada y preguntas frecuentes. **[prensa]**: artículos de terceros. **[extracto]**: resumen del buscador.
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### Qué es

- Un editor en el navegador para pintar mapas como imagen: mundos, ciudades y mapas de combate, con más de 25 000
  recursos dibujados a mano (bosques, ciudades, montañas) que se ponen como sellos [web]. El resultado es una imagen
  para exportar o imprimir, no un mapa vivo [ayuda].
- Herramientas: seleccionar, tierra, pincel, sello, texto, línea y forma, y una de notas [ayuda].

### Capas

- Desde la 2.0 hay capas propias que se crean, renombran, reordenan arrastrando y se ocultan con un ojo [cambios, ayuda].
  Se pintan de abajo arriba [ayuda].
- Tipos: de **objetos** (sellos, textos, líneas y formas), de **pincel** (texturas y color), de **tierra** (pincel con
  una máscara que da la forma de la costa), de **filtro**, de **cuadrícula**, máscara de capa y la capa de **color** de
  fondo, fija abajo [ayuda]. La rejilla y los filtros eran herramientas y ahora son capas [cambios].
- Dentro de una capa de objetos hay **subcapas** para decidir qué va delante sin cambiar de capa, y un panel de objetos
  con buscador, ocultar y bloquear cada uno, y **grupos anidados** [ayuda].
- Cada capa admite máscara, modos de fusión y sombra; «aplanar» funde la capa y las visibles de debajo en una imagen y
  se pierden los objetos [cambios, ayuda]. Diez capas por mapa en la versión gratuita, sin límite en las de pago [ayuda].

### Dibujar: tierra, líneas y formas

- **Tierra**: pincel de borde irregular con «rugosidad» (de detalle fino a formas grandes), pincel de círculo, celdas de
  la rejilla, formas predefinidas, sumar y restar, y bote de relleno. Es la «costa automática» que anuncian: un pincel
  con ruido, no generación aleatoria [ayuda, web].
- **Línea** (abierta: muros, caminos, ríos, fronteras) y **forma** (cerrada, con borde y relleno) comparten edición
  [ayuda]:
  - Modos de creación: a mano alzada (los nodos salen solos, con una «precisión» que fija cuántos), pluma (clic para
    nodo recto, clic y arrastrar para nodo curvo con tiradores Bézier, doble clic o Intro para acabar, Escape para
    cancelar, Ctrl para ángulos de 15°), pincel y formas predefinidas (rectángulo, elipse, polígono) [ayuda].
  - Formas: sumar, restar y fusionar con otra forma de la misma capa [ayuda].
  - Editar nodos: mover, insertar en un tramo, borrar, cambiar entre recto y curvo, cortar el trazo y abrir huecos sin
    cortarlo (puertas) [ayuda].
  - Trazo: un sello repetido a lo largo (un camino dibujado, una muralla), un color liso, discontinuo o punteado con
    largo de raya y hueco, o un recorte que funde con el terreno. Relleno: textura, color o recorte, con opacidad
    [ayuda]. Estilos recientes y favoritos para reutilizar [ayuda].
- **No hay herramienta de frontera**: un usuario pide una que se ajuste a otras fronteras y a la costa [extracto]. Las
  fronteras se hacen con líneas o formas a mano [inferido]. Tampoco hay ajuste a otros trazos, solo a la rejilla [ayuda].

### Textos

- Clic para crear; texto de varias líneas, fuente (de las incluidas), negrita, **curvatura en arco**, espaciado entre
  letras e interlineado, alineación, tamaño, giro y volteo [ayuda].
- Aspecto: color, contorno con color y grosor, sombra, opacidad, modo de fusión y desenfoque (de pago) [ayuda].
- La curva es un arco simple: no se documenta texto que siga un trazado libre ni estilos de texto guardados [ayuda, por
  omisión]. Su consejo: arquear los nombres a lo largo de costas y cordilleras y bajar la opacidad de las regiones
  grandes [ayuda].

### Escala, medir y notas

- **No hay escala ni regla documentadas**: ni barra de escala, ni medir distancias, ni unidades [ayuda, por omisión].
  Hay quejas de «escala incoherente» en su tablero de peticiones [extracto]. Las barras de escala y rosas de los vientos
  serán sellos decorativos [inferido].
- La rejilla (cuadrada, y hexagonal según un anuncio antiguo [extracto]) sirve para ajustar y, si es cuadrada, para
  exportar a mesas virtuales calculando el tamaño por casillas [ayuda].
- **Notas privadas**: un marcador con título y texto para ideas o historia; solo se ven con la herramienta de notas y
  no salen al exportar [ayuda].

### Compartir y jugadores

- Los mapas son privados; **publicar** los saca al perfil y da un enlace directo, y opcionalmente deja clonarlos.
  Despublicar corta el enlace [ayuda]. No hay mapa interactivo, pines con enlaces ni partes ocultas para jugadores
  [ayuda, por omisión].
- Exporta solo imagen: JPEG, PNG o WebP de 1K a 16K según el plan [ayuda]. Ni vectores ni datos [ayuda, por omisión].
- Los copiar y pegar de objetos entre escenas pasan por una cadena de texto, de formato no documentado [cambios].
  Autoguardado e instantáneas para volver atrás [cambios].
- La interactividad la ponen otros: Campfire enlaza o sube mapas de Inkarnate y se actualiza solo cuando se editan, si
  se es de pago en Inkarnate [web de Campfire].

### IA

- **Ninguna IA en el editor** [ayuda, por omisión]. En octubre de 2025, tras quejas por una subida de precios y un
  anuncio con arte de IA, prohibieron el arte generado por IA en su tienda de usuarios: la razón dada es que no se
  puede comprobar con qué se entrenaron esos modelos [prensa]. Sus condiciones lo recogen [extracto].
- Formato de geometría: interno y no documentado; los trazos son nodos con tiradores Bézier [ayuda, inferido].

## Compromisos y límites

- **Gana en belleza**: sellos, trazos con textura, rugosidad, sombras. Un mapa de Inkarnate parece un mapa ilustrado.
  El precio es un programa de dibujo de verdad, con decenas de opciones por herramienta: justo lo que Enrique no quiere
  para el día a día.
- **Todo acaba en una imagen plana**: ni enlaces, ni capas ocultables para jugadores, ni escala, ni datos que otro
  programa pueda leer. Es la herramienta para hacer la imagen de fondo, no el mapa que se juega.
- Sin frontera compartida entre regiones vecinas: cada forma se dibuja aparte y los bordes no casan solos.
- Su rechazo a la IA es político y de comunidad (artistas), no técnico.

## Qué nos llevamos a Crisol

- **Inkarnate es el origen de la imagen, no un rival**: Enrique puede pintar su mapa allí y subirlo como fondo; las
  capas de Crisol van encima, como datos.
- **Su pluma, en pequeño**: clic para nodo, doble clic o Intro para acabar, Escape para cancelar, insertar un nodo
  pinchando en un tramo y borrarlo. Las curvas Bézier, de momento no: rectas con muchos puntos bastan para fronteras y
  rutas, y la IA las escribe mejor.
- **Línea y forma como las dos piezas base** (ruta y región), con trazo liso, discontinuo o punteado, color y
  opacidad. Una frontera discontinua es el uso típico.
- **Texto con arco** como única fantasía tipográfica: nombre, tamaño, color, contorno y curvatura. Cubre los nombres de
  reinos y mares sin un editor de texto.
- **Subcapas no; orden dentro de la capa, sí**: lo que se dibuja después va encima, y se puede subir o bajar.
- **Las notas privadas** recuerdan lo que ya tenemos: lo «solo del máster». En Crisol es una capa oculta o un elemento
  sin revelar, nunca un modo de herramienta.
- **Ajuste a lo ya dibujado** es lo que piden sus usuarios para las fronteras. Conviene que al dibujar una región junto
  a otra se pueda pegar al borde vecino (o que la IA las genere ya casadas). Apuntarlo como mejora, no como mínimo.
- **La IA**: a Enrique no le afecta su polémica (la IA no pinta arte, traza datos). Aun así, la interfaz dice «IA» y
  lo que traza es geometría editable, no imágenes.

## Fuentes

- https://inkarnate.com/ y https://inkarnate.com/faq
- https://help.inkarnate.com/help (índice del centro de ayuda)
- https://help.inkarnate.com/help/articles/3822773-line-and-shape-tools
- https://help.inkarnate.com/help/articles/5385303-text-tool
- https://help.inkarnate.com/help/articles/4641701-layer-panel
- https://help.inkarnate.com/help/articles/3510856-object-panel
- https://help.inkarnate.com/help/articles/3883631-land-tool
- https://help.inkarnate.com/help/articles/2020732-note-tool
- https://help.inkarnate.com/help/articles/6452044-editor-overview
- https://help.inkarnate.com/help/articles/8519002-export
- https://help.inkarnate.com/help/articles/0086595-publishing-your-maps
- https://feedback.inkarnate.com/changelog y https://feedback.inkarnate.com/changelog/inkarnate-20-star
- https://feedback.inkarnate.com/changelog/new-bug-fixes-and-improvements-gear-6
- https://www.geeknative.com/206705/map-maker-inkarnate-reverses-ai-policy-following-community-backlash
- https://www.campfirewriting.com/interactive-maps
- Solo en extractos del buscador: https://feedback.inkarnate.com/feature-requests/p/can-we-please-get-a-dedicated-border-tool,
  https://feedback.inkarnate.com/feature-requests/p/embarrassingly-inconsistent-scaling-for-a-program-entirely-dedicated-to-map-maki,
  https://inkarnate.com/terms, https://x.com/inkarnaterpg/status/1760039442201403802 y
  https://www.facebook.com/InkarnateRPG/photos/a.720772034651905/5486004954795232/
