# ADR-0017: Lo que sabe cada campaña, y el servidor que filtra cada lectura

Estado: propuesta (sale de la entrevista de Enrique del 2026-11-06; se confirma al ver las pantallas) · Módulo: 5 (lo que ven los
jugadores)

## Contexto

Hasta el módulo 4, la wiki, el compendio del mundo y lo que está en juego son solo del máster (`page.read`,
`worldContent.read` y `creatures.manage` en `packages/domain/src/policy.ts`). En el módulo 5 los jugadores los leen,
con lo que sabe su campaña (entrevista: `docs/modulos.md` § «### 5. Visibilidad por campaña»):

- lo que se sabe va **por campaña**, con excepciones **por personaje**;
- una campaña empieza sabiendo lo que el mundo marca como conocido, nada, o lo de otra;
- se marcan **páginas** (con herencia a sus subpáginas), **secretos**, **pestañas y pines**, **entradas del compendio
  del mundo**; los **campos y bloques del panel** pueden ser «solo máster»;
- el servidor filtra **todo**: Foundry manda el contenido entero y lo esconde en la interfaz, y por ahí se le escapan
  los secretos por la red, por la búsqueda y por los incrustados (`research/foundry/journal.md`).

El ADR-0003 ya dejó el terreno preparado: cada secreto y cada nota oculta es su propio documento, y la búsqueda, los
enlaces, las versiones y la exportación van por documento. Falta decidir dónde se guarda lo que sabe cada campaña, cómo
se calcula y por dónde pasa cada lectura.

## Decisión

### Qué se guarda

- **Una tabla, `knowledge`**, con lo que se ha marcado, en las dos capas:
  - el mundo, y la campaña (sin campaña: la capa del mundo);
  - qué: el tipo (`page`, `secret`, `tab`, `pin`, `element`, `content`) y su id;
  - la marca: **la conocen** o **no la conocen**;
  - el público: todos, o unos **personajes** (ids de `characters`). En la capa del mundo, solo todos.

  Una fila por campaña (o mundo) y cosa. Pasa por `operation()` como lo demás: cada marca entra en el historial y se
  deshace con el mecanismo del módulo 0. Sin fila, hereda.
- **La campaña** guarda si parte de lo que sabe el mundo (`campaigns.knows_world`, sí por defecto). «Lo mismo que
  otra» copia sus filas al crearla, en la misma operación.
- **«Solo máster»** es un atributo del campo (en `pages.properties`) y del bloque del panel (en `pages.panel`). No
  tiene filas: nunca se revela (para eso, el secreto).
- Las pestañas, los pines, las regiones y las rutas ya tienen `hidden` (módulo 1): pasa a ser su marca en la capa del
  mundo («no lo conoce nadie»), que una campaña puede cambiar con su fila.

### Cómo se calcula

- **Un motor puro** en `packages/domain` (sin base de datos ni Fastify), con lo que necesita: el árbol del mundo (id y
  madre), las filas del mundo y de la campaña, si la campaña parte del mundo, y los personajes de quien lee. Responde
  qué páginas ve y, para cada secreto, pestaña, pin o entrada, si lo ve.
- **Páginas**: se sube desde la página y manda la primera marca; en la misma página, la de la campaña antes que la del
  mundo; sin marca hasta arriba, solo el máster. La herencia es viva porque se calcula al leer, nunca se copia. Una
  campaña que empezó de cero no mira lo que el mundo conoce, pero sí lo que oculta (lo nuevo bajo una página conocida
  nace oculto también para ella).
- **Secretos**: los ve quien ve su página y además lo tiene revelado (su fila en la campaña). Las notas ocultas, nunca.
- **Pestañas, pines, regiones y rutas**: siguen a su página salvo que tengan su marca. Un pin hacia una página que no
  se ve sale sin enlace.
- **Contenido del mundo**: solo con su fila. Lo del sistema se ve salvo un tipo o una sección que la campaña oculte
  (en sus ajustes, sin filas).
- El servidor lo calcula **en cada petición** con el árbol y las filas del mundo (5.000 páginas son milisegundos). Si
  la medida lo pide, se guarda en memoria por mundo y campaña y se tira al cambiar el árbol o las marcas.

### Por dónde pasa cada lectura

- **Quién lee** es una cosa del servidor, nunca del cliente: el máster (lo ve todo), un jugador en una campaña (con sus
  personajes) o el máster **viendo como** un personaje. Las acciones de la wiki reciben la campaña; la política
  `page.read` pasa a dejar entrar a quien juega en el mundo, y el motor decide cada cosa. Lo que no ve, **no existe**
  para él: la misma respuesta que si no existiera (`NotFoundError`).
- **El jugador lee por la API, no por Yjs.** Abrir el cuerpo en Yjs, aunque fuera en lectura, le mandaría el documento
  con el nodo de cada secreto (sin su texto, pero sí dónde está y cuántos hay). El servidor le da el cuerpo ya
  proyectado: sin los secretos que no ve, sin las notas, y con el texto de los que sí ve dentro. Cuando cambia, le llega
  un aviso por `/api/realtime` y lo vuelve a pedir. `/api/collab` le niega todos los documentos, salvo los de una
  página que se le deje editar (`pagina-de-jugadores`, con su propia decisión sobre los secretos de esa página).
- **Cada vía de lectura, con su filtro**: la página, el árbol, los hijos, las recientes, la búsqueda por palabras y por
  significado (la lista de páginas y documentos que ve entra en la consulta), los enlaces y los entrantes, la vista
  previa y los incrustados, las tablas del panel, las pestañas y los mapas, los archivos (solo los que están en algo
  que ve: la portada o el panel de una página que ve, o incrustados en un documento que ve), la hoja, el tiempo real
  (los avisos de la wiki solo le llegan si ve lo que nombran, y sin títulos de lo que no ve) y el MCP, que usa las
  mismas acciones.
- **Revocar es inmediato**: cada petición vuelve a calcular; al cambiar una marca, los jugadores afectados reciben el
  aviso y su interfaz recarga lo que tenga abierto.

### La IA

- Marcar y revelar son acciones de tipo `players` (`packages/domain/src/ai-modes.ts`): en copiloto esperan la
  aprobación, porque lo revelado no se puede «des-saber».
- La IA de un jugador entra con su cuenta por el mismo OAuth y usa las mismas acciones: ve lo que ve él.

### Lo que se acepta (de la revisión, 2026-11-06)

- **Canales laterales de tiempo**, sin contenido: un jugador sabe que «algo cambió» en el mundo (`pagesChanged`, sin
  decir qué), que el texto de una página que ve se guardó aunque fuera en un secreto que no ve, y el orden de las
  recientes y la versión de una página cambian con lo oculto. No delatan títulos, ids ni texto de lo que no ve.
- **Los archivos de un jugador**: se le sirven sin guardar en su navegador (`no-cache`) y la vista que lo decide se
  guarda en memoria 1,5 s (una página con varias imágenes las pide a la vez): revocar un archivo tarda eso como mucho.
- **Quién conecta una IA**: el propietario de la cuenta, el máster de un mundo y quien juega en una campaña. La de
  quien solo juega solo lee; la del máster actúa con sus permisos, como la del propietario.

## Alternativas descartadas

- **Permisos por documento copiados al marcar una carpeta**, como Foundry: se desincronizan en cuanto algo se mueve o
  se crea (`research/foundry/usuarios-y-permisos.md`). La herencia se calcula, no se copia.
- **Seguridad por filas en Postgres (RLS)**: la herencia por el árbol, las dos capas y el público por personaje
  harían las políticas difíciles de leer y de probar; y el MCP, los trabajos y el tiempo real tendrían que llevar la
  identidad a cada conexión. El motor puro se prueba en tabla.
- **El cuerpo en Yjs en solo lectura para el jugador**: delata dónde hay secretos (arriba).
- **Lo que sabe el jugador solo en la capa del mundo**: Enrique juega varias campañas en un mismo mundo que saben cosas
  distintas.
- **Por cuenta en lugar de por personaje**: el conocimiento es del personaje; si pasa a otro jugador, va con él.

## Consecuencias

- Cada vía de lectura de la wiki tiene que recibir quién lee. Las que hoy comprueban `page.read`, `worldContent.read`
  o `creatures.manage` (unas 25 en `apps/server/src`) se repasan una a una, y la prueba de fugas comprueba cada una.
- El jugador no ve en directo lo que escribe el máster carácter a carácter: le llega al guardarse. Para leer la wiki
  basta.
- El motor es la única fuente de verdad: la web pinta lo que le llega y la marca «la ve…» del máster la calcula el
  mismo motor.
- Rendimiento: el árbol y la búsqueda de un jugador con 5.000 páginas, p95 < 300 ms; se mide en la prueba de carga
  que ya existe para la wiki.
