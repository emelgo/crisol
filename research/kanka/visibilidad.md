# Visibilidad para los jugadores en Kanka

Módulo de Crisol: 5. Visibilidad por campaña · Fecha: 2026-11-06 · Versión estudiada: web pública a fecha de hoy
(documentación «latest», blog hasta la 3.17 y página de su MCP de octubre de 2026)

## Pregunta

Las mismas ocho preguntas de la nota de LegendKeeper (`research/legendkeeper/visibilidad.md`): unidad de visibilidad
y niveles, a quién se abre y cómo se lleva un mundo con varios grupos, herencia, revelar en partida, ver como jugador,
enlaces y búsqueda, jugadores que escriben, y problemas conocidos.

**Cómo se leyó.** Solo la web pública: la documentación (docs.kanka.io), la guía para jugadores de su web, el blog con
las notas de versión, la documentación de la API y la página de su MCP. Reddit no se dejó leer y el buscador no dio
hilos. Ni cuenta ni código: Kanka publica el suyo con licencia copyleft y no se abrió. Grado de certeza:

- **[doc]**: documentación oficial.
- **[guía]**: la guía para jugadores de su web (kanka.io/learn/players).
- **[blog]**: notas de versión del blog oficial.
- **[API]**: documentación pública de la API y página del MCP.
- **[inferido]**: deducido, sin comprobar.

Kanka renombró mucho entre 2025 y 2026: los antiguos *posts* (antes *entity notes*) ahora son *artículos*, y los
atributos, *propiedades* [doc].

## Lo que hacen

### El modelo, en breve

Una campaña de Kanka es a la vez el mundo y el grupo: guarda las entradas (personajes, lugares, organizaciones…) y tiene
miembros con papeles [doc]. La propia documentación avisa de que los permisos son complejos: varios sistemas que
funcionan a la vez, en tres capas [doc]:

1. **Permisos de la campaña, por papel.** Cada papel tiene permisos por categoría (ver todos los personajes, crear
   lugares…). De serie hay tres papeles: Administrador (lo ve y lo hace todo), Jugadores y Público (para las campañas
   públicas, solo lectura). Se pueden crear más papeles [doc].
2. **Permisos de cada entrada**: permitir o negar acciones concretas a un papel o a un miembro [doc].
3. **Visibilidad de los elementos** que cuelgan de una entrada (artículos, relaciones, marcadores…): un desplegable
   sencillo [doc].

### 1. Unidad de visibilidad y niveles

| Pieza | Cómo se oculta | Niveles |
|---|---|---|
| Entrada entera | Casilla «privada» al final del formulario | Privada (solo administradores) / según permisos |
| Entrada, fino | Pestaña de permisos | Por acción (ver, editar, borrar, artículos…), por papel y por miembro: permitir, negar o heredar del papel |
| Artículo (texto extra de una entrada) | Desplegable de visibilidad o permisos avanzados | Todos, administradores, solo yo, yo y administradores, miembros, o bien permitir/negar por papel y miembro |
| Propiedad | Candado | Solo administradores |
| Rasgos de personalidad de un personaje | Casilla | Visibles / solo administradores |
| Relaciones, inventario, recordatorios, elementos de misión y de línea temporal, pertenencia a organizaciones | Desplegable de visibilidad | Los cinco niveles de arriba |
| Marcador de mapa, capa, grupo de marcadores | Desplegable de visibilidad | Los cinco niveles |

[doc, API]

- **Sin bloques secretos dentro del texto.** El secreto de Kanka es un artículo aparte: la entrada del mercader es
  visible y su artículo «Pasado» es solo del máster. Su guía de secretos propone tres capas: entrada privada, artículos
  ocultos y visibilidad de los elementos [doc].
- **Encadenamiento de permisos.** Un elemento que une dos entradas (una relación, un marcador que lleva a una entrada)
  solo se ve si también se ve la entrada a la que apunta. Si el villano es privado, la relación «padre de» desaparece
  de la ficha del jugador [doc].
- **«Solo yo» vale entre administradores**: secretos de un co-máster que los demás administradores no ven [doc].
- **Valores por defecto en los ajustes**: privacidad de las entradas nuevas creadas por un administrador, visibilidad
  por defecto de los elementos nuevos y de la personalidad de los personajes nuevos [doc].
