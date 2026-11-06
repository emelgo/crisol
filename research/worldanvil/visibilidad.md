# Visibilidad para los jugadores en World Anvil

Módulo de Crisol: 5. Visibilidad por campaña · Fecha: 2026-11-06 · Versión estudiada: web pública a fecha de hoy

## Pregunta

Las mismas ocho preguntas de la nota de LegendKeeper (`research/legendkeeper/visibilidad.md`): unidad de visibilidad
y niveles, a quién se abre y cómo se lleva un mundo con varios grupos, herencia, revelar en partida, ver como jugador,
enlaces y búsqueda, jugadores que escriben, y problemas conocidos.

**Cómo se leyó.** La web de World Anvil pide una comprobación antibots que hoy no se dejó pasar, ni con el navegador. El
archivo de Internet tiene copias de sus guías, pero respondió «demasiadas peticiones» todo el rato. Se leyeron enteros
cuatro artículos de su blog (2020, 2021, octubre de 2024 y octubre de 2025), la especificación pública de su API y una
guía de un tercero. Sus guías («Learn»), su Codex y su foro de sugerencias e incidencias se conocen por los extractos
del buscador. Ni cuenta ni código. Grado de certeza:

- **[blog]**: blog oficial, leído entero.
- **[API]**: especificación pública de la API (Boromir).
- **[extracto]**: páginas oficiales (guías, Codex, sugerencias, incidencias) vistas solo en los extractos del buscador.
- **[tercero]**: guía de otra web (Loreteller), leída entera.
- **[inferido]**: deducido, sin comprobar.

Varias funciones dependen del plan de pago (Master, Grandmaster, Sage), y se indica cuando consta.

## Lo que hacen

### El modelo, en breve

Un mundo tiene artículos (con plantilla), categorías, mapas, líneas temporales y **secretos**, que son objetos propios.
Lo que ve un lector depende de dos cosas: si el artículo (o el secreto, el pin, la capa) es público o privado, y a qué
**grupos de suscriptores** pertenece el lector. Un suscriptor es un lector con cuenta gratuita al que el autor deja ver
lo privado. Los grupos se crean en los ajustes del mundo y un usuario puede estar en varios [extracto, tercero]. Los
autores y coautores (quienes escriben) son otra cosa [extracto]. Si el mundo entero es privado, todo es privado aunque
un artículo diga público, y un suscriptor solo ve la portada y lo asignado a sus grupos [extracto].

### 1. Unidad de visibilidad y niveles

| Pieza | Cómo se oculta | Niveles |
|---|---|---|
| Artículo | Candado en la edición rápida: privado/público y borrador/publicado, y si es privado, un icono para elegir grupos | Público, privado, privado para unos grupos |
| Secreto | Objeto aparte con título y texto, que se incrusta en el texto de un artículo o se adjunta a su pestaña de secretos | Privado (solo su autor), privado para unos grupos, público (revelado a todos) |
| Contenedor de suscriptores | Trozo del texto de un artículo marcado para un grupo | Visible solo a ese grupo |
| Conmutador de visibilidad | Ojo sobre una sección, imagen, mapa, cita o enlace lateral, en la vista de lectura | Visible / oculto a todos los lectores |
| Semillas del narrador | Notas del autor en un artículo o un marcador | Solo el autor, o quien vea el artículo |
| Marcador de mapa, capa, grupo de marcadores | Igual que un artículo | Público, privado, privado para unos grupos |

[blog 2020, 2024, API, extracto, tercero]

- **Cuatro herramientas para ocultar un trozo**, que se solapan: el secreto (reutilizable, con grupos), el contenedor
  (en el texto, con un grupo, no reutilizable), el conmutador de visibilidad (rápido pero sin grupos, en Grandmaster) y
  las semillas del narrador (solo el autor) [blog 2020, extracto].
- **El secreto es reutilizable**: el mismo puede salir en varios artículos, y su acceso se cambia una vez [extracto,
  tercero]. Por la API, un secreto lleva estado, grupos, etiquetas, carpeta y el artículo al que pertenece [API].
- **Incrustado o adjunto**: el incrustado sale en su sitio del texto, y quien no tiene acceso no ve nada. El adjunto va
  a una pestaña de secretos del artículo, que se muestra en cuanto hay uno, a cualquiera que pueda ver el artículo: el
  contenido se esconde, pero la existencia no [tercero, extracto].
