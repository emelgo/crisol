# Visibilidad para los jugadores en LegendKeeper

Módulo de Crisol: 5. Visibilidad por campaña · Fecha: 2026-11-06 · Versión estudiada: web pública a fecha de hoy
(changelog hasta la 0.21.0, del 27-10-2026)

## Pregunta

Cómo decide LegendKeeper qué ve cada jugador de un mundo, para la spec del módulo 5 (`docs/modulos.md`, «5. Visibilidad
por campaña»). Ocho preguntas:

1. La unidad de visibilidad (página, bloque o secreto, campo, pin o capa) y los niveles que ofrece.
2. A quién se abre (jugadores concretos, grupos, roles) y cómo se lleva un mundo con varios grupos de juego.
3. La herencia: si las subpáginas heredan, si la herencia es viva o una copia, y si una hija puede ser más abierta que su
   madre.
4. Revelar en partida: clics, desde dónde, avisos o marca de «nuevo», historial o lista de lo revelado.
5. Ver como jugador.
6. Cómo salen los enlaces a lo oculto y si la búsqueda y las menciones respetan la visibilidad.
7. Si los jugadores escriben (páginas concretas, notas propias).
8. Problemas conocidos: fugas, confusión, demasiados clics.

**Cómo se leyó.** Solo la web pública: el centro de ayuda (artículos de una línea sobre un vídeo), las 180 entradas del
changelog (de 2019 a octubre de 2026), la guía de la API y su especificación OpenAPI, y la página de funciones. De la
comunidad apenas salió nada en el buscador. Ni cuenta ni código. Grado de certeza:

- **[ayuda]**: centro de ayuda oficial.
- **[blog]**: changelog oficial (se da la versión y el año, porque mucho es antiguo).
- **[API]**: guía y especificación de la API v3 (2026), que describen el modelo actual.
- **[extracto]**: páginas de terceros vistas en los extractos del buscador.
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### El modelo, en breve

Un proyecto es un árbol de páginas, y cada página tiene pestañas (texto, mapa, pizarra, línea temporal) y una columna
lateral de bloques. Hay tres papeles: propietario, administrador y miembro [API]. Los administradores lo ven todo, y los
miembros (los jugadores y quien se invite) están sujetos a la visibilidad. No hay grupos ni papeles propios: se
prometieron en 2021 (0.7, «papeles personalizables, pronto») y la API de 2026 sigue con los tres fijos [blog, API].

### 1. Unidad de visibilidad y niveles

| Pieza | Cómo se oculta | Niveles |
|---|---|---|
| Página | Interruptor «ocultar a los jugadores» (botón derecho o el ojo del árbol) | Visible / oculta (solo administradores) |
| Página, fino | Permisos por papel o por usuario | Sin acceso, leer, editar, acceso total, lo que diga el papel, heredar de la madre |
| Pestaña | Botón derecho en la pestaña | Visible / oculta |
| Bloque del texto | Bloque secreto (`/secret`, o `??` al empezar una línea) | Solo administradores |
| Bloque de la columna lateral | Marca de oculto en cada bloque | Visible / oculto |
| Pin, región, ruta o rótulo de un mapa | Mostrar u ocultar desde su menú | Visible / oculto, y un rango de zoom en que se dibuja |
| Evento de línea temporal, imagen del banco | Marca de oculto | Visible / oculto |

[ayuda, blog 0.4 de 2019, 0.6.1, 0.7.11, API]

- **Dos sistemas superpuestos para las páginas.** El ocultar es el atajo de un clic que añadieron en 2020 porque los
  permisos finos resultaban pesados: una página oculta y todas sus subpáginas solo las ven los administradores, digan lo
  que digan los permisos [blog 0.6.1]. Los permisos finos (de 2019) siguen en la API: se guardan por papel de miembro o
  por id de usuario, y solo los cambia un administrador o quien tenga acceso total a la página [blog 0.4, API].
- **Los secretos son de un solo nivel.** Al principio los veía quien pudiera editar la página. Desde 2021 no los ve
  ningún miembro, aunque edite [blog 0.4.1, 0.9]. No se buscan y se quitan de las páginas públicas [blog 0.4.1, API].
- **Los pines van aparte de las páginas.** Un miembro puede ver la página y no el pin, el pin y no la página, las dos
  cosas o ninguna. Quien puede editar la página del mapa ve todos los pines [blog 0.4.2].
- **No hay niebla de guerra.** En enero de 2026 tuvieron que cerrar una puerta trasera que dejaba ver una herramienta de
  niebla a medio hacer [blog 0.18.0.1].