- **Sin niebla de guerra.** Su explorador de mapas es para mapas del mundo, no tácticos [doc].

### 2. A quién

- A papeles y a miembros concretos, por entrada y por artículo. Desde 2020 hay permiso, negación y herencia: un «negar»
  al papel con un «permitir» a un miembro concreto deja que solo ese miembro lo vea [blog 0.37]. El blog solo da ese
  orden, y el inverso (negar al miembro, permitir al papel) no se describe [blog, inferido].
- Los elementos con desplegable (artículos sencillos, marcadores) no conocen papeles: todos, administradores o miembros.
  Para un artículo solo de la pícara hay que usar los permisos avanzados del artículo [doc].
- **Varios grupos en un mismo mundo**: no hay un concepto de grupo que sepa cosas. Las dos salidas son una campaña por
  grupo (duplicando el mundo) o un papel por grupo con permisos entrada a entrada [inferido].

### 3. Herencia

- **No hay herencia de visibilidad entre entradas.** El campo «madre» (París dentro de Francia) solo sirve para
  organizar y navegar. No consta que pase la privacidad ni los permisos a las hijas. Archivar una madre tampoco afecta a
  las hijas [doc].
- **La herencia que sí hay es del papel**: los miembros reciben los permisos de sus papeles, y «heredar» en una entrada
  significa «lo que diga el papel» [doc, blog 0.37].
- **El remedio para muchas entradas es el cambio en lote**: añadir, sustituir o quitar permisos a varias entradas
  seleccionadas. Es una copia, no un vínculo [doc]. La propia documentación pone el ejemplo de quien invita por fin a
  sus jugadores y descubre que pueden leer todas sus tramas [doc].
- **Una hija puede ser más abierta que su madre, y la ruta se rompe.** Su guía para jugadores avisa: un lugar público
  dentro de una región privada pierde las migas de pan [guía].

### 4. Revelar en partida

- **Entrada**: abrir el formulario y quitar «privada», o cambiar sus permisos. **Artículo**: desde 2023, su visibilidad
  se cambia desde la vista de la entrada, sin abrir el editor [doc, blog 2.0].
- **Su recomendación es un ritual tras cada sesión**: pasar a público las entradas y los artículos que el grupo ha
  descubierto [guía].
- **Sin aviso al jugador ni marca de «nuevo»** en lo publicado [inferido: no aparece en la documentación]. Lo más
  cercano:
  - un panel propio para los jugadores, con bloques como «modificado hace poco» o los PNJ conocidos, que solo muestran
    lo que el jugador puede ver [doc, guía].
  - los webhooks (de pago): avisan a una dirección externa, como un canal de Discord, al crear, cambiar o borrar
    entradas, y se pueden limitar a unas etiquetas. Su carga lleva la entrada con su texto y su marca de privada [doc].
  - el historial de cambios de la campaña, solo para administradores y de pago [doc].
- **Lo revelado no tiene lista propia.** El administrador puede filtrar las listas de entradas, pero nada resume «lo que
  sabe el grupo» [inferido].

### 5. Ver como jugador

- **«Ver la campaña como el miembro»**, desde la lista de miembros o desde la página de permisos de una entrada. Se
  vuelve con un enlace arriba de cada página. Existe desde 2021 [doc, blog].
- Es por miembro, no por papel: para ver lo de un papel hace falta un miembro con ese papel [doc].
- **Lo que se edita mientras se mira como otro queda registrado** como hecho así en el historial de la entrada [doc].
- **No enseña lo de «solo yo» del otro**: el administrador no puede leer así lo que un jugador guarda para sí [doc].
- Su guía lo propone como auditoría mensual: lo que no se ve desde el lado del máster sale al mirar como jugador [guía].

### 6. Enlaces, menciones y búsqueda

- **Una mención a una entrada que no se puede ver sale como texto «desconocido»**, sin enlace. Si la mención lleva un
  texto propio, sale ese texto [doc].
- **Un ajuste de la campaña cambia eso**: mostrar el nombre de las entradas privadas mencionadas a quien no puede verlas
  [doc].
- Las menciones se renombran solas al cambiar el nombre de la entrada, salvo las que llevan texto propio [doc].
- Se puede incrustar la descripción de otra entrada dentro de un texto (transclusión) [doc]. No consta cómo se comporta
  si esa entrada es privada [inferido: lo lógico es «desconocido»].