- **Secretos públicos con parte del máster** (octubre de 2024): un secreto se puede marcar como público para revelarlo
  a todos, y con las funciones de rol activas tiene una caja para el máster que nunca se revela, aunque el secreto sí
  [blog].
- **Mapas**: los marcadores, las capas y los grupos de marcadores tienen su propio estado y sus grupos [API].

### 2. A quién

- **A grupos de suscriptores.** La pauta oficial para un grupo de juego es un grupo para la partida y otro por cada
  jugador, para darle a cada uno los secretos de su trasfondo e irlos soltando [blog 2021, extracto].
- **Varios grupos en un mismo mundo**: es lo que mejor resuelve de los tres. Cada partida es un grupo de suscriptores y
  cada artículo, secreto o pin se abre a los grupos que toque [blog, extracto, inferido].
- **Límites del plan**: 10 suscriptores en Master, 100 en Grandmaster y 1.000 en Sage, y ni secretos ni suscriptores en
  la cuenta gratuita. Los subgrupos, desde Grandmaster [tercero, extracto del blog].
- **Los coautores no ven los secretos** salvo que el mundo active los «secretos abiertos», que se los enseña todos. La
  guía de un tercero aconseja apagarlo si los jugadores editan las páginas de sus personajes [extracto, tercero].

### 3. Herencia

- **No consta herencia** de un artículo a sus hijos ni de una categoría a sus artículos: cada artículo, secreto y pin
  lleva su estado y sus grupos [API, inferido].
- La única regla que se impone desde arriba es la del mundo privado, que vuelve privado todo [extracto].
- **El árbol enseña lo que no se puede abrir**: hay sugerencias para que el índice del mundo no muestre los artículos a
  los que el lector no tiene acceso, ni categorías enteras ocultas [extracto].
- Un fanwiki avisa de que, por cómo funcionan los grupos, los borradores y las secciones para mecenas se ven sin
  importar el resto de ajustes [extracto].

### 4. Revelar en partida

- **Artículo**: abrir la edición rápida (desde el gestor de artículos o desde la búsqueda), candado, cambiar a público o
  añadir un grupo. Unos tres o cuatro clics [blog 2024].
- **Secreto**: desde octubre de 2024 los secretos tienen su propio panel lateral y se editan sin salir del artículo o el
  mapa en que se trabaja: añadir el grupo o marcarlo público [blog 2024].
- **Sección con el conmutador**: un clic en el ojo, en la vista de lectura, para todos [blog 2020].
- **Avisos**: el artículo tiene fecha de notificación y casillas para avisar por webhook (Discord) y a la comunidad al
  actualizarse [API]. No consta un aviso al jugador cuando se le revela un secreto, ni una marca de «nuevo» [inferido].
- **«Lo que sabe el grupo»** (octubre de 2025): el gestor de artículos se filtra por grupo de suscriptores y enseña lo
  que ese grupo puede ver, en lista o dentro del árbol del mundo. También filtra por público/privado, borrador y
  semillas del narrador [blog 2025].

### 5. Ver como jugador

- **No hay vista como suscriptor.** Hay varias peticiones, unas rechazadas y otras en estudio. En una cerrada, el equipo
  responde que el autor ya ve lo que ve un lector normal [extracto].
- El apaño que se aconseja en el foro es una segunda cuenta («_player») metida solo en los grupos que se quieren probar
  [extracto].
- Otra petición pide ver un mapa privado como un grupo, para proyectarlo en la mesa sin enseñar de más [extracto].
- El filtro por grupo de 2025 es lo más parecido: dice qué artículos ve el grupo, pero no cómo se ve cada página
  [blog 2025, inferido].

### 6. Enlaces, menciones y búsqueda

- **Un enlace a un artículo privado no se puede pulsar** por defecto. Con los «enlaces seguros» (Grandmaster) se puede,
  y lleva a una página de acceso denegado que el autor puede personalizar [extracto]. Una sugerencia describe lo
  contrario (enlace activo que acaba en acceso denegado), así que el comportamiento ha cambiado o depende del sitio
  [extracto].