- **Proyecto público**: se lee con un enlace y sin cuenta. Las páginas ocultas y los secretos no salen [ayuda].

### 2. A quién

- Solo hay dos destinatarios: el papel de miembro entero o un usuario concreto. El ejemplo oficial es dar a cada jugador
  permiso de edición sobre la página de su personaje [blog 0.4].
- **Varios grupos en un mismo mundo**: no hay nada pensado. Con los tres papeles fijos, la única vía es poner permisos
  usuario a usuario en cada página, o duplicar el proyecto [inferido]. El buscador tampoco dio quejas ni peticiones
  sobre esto [extracto].
- Los secretos no se abren a nadie en concreto: se prometió revelarlos a usuarios sueltos en 2021, y permisos propios
  para ellos en 2023 [blog 0.9, 0.14]. En la API de 2026 el bloque secreto sigue sin campo de destinatarios [API].

### 3. Herencia

- **Viva y hacia abajo.** El nivel «heredar» sube por la cadena de madres hasta dar con un valor. Sin madre, se puede
  leer. «Sin acceso» corta todas las subpáginas, digan lo que digan ellas [blog 0.4]. La API lo confirma hoy: una página
  cuya madre (o cualquier antepasado) está oculta o niega el acceso devuelve «no encontrada» [API].
- **Una hija nunca es más abierta que una madre oculta.** No existe la excepción hacia arriba, así que no hay problema
  de ruta: si ves una página, ves toda su ruta [API, inferido].
- **Lo nuevo hereda.** Una página nueva hereda de su madre, y en la raíz el valor por defecto es «se puede leer». Es
  decir, lo nuevo es visible salvo que se oculte [blog 0.4, inferido para hoy]. En 2026 corrigieron que las páginas
  creadas desde plantilla no heredaban la visibilidad de la plantilla, y que los derechos de edición se calculaban sin
  mirar el árbol entero [blog 0.19.0.1].
- Los pines ocultos no se propagaban a sus descendientes hasta enero de 2026 [blog 0.18.0.1].

### 4. Revelar en partida

- **Página**: un clic (botón derecho, mostrar) en el árbol [ayuda]. **Pin**: mostrar desde su menú, y les aparece al
  momento a los miembros conectados [blog 0.4.2]. **Secreto**: un botón «Revelar» en el menú del bloque, desde 2023
  [blog 0.14.0.8]. Como no hay destinatarios, revelar es para todos: parece que convierte el secreto en texto normal
  [inferido].
- **Sin aviso ni marca de «nuevo».** La fuente de actividad (2026) lista páginas creadas y editadas, quién y cuándo, y
  ya en 2020 se filtraba por permisos [blog 0.6, 0.21]. En 2020 se prometió un tipo de evento «Revelado» [blog 0.6], y no
  consta que llegara.
- **Lo revelado no tiene lista propia.** Lo más cercano es el gestor de permisos del proyecto, que desde 2026 está en
  los ajustes: un resumen de los permisos del papel de miembro, página a página [blog 0.7, 0.19.0.0].
- El administrador ve los pines ocultos semitransparentes. Su autor reconoció que la transparencia se ve mal en mapas
  muy coloridos [blog 0.6.1].

### 5. Ver como jugador

Llegó en la 0.21.0 (27-10-2026): el administrador abre «Ver como» en su avatar y ve el proyecto como sus miembros
[blog]. Durante siete años no hubo forma de comprobarlo sin una segunda cuenta [inferido].

### 6. Enlaces, menciones y búsqueda

- **Lo que no se puede ver no sale** en el árbol, el mapa, la búsqueda, las menciones ni la lista de «mencionado en»
  [blog 0.4].
- **Una mención a una página oculta** salía como «???». En 2022 avisaron de que pasaría a mostrar el nombre de la página
  (sin dejar entrar), y pidieron revisar los títulos que destripan algo [blog 0.7.14].
- **Fugas corregidas una a una**: pestañas ocultas en la búsqueda, páginas ocultas en «mencionado en», en el índice de
  subpáginas, en los índices de etiquetas y de colecciones y en la vista previa de las menciones (esto último en julio de
  2026), y secretos invisibles que se copiaban al portapapeles [blog 0.7.6, 0.7.12, 0.9.1.10, 0.15.3.3, 0.19.0.1].
- El enlazado automático de nombres no conocía los permisos en 2019 [blog 0.4].

### 7. Jugadores que escriben