- **La búsqueda** busca por nombre y, si se pide, por el texto completo [doc]. Su MCP solo busca entre las entradas
  visibles y avisa de que lo que no encuentra puede ser algo que no se le deja ver [API].

### 7. Jugadores que escriben

- **Por papel**: un papel puede crear personajes, y quien crea uno puede editarlo y borrarlo aunque su papel no edite
  [doc].
- **Por entrada**: dejar editar un lugar a un miembro concreto [doc].
- **Solo los artículos**: un papel puede añadir artículos a una entrada sin poder editarla (las pistas que apuntan los
  jugadores sobre un PNJ) [doc].
- **Notas propias**: con la visibilidad «solo yo», un jugador guarda elementos que nadie más ve, ni el máster [doc].
  Hay además conversaciones dentro de la campaña, que respetan los permisos de ver [doc].

### 8. API e IA

- Las fichas de acceso a la API son de cada usuario [doc]. Su MCP (octubre de 2026) es de solo lectura, actúa con los
  permisos de la cuenta y solo ve los mundos de los que es miembro [API, blog]. No dice si pensaron en jugadores, pero
  un jugador lo conectaría con su cuenta y vería lo suyo [inferido].

### 9. Problemas conocidos

- **Complejidad admitida**: tres sistemas a la vez, y negar/heredar/permitir por papel y por miembro [doc].
- **Rendimiento**: con diez miembros o más, la pestaña de permisos desaparece del formulario de la entrada, porque
  calcular los permisos de cada uno cuesta demasiado. Hay que guardar la entrada y entrar en su página de permisos [doc].
- **Su lista de auditoría nombra las fugas típicas**: artículos privados que se quedan públicos en entradas recién
  editadas, y madres privadas que esconden la ruta de hijas públicas [guía].
- **El papel de jugadores nace vacío**: un invitado entra y no ve nada hasta que se le dan permisos [doc].
- Reddit no se pudo leer y el buscador no dio quejas concretas.

## Compromisos y límites

Gana en precisión: cada acción, cada papel y cada miembro, en cada entrada y cada artículo, y un desplegable sencillo
para los elementos. El encadenamiento evita que una relación destripe a quien está al otro lado. El precio:

- **Sin herencia de visibilidad.** Cada entrada se configura sola, y el cambio en lote es una copia: si después cambia
  la región, sus lugares no se enteran.
- **Rutas rotas**: una hija pública bajo una madre privada se queda sin migas de pan.
- **Sin noción de grupo**: varios grupos en un mundo se hacen a mano, con papeles y permisos entrada a entrada, o
  duplicando la campaña.
- **Sin secretos dentro del texto**: todo lo oculto de una entrada va a un artículo aparte, que luego hay que acordarse
  de abrir.
- Sin aviso ni lista de lo revelado. Los webhooks avisan fuera, no al jugador.
- El cálculo de permisos ya es caro con diez miembros.

## Qué nos llevamos a Crisol

Pensando en la decisión de Enrique (conocimiento por campaña con excepciones por personaje, herencia viva, secretos,
pines y campos «solo máster», revelar con aviso, «ver como jugador», el servidor lo filtra todo):

- **El encadenamiento, como regla general.** Una fila de una tabla del panel («Miembros»), un enlace de «mencionado en»,
  un pin o una relación que lleva a una página oculta no se ve, aunque su página sí. Es la misma comprobación en todos
  los sitios, y conviene que la spec la diga una vez.
- **«Desconocido» para los enlaces**, y el texto propio si el enlace lo lleva. Su ajuste de mostrar el nombre real nos
  sobra: el nombre de algo oculto también es un secreto.
- **Cuidado con renombrar.** Sus menciones se renombran solas. En Crisol, si los enlaces muestran el nombre actual de
  la página, renombrar una página oculta enseñaría el nombre nuevo en todas las visibles que la enlazan. Para un jugador,
  un enlace a algo oculto nunca dice el nombre del destino.
- **Su «ver como» trae dos detalles buenos**: lo que el máster cambie mientras mira como otro se marca en el historial,
  y la vista se elige por persona. En Crisol, por personaje y por campaña.