- **Los paneles laterales que enlazan a artículos privados no salen**, y hay quien pide poder mostrarlos [extracto].
- **El texto del enlace se ve igualmente** [inferido: al no poder pulsarlo, el lector ve el texto, que suele ser el
  título].
- La búsqueda de la app es para quien escribe: los coautores ven el directorio con títulos y extractos de los artículos
  privados [extracto].

### 7. Jugadores que escriben

- **Coautores** con permiso de edición, para quien escribe en el mundo [extracto].
- **Personajes de rol de los jugadores** con diario y hoja propios. Antes eran privados del jugador, y desde octubre de
  2024 el máster los ve, para que el jugador le pase notas en secreto [blog 2024].
- Una libreta personal fijable en la interfaz, foros de discusión del mundo y, para los mecenas, artículos protegidos con
  contraseña como premio por descubrir algo [blog 2021, 2024].

### 8. Problemas conocidos

- **Incidencia de octubre de 2025**: un artículo privado con un grupo seguía visible para los jugadores después de
  pasarlo a público, y la opción de grupo desaparecía de la interfaz [extracto].
- **El índice enseña títulos inaccesibles**, y el soporte dijo no poder reproducirlo [extracto].
- **La pestaña de secretos delata que hay secretos** [extracto, tercero].
- **Cambios de permisos que no se notan** hasta recargar o volver a entrar [tercero].
- **Cuatro herramientas que se solapan** y piezas detrás de planes distintos (conmutador, subgrupos, enlaces seguros,
  estilo de los secretos) [blog, extracto].
- **Sin vista como jugador**, pedida muchas veces, con segundas cuentas como apaño [extracto].
- Quejas de lentitud del panel nuevo de 2025, en los comentarios del blog [blog 2025].

## Compromisos y límites

Es el único de los tres con un grupo que sabe cosas: un mismo mundo sirve a varias partidas y a jugadores sueltos, cada
uno con lo suyo. El secreto como objeto reutilizable es potente para quien escribe mucho, y el filtro por grupo da por
fin una lista de lo que sabe cada grupo. El precio:

- **Sin herencia**: cada artículo, secreto y pin se abre a mano, y el árbol enseña lo que no se puede abrir.
- **Cuatro herramientas para ocultar un trozo**, con reglas distintas, repartidas entre planes de pago.
- **Los grupos los gestiona el autor a mano**, aparte de las partidas: un grupo de suscriptores por partida y otro por
  jugador.
- **Sin vista como jugador** ni aviso de lo revelado.
- Fugas por la interfaz (índice, pestaña de secretos) e incidencias de estado que se queda pegado.

## Qué nos llevamos a Crisol

Pensando en la decisión de Enrique (conocimiento por campaña con excepciones por personaje, herencia viva, secretos,
pines y campos «solo máster», revelar con aviso, «ver como jugador», el servidor lo filtra todo):

- **Su grupo de suscriptores es nuestra campaña, y su grupo por jugador, nuestra excepción por personaje.** Confirma el
  modelo de Enrique. Lo mejor: en Crisol el grupo sale solo de la campaña y de sus personajes, sin que el máster lo
  mantenga aparte.
- **Un jugador en dos campañas del mismo mundo.** En World Anvil un usuario en dos grupos ve la suma. En Crisol hay que
  decidirlo: propuesta, ve lo de la campaña en que está (y lo de su personaje en ella), no la suma, para no mezclar lo que
  saben dos personajes suyos.
- **«Lo que sabe el grupo» como su filtro de 2025**, pero mejor: dentro del árbol del mundo, por campaña y por
  personaje, y con las acciones de deshacer u ocultar otra vez que pide Enrique.
- **Un secreto revelado con una parte que sigue siendo del máster.** Su caja del máster dentro del secreto público es
  buena idea: un secreto dentro de otro, o una parte marcada, que no se revela con él.
- **Nada que delate lo que hay.** Su pestaña de secretos y su índice enseñan que existe algo oculto. En Crisol, un
  secreto sin revelar no deja hueco, marca ni contador, y el árbol no muestra páginas ocultas.
- **Una sola forma de ocultar un trozo**: el secreto. Ni contenedores ni conmutadores aparte. La marca de «solo máster»
  de los campos del panel es otra cosa, como ya decidió Enrique.