- Un miembro edita las páginas con permiso de edición o acceso total, también por usuario (la ficha de su personaje)
  [blog 0.4].
- Desde 2021 cualquier miembro crea páginas: quitaron el permiso global de crear [blog 0.9]. Quien crea desde plantilla
  recibe permiso de edición sobre lo creado [blog 0.12.1.2].
- **Un secreto dentro de una página que edita un miembro** es un caso especial: el miembro no lo ve, y si borra un trozo
  de texto que lo contiene, el borrado no se aplica [blog 0.9].
- No hay notas privadas del jugador. Hay un chat del proyecto con tiradas, y quien tira elige quién ve el resultado
  [blog 0.21].

### 8. API, IA y seguridad

- Una clave de la API actúa como la persona que la creó, con el menor de los dos papeles. Una clave de miembro sigue las
  mismas reglas que un miembro en la app, y lo oculto le responde «no encontrado» [API]. Hay un MCP de terceros que trata
  los secretos como contenido solo del máster [extracto].
- **El modelo de seguridad es de confianza.** Desde 2021 la app guarda casi todo en el dispositivo para trabajar sin
  conexión, y su autor avisó de que un miembro con conocimientos podría sacar de su base de datos local los secretos y
  las páginas ocultas. Solo está ofuscado, y la recomendación es invitar únicamente a gente de confianza. Las páginas
  públicas, en cambio, salen del servidor y no tienen ese problema [blog 0.9].
- En 2026 la app sigue sincronizando una base de datos local («reiniciar datos locales», primera sincronización,
  versiones del dispositivo sin conexión) y calcula los derechos en el cliente, «igual que el servidor» [blog 0.19.0.1,
  0.21]. Lo más probable es que el aviso de 2021 siga en pie [inferido].
- Al exportar se pierden los permisos [blog 0.16.1].

## Compromisos y límites

Gana en sencillez para el caso común: un ojo para ocultar páginas, pestañas, pines y bloques, y un bloque secreto que
se escribe sin salir del texto. La herencia viva y estricta evita las rutas rotas. El precio:

- **No hay grupos.** Solo el papel de miembro entero o un usuario suelto. Varios grupos en un mundo no se contemplan, y
  los secretos no se abren a nadie en concreto, a pesar de dos promesas.
- **Lo nuevo es visible por defecto**, y una página nueva bajo una madre visible nace visible.
- **Dos sistemas para lo mismo** (ocultar y permisos finos), que su propio autor llamó poderosos pero incómodos, y que no
  estuvieron «listos para el usuario» en años [blog 0.6.1, 2020].
- **Siete años de fugas por canales laterales**: búsqueda, índices, vistas previas, menciones, portapapeles.
- **El cliente tiene los datos.** Por trabajar sin conexión, la seguridad depende de que los jugadores no curioseen.
- Sin aviso ni lista de lo revelado. «Ver como» acaba de llegar.

## Qué nos llevamos a Crisol

Pensando en la decisión de Enrique (conocimiento por campaña con excepciones por personaje, herencia viva, secretos,
pines y campos «solo máster», revelar con aviso, «ver como jugador», el servidor lo filtra todo):

- **Su aviso de seguridad es nuestro motivo.** Lo que Enrique fijó («nada se manda para esconderlo en la interfaz») es
  justo lo que LegendKeeper sacrificó por el modo sin conexión. Si algún día Crisol trabaja sin conexión, la copia local
  de un jugador solo debe tener lo que ya ve.
- **La herencia estricta evita la ruta rota, pero choca con «excepciones en cualquiera».** Si una hija se abre bajo una
  madre oculta, la spec tiene que decir cómo se ven la ruta y el árbol. Propuesta: la madre sale como un escalón sin
  enlace y sin nombre («…»).
- **Lo nuevo bajo algo revelado.** Con herencia viva, una subpágina nueva de una página ya revelada nace visible. Enrique
  dice a la vez «una nueva es solo del máster» y «las subpáginas heredan»: hay que elegir. Propuesta: nace oculta (una
  excepción marcada) y el editor lo dice.
- **Revelar una madre revela las hijas que heredan.** El diálogo de revelar tiene que contar y listar las subpáginas
  que se abren con ella.
- **Lista de canales laterales para las pruebas**, sacada de sus fugas: búsqueda, «mencionado en», índice de
  subpáginas, tablas del panel, índices de etiquetas, vistas previas de enlaces, portapapeles, exportar, historial de
  versiones y la fuente de actividad. Cada uno, una prueba de que un jugador no recibe nada oculto.