- **La ruta rota es real**, y Enrique permite excepciones en cualquier subpágina. Mismo apunte que en LegendKeeper:
  decidir en la spec cómo se ven la ruta y el árbol cuando una hija está abierta y su madre no.
- **La herencia viva de Enrique es mejor que su lote.** Kanka demuestra lo que pasa sin ella: el máster configura cada
  entrada, y al invitar a los jugadores se encuentra todo abierto. La nuestra, con el «de dónde viene» a la vista.
- **Los secretos dentro del texto son mejores que su artículo aparte**: el secreto se queda junto a lo que matiza. Del
  artículo nos llevamos una idea: varios secretos de una página se revelan por separado.
- **Los valores por defecto, en la campaña.** Su ajuste de privacidad por defecto encaja con el arranque de Enrique: una
  campaña empieza sabiendo lo que el mundo marca como conocido, nada, o lo mismo que otra.
- **El panel del jugador con «lo nuevo»** es lo más parecido a nuestro aviso: una lista de lo revelado hace poco, filtrada
  por lo que ve cada uno. Nuestro aviso puede llevar ahí.
- **Los webhooks, nunca con contenido oculto.** Su carga lleva el texto y la marca de privada. Si Crisol avisa fuera
  (Discord, correo), que solo mande lo que ya ve el destinatario.
- **Calcular la visibilidad sin que cueste**: Kanka se rinde con diez miembros. Con campañas, personajes, excepciones y
  herencia, conviene tener lo visible por campaña ya calculado, y no recalcularlo en cada lectura.
- **El MCP del jugador, como el suyo**: actúa con su cuenta, solo ve lo suyo y avisa de que «no encontrado» puede ser
  «no lo sabes».

## Fuentes

Documentación oficial (docs.kanka.io, versión «latest»):

- https://docs.kanka.io/en/latest/features/permissions.html
- https://docs.kanka.io/en/latest/advanced/visibility.html
- https://docs.kanka.io/en/latest/guides/secrets.html
- https://docs.kanka.io/en/latest/guides/testing-permissions.html
- https://docs.kanka.io/en/latest/features/articles.html
- https://docs.kanka.io/en/latest/features/properties.html
- https://docs.kanka.io/en/latest/features/mentions.html
- https://docs.kanka.io/en/latest/features/search.html
- https://docs.kanka.io/en/latest/features/nested.html
- https://docs.kanka.io/en/latest/entries/characters.html
- https://docs.kanka.io/en/latest/entries/locations.html
- https://docs.kanka.io/en/latest/entries/maps.html
- https://docs.kanka.io/en/latest/entries/maps/markers.html
- https://docs.kanka.io/en/latest/entries/maps/layers.html
- https://docs.kanka.io/en/latest/entries/maps/groups.html
- https://docs.kanka.io/en/latest/entries/conversations.html
- https://docs.kanka.io/en/latest/guides/bulk.html
- https://docs.kanka.io/en/latest/guides/archives.html
- https://docs.kanka.io/en/latest/guides/dashboard.html
- https://docs.kanka.io/en/latest/features/campaigns/members.html
- https://docs.kanka.io/en/latest/features/campaigns/campaign-settings.html
- https://docs.kanka.io/en/latest/features/campaigns/public-campaigns.html
- https://docs.kanka.io/en/latest/features/campaigns/webhooks.html
- https://docs.kanka.io/en/latest/features/history.html
- https://docs.kanka.io/en/latest/advanced/api.html

Web y blog oficiales:

- https://kanka.io/learn/players
- https://blog.kanka.io/2020/05/14/release-037-negative-permissions-yearly-subs-and-performance
- https://blog.kanka.io/2021/08/04/kanka-1-13-entity-notes-become-posts-and-role-permissions
- https://blog.kanka.io/2026/10/27/kanka-mcp/
- Vistas solo en los extractos del buscador: https://blog.kanka.io/2020/12/16/release-0-50-map-improvements-and-entity-notes-custom-permissions,
  https://blog.kanka.io/2021/01/18/kanka-v1-0-text-editor-entity-links-pinned-entity-notes,
  https://blog.kanka.io/2021/02/05/testing-your-campaign-permissions y
  https://blog.kanka.io/2023/11/01/2-0-harder-better-faster-stronger

API y MCP:

- https://app.kanka.io/api-docs/1.0/misc/visibilities
- https://app.kanka.io/mcp