- **El secreto reutilizable no nos hace falta**: en Crisol un secreto es un trozo del texto de su página. Si algo se
  cuenta en varios sitios, es una página propia con su visibilidad.
- **El enlace a lo oculto, como texto plano sin destino**, y que no diga el nombre de la página (ver la nota de Kanka).
  Su página de acceso denegado confirma la existencia de la página: mejor que un jugador no llegue nunca a ella, y que
  la API responda igual que si no existiera.
- **El aviso de Enrique no lo tiene nadie.** World Anvil avisa a seguidores y a Discord al publicar, no al jugador al que
  se le revela algo. Nuestro aviso sale de revelar, por personaje.
- **Ver como jugador desde el primer día**: sin ella, los másteres de World Anvil abren segundas cuentas. Y que sirva
  también en el mapa (su petición de proyectar el mapa como lo ve un grupo).
- **Las pruebas, contra el estado pegado**: su incidencia de 2025 (un artículo que sigue visible para un grupo tras
  cambiarlo) es justo lo que Enrique quiere evitar con «revocar es inmediato». Prueba: revelar, ocultar otra vez y
  comprobar que el jugador conectado deja de recibirlo al momento.

## Fuentes

Blog oficial, leído entero:

- https://blog.worldanvil.com/2020/02/12/introducing-the-visibility-toggle-show-to-your-players-only-what-you-want-them-to-see/
- https://blog.worldanvil.com/dm-tips-advice/how-to-get-your-ttrpg-players-engaged/
- https://blog.worldanvil.com/announcements/world-anvil-updates-october-2024/
- https://blog.worldanvil.com/newsletter/world-anvil-news-october-2024/
- https://blog.worldanvil.com/worldanvil/dev-news/world-anvil-just-got-even-better/

API:

- https://wa-cdn.nyc3.cdn.digitaloceanspaces.com/assets/prod/boromir-documentation/swagger/openapi.yml (y sus partes de
  secreto, grupo de suscriptores, marcador, capa, grupo de marcadores y artículo)

Tercero, leído entero:

- https://loreteller.com/learn/world-anvil-secrets-guide/

Vistas solo en los extractos del buscador (la web pidió la comprobación antibots):

- https://www.worldanvil.com/learn/workflows/secrets-workflow
- https://www.worldanvil.com/learn/secrets/secret-subscribers
- https://www.worldanvil.com/learn/secrets/public-secret
- https://www.worldanvil.com/learn/article-guides/set-article-subscribers
- https://www.worldanvil.com/learn/access-rights/subcontainers
- https://www.worldanvil.com/learn/access-rights/subscribers
- https://www.worldanvil.com/learn/world/secured-links
- https://www.worldanvil.com/learn/workflows/player-workflow
- https://www.worldanvil.com/learn/beginner-tutorials/get-started-secrets
- https://www.worldanvil.com/w/WorldAnvilCodex/a/secrets
- https://www.worldanvil.com/w/WorldAnvilCodex/a/subscribers
- https://www.worldanvil.com/w/WorldAnvilCodex/a/visibility-toggles
- https://www.worldanvil.com/w/WorldAnvilCodex/a/coauthors
- https://www.worldanvil.com/w/WorldAnvilCodex/a/gamemaster-workflow
- https://www.worldanvil.com/community/voting/suggestion/524f8907-9954-491d-bc49-8c13e97b71ec/view (ver como un grupo)
- https://www.worldanvil.com/community/voting/suggestion/e83a6716-d213-468b-a284-9a6a907d91bc/view (ver como lector)
- https://www.worldanvil.com/community/voting/suggestion/7d791b3f-bf99-43a7-9e87-e4e86e62e6b2/view (mapa como un grupo)
- https://www.worldanvil.com/community/voting/suggestion/c4e2cf9a-55f9-4234-aef7-afd43e3c86bc/view (índice)
- https://www.worldanvil.com/community/voting/suggestion/77044d5f-6a63-4084-a596-fd4fd8e4c508/view (paneles con enlaces
  a privados)
- https://www.worldanvil.com/udan-tracker/89a38cce-aaa4-49da-b228-4d971962a4a3/view (incidencia de 2025)
- https://www.worldanvil.com/w/dragon-s-bane-sierrakomodo/a/the-divide-article (fanwiki, borradores visibles)