- **Un secreto en una página que edita un jugador** (el diario del grupo) obliga al servidor a fusionar lo que escribe
  sin mandarle el secreto, ni dejarle borrarlo sin querer. Lo más sencillo: las páginas que editan los jugadores no
  admiten secretos sin revelar.
- **Los pines, independientes de su página**, como ellos y como Enrique decidió. Su «quien edita el mapa ve todos los
  pines» no nos vale: en Crisol solo el máster ve los ocultos.
- **El ocultado se tiene que ver.** El pin semitransparente se pierde en un mapa con mucho color: mejor un icono o un
  borde propio, y un filtro de «solo ocultos».
- **El aviso y la lista de lo revelado son nuestros.** No los tienen: su fuente de actividad cuenta ediciones, no lo que
  se revela. Nuestro aviso sale de la acción de revelar, no de editar.
- **«Ver como» por personaje** (no solo «como jugador»), porque el conocimiento de Crisol tiene excepciones por
  personaje.
- **La clave de la API con el menor de los dos papeles** es buena pauta para la IA del jugador: el MCP actúa como su
  usuario y lo oculto le responde «no existe», igual que una página que no existe.

## Fuentes

Centro de ayuda:

- https://www.legendkeeper.com/help/
- https://www.legendkeeper.com/help/sharing-and-settings/
- https://www.legendkeeper.com/help/how-to-hide-pages-from-players-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-add-gm-only-secrets-to-a-page-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-use-page-tabs-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-invite-players-to-a-legendkeeper-project/
- https://www.legendkeeper.com/help/how-to-make-a-legendkeeper-project-public/
- https://www.legendkeeper.com/help/how-to-add-pins-to-a-map-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-search-your-world-in-legendkeeper/
- https://www.legendkeeper.com/help/how-to-see-recent-changes-in-a-legendkeeper-project/

Changelog:

- https://www.legendkeeper.com/changelog/legendkeeper-0-4-cerberus/ (2019: permisos por papel y usuario, herencia)
- https://www.legendkeeper.com/changelog/legendkeeper-0-4-1-secrets/
- https://www.legendkeeper.com/changelog/legendkeeper-0-4-2-pin-permissions/
- https://www.legendkeeper.com/changelog/legendkeeper-0-6-elemental/
- https://www.legendkeeper.com/changelog/legendkeeper-0-6-1-hide-articles-tag-filtering-map-pins/
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-0-0-fates/
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-6-templates/
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-11-hidden-tabs-map-navigation-mode/
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-12-and-a-sneak-peek-at-lk-community/
- https://www.legendkeeper.com/changelog/legendkeeper-0-7-14-optimized-search-queries-upcoming-changes-to-hidden-state/
- https://www.legendkeeper.com/changelog/legendkeeper-0-9-0-0-hydra/ (2021: secretos y modelo de seguridad)
- https://www.legendkeeper.com/changelog/legendkeeper-0-9-1-10/
- https://www.legendkeeper.com/changelog/legendkeeper-0-12-1-2/
- https://www.legendkeeper.com/changelog/legendkeeper-0-13-0-0/
- https://www.legendkeeper.com/changelog/legendkeeper-0-13-2-0/
- https://www.legendkeeper.com/changelog/legendkeeper-0-14-0-0/
- https://www.legendkeeper.com/changelog/legendkeeper-0-14-0-8/
- https://www.legendkeeper.com/changelog/legendkeeper-0-15-3-3/
- https://www.legendkeeper.com/changelog/legendkeeper-0-16-1-0/
- https://www.legendkeeper.com/changelog/legendkeeper-0-18-0-0/
- https://www.legendkeeper.com/changelog/legendkeeper-0-18-0-1/
- https://www.legendkeeper.com/changelog/legendkeeper-0-19-0-0-2/
- https://www.legendkeeper.com/changelog/legendkeeper-0-19-0-1/
- https://www.legendkeeper.com/changelog/legendkeeper-0-21-0/ (27-10-2026: «Ver como», actividad, chat)

Desarrolladores y producto:

- https://www.legendkeeper.com/developers/guide/ (claves y papeles, recursos, documentos, propiedades, bloque secreto)
- https://www.legendkeeper.com/api/v3/openapi.json (campos de oculto y permisos)
- https://www.legendkeeper.com/features/
- https://www.legendkeeper.com/features-collaboration/

Terceros (extractos del buscador):

- https://lobehub.com/mcp/chase-roohms-legendkeeper-mcp
- https://dungeongoblin.com/blog/legendkeeper2021review
