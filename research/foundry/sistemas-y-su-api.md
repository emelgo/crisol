# Sistemas de juego en Foundry VTT y el API que usan

Módulo de Crisol: 3. Sistemas, fichas y dados · Fecha: 2026-11-04 · Versión estudiada: Foundry VTT 14.369 y dnd5e
6.0.6

## Pregunta

Enrique quiere que Crisol pueda instalar un sistema de Foundry tal cual, también su código (sus hojas y su
automatización), y no solo sus datos. Antes de la spec del módulo 3 hay que saber cuánto mide eso y qué riesgos trae:

1. **Cómo está hecho un sistema**: manifiesto, modelos de datos, hojas, tiradas, compendios, traducciones, ajustes,
   ganchos y migraciones. Qué corre en el navegador y qué en el servidor.
2. **Cuánto API de Foundry usa un sistema real** (dnd5e), por áreas, y qué parte hace falta para abrir una hoja de
   personaje y tirar desde ella, frente a lo que es de la mesa (lienzo, fichas, visión), que en Crisol es otro módulo.
3. **Qué haría falta para ejecutar ese código en Crisol con seguridad**, siendo un SaaS multiusuario: aislamiento,
   puente de mensajes, qué partes serían un adaptador a los datos de Crisol, y los riesgos.
4. **Licencias**: el EULA de Foundry, la de dnd5e (código, contenido e imágenes), las de otros sistemas populares y el
   uso de la marca. Qué hay que preguntar a un abogado.
5. **Qué nos llevamos**: cómo encajan los sistemas propios de Crisol (datos) con una capa que ejecute el código de un
   sistema de Foundry, y en qué orden construirlo.

## Lo que hacen

Grado de certeza: **[O]** observado (leído en los archivos instalados, medido con el análisis estático de abajo o
leído en la web pública de cada proyecto) e **[I]** inferido. No se arrancó la instancia: nada está visto en
ejecución.

**Cómo se midió.** Con craft-anything se hizo el inventario de la carpeta del sistema, el mapa de su código y del
servidor de Foundry, y se recuperaron las fuentes originales del sistema desde su mapa de fuentes. Después, un
analizador propio (fuera del repo, con un parser de JavaScript) cruzó dos índices: lo que el cliente de Foundry pone
al alcance de un sistema (sus globales, los alias heredados, sus 729 clases con sus métodos y los campos de sus
esquemas, los ayudantes de plantillas y los elementos HTML propios) y lo que el sistema usa (las cadenas de miembros
que parten de esos globales, las clases que hereda, los métodos que sobrescribe, las llamadas al padre, los nombres
de miembro que lee y lo que piden sus plantillas). Las cifras son aproximadas: un análisis estático no ve los accesos
calculados en ejecución, y los miembros de instancia solo se pueden contar por su nombre.

### 1. Cómo está hecho un sistema

| Pieza | Qué es en dnd5e | Dónde corre |
|---|---|---|
| Manifiesto | Un JSON con id, versión, compatibilidad con Foundry (mínima 14.367 y verificada la 14), los subtipos de cada clase de documento con lo que debe sanear el servidor, 23 compendios con su clase de documento y su permiso por rol, carpetas para agruparlos, un solo idioma (inglés), un módulo de código, una hoja de estilos, si quiere un canal de socket, las unidades de la cuadrícula, el atributo que enseña la barra de la ficha de mesa y unas banderas propias (de qué versión puede migrar) [O] | Lo lee el servidor |
| Código | Un único módulo ES de 3,5 MB, generado desde 405 archivos con unas 97.000 líneas: aplicaciones y hojas 35.000, modelos de datos 26.000, documentos 18.000, configuración 5.000, enriquecedores de texto 1.900, dados 1.700, lienzo 1.500 y migraciones 1.300 [O] | Navegador |
| Modelos de datos | Los datos de cada subtipo son una clase que hereda el modelo tipado de Foundry y se arma con grupos de campos reutilizables (ver `tipos-de-documento.md`). Además define sus propias clases de campo, heredando las de Foundry [O] | Navegador |
| Documentos | Hereda las clases de documento de Foundry (actor, objeto, efecto, mensaje, combate, ficha de mesa, página de diario, tabla, usuario…) y las registra en la configuración global al arrancar. Ahí calcula los datos derivados (CA, salvaciones, espacios de conjuro…) [O] | Navegador |
| Hojas | Clases sobre el marco de aplicaciones de segunda generación de Foundry (ApplicationV2) con plantillas Handlebars por partes, y unas pocas aún sobre el marco antiguo: conviven las dos generaciones [O]. Se registran por tipo de documento. 326 plantillas con unas 11.800 líneas y 105 parciales. Usan 18 de los 26 ayudantes de plantilla de Foundry y 6 de sus 17 elementos HTML propios (entre ellos el editor de texto enriquecido), además de unos diez elementos propios [O] | Navegador |
| Estilos | Medio megabyte y unas 3.000 reglas. Usan 57 variables de CSS que no definen, y 48 vienen del CSS del núcleo: el aspecto de la hoja depende de la hoja de estilos de Foundry [O] | Navegador |
| Tiradas | Hereda la tirada y el dado de Foundry (básica, de d20, de daño) y los registra. El motor de Foundry analiza la fórmula con su propia gramática, evalúa términos y modificadores, saca el azar en el cliente con un generador propio y pinta el detalle y la tarjeta del chat [O] | Navegador |
| Chat | Las tarjetas de tirada, de uso de objeto o de descanso son 19 subtipos de mensaje con su propio modelo de datos [O] | Navegador. El servidor guarda el mensaje |
| Compendios | En disco, cada compendio es una carpeta LevelDB. Cada documento va en su clave, con un prefijo de colección, y los incrustados (los objetos de un actor, sus efectos) en claves aparte [O]. Ocupan 19 MB. La herramienta de línea de órdenes oficial de Foundry, con licencia MIT, los pasa a JSON o YAML y vuelta [O, web] | Los sirve el servidor |
| Traducciones | Un JSON por idioma con unas 4.060 claves, y solo trae el inglés [O]. Los modelos declaran un prefijo y las etiquetas de sus campos salen solas de las claves [O]. El español llega con módulos de la comunidad, y para traducir el contenido de los compendios dnd5e trata aparte un módulo de traducción concreto [O que lo trata. I que sea la vía habitual] | Navegador |
| Ajustes | 59 ajustes: 50 del mundo, 7 del navegador y 1 del usuario. 36 no salen en la pantalla de ajustes y hay 6 menús propios [O]. Los del navegador, Foundry los guarda en el almacenamiento local del origen [O] | Navegador. Los del mundo los guarda el servidor |
| Ganchos | Escucha unos 30 ganchos del núcleo y uno de un módulo de traducción (el arranque, el pintado de barras laterales, chat, ajustes y hojas, menús contextuales, el lienzo, la creación de mensajes, el paso del tiempo) y dispara más de un centenar propios (antes y después de cada tirada, de cada descanso…) para que los módulos se enganchen [O] | Navegador |
| Migraciones | Dos niveles, descritos en `tipos-de-documento.md`: al leer, cada modelo pasa los datos viejos a la forma actual; al entrar el máster tras actualizar, el sistema reescribe el mundo. Aquí, 1.300 líneas más la migración de cada modelo [O] | Navegador del máster |

**¿Tiene un sistema código de servidor? No** [O]. El servidor de Foundry lee el manifiesto, guarda los documentos,
sanea los campos que declara el manifiesto, sirve los archivos y mete en la página del juego las etiquetas de los
módulos de código y de los estilos del sistema, del mundo y de los módulos activos. No importa ni ejecuta nada de
ellos. Si el manifiesto pide socket, abre un canal con el nombre del paquete y reenvía cada mensaje a los demás
clientes o a los que se indiquen, sin mirarlo [O]. dnd5e lo pide, pero su código no lo usa [O, estático].

**Confianza**: el código del sistema corre en la misma página y el mismo origen que la sesión del usuario, con todo el
API y todos los datos que ese cliente tiene en memoria. Foundry no aísla los paquetes: da por hecho que quien los
instala se fía de ellos [I, por cómo los inyecta el servidor]. Y como el servidor no conoce los modelos de los
subtipos, la validación de los datos del sistema también es cosa del cliente (ver `tipos-de-documento.md`).

Otros detalles que importan para aislarlo [O]:

- dnd5e no usa `eval` ni construye funciones desde texto, pero Foundry sí: compila las plantillas Handlebars en el
  navegador al pedirlas y evalúa la aritmética de las fórmulas construyendo una función.
- Escribe HTML a mano unas 70 veces (asignando o insertando HTML), además de lo que pintan las plantillas.
- Descarga sus propios JSON de migración y, para su pantalla de bienvenida, una lista de contenido desde un dominio
  externo.
- No toca el almacenamiento local por su cuenta: lo hace a través de los ajustes de Foundry.

### 2. El tamaño del API que usa dnd5e

**Entradas desde los globales** (el espacio de nombres de Foundry, el juego, la configuración, la interfaz, el lienzo,
los ganchos, las constantes y las bibliotecas que la página deja globales): **unos 490 miembros distintos y unos
6.300 usos** [O]. Por áreas:

| Área | Miembros | Usos | Qué abarca |
|---|---:|---:|---|
| Lienzo y mesa | 107 | 270 | El lienzo y sus capas, las fichas de mesa, plantillas de área, regiones, cuadrícula, detección y visión, combate e iniciativa, y su configuración |
| Documentos y su base de datos | 80 | 683 | Clases de documento y su configuración, colecciones del mundo, compendios, resolver UUID (también de forma síncrona), operaciones por lotes, borrar o reemplazar un campo al actualizar |
| Aplicaciones y hojas | 78 | 268 | Marco de aplicaciones, hojas de documento, diálogos, formularios, arrastrar y soltar, menús contextuales, descripciones emergentes, atajos de teclado, elementos HTML propios, barras laterales |
| Utilidades | 37 | 955 | Fusionar y clonar objetos, leer y escribir por ruta, comparar versiones, identificadores, colores, colecciones, ordenar |
| Tiradas y dados | 31 | 225 | Tirada, dados, términos, su configuración y su diálogo |
| Modelos de datos y campos | 25 | 1.748 | El modelo tipado y una veintena de clases de campo |
| Usuarios y permisos | 18 | 197 | Usuario actual, si es máster, sus banderas y permisos, el máster activo |
| Paquetes y mundo | 17 | 51 | El sistema, los módulos activos, el mundo, el arte de los compendios |
| Efectos activos | 15 | 79 | Efectos y estados, cómo se aplican sus cambios |
| Chat | 14 | 83 | Crear y leer mensajes, quién habla, el registro del chat |
| Ajustes | 9 | 202 | Registrar, leer y escribir ajustes y menús, atajos |
| i18n | 8 | 1.098 | Traducir, formatear listas, idioma, localizar un modelo |
| Configuración global | 8 | 26 | Claves sueltas de la configuración |
| Ganchos | 7 | 174 | Escuchar, disparar y avisar de errores |
| Tiempo y calendario | 6 | 60 | Hora del mundo y calendario |
| Plantillas | 6 | 24 | Cargar y pintar plantillas, registrar ayudantes, escapar HTML |
| Biblioteca gráfica del lienzo | 6 | 8 | Formas, texturas y filtros |
| Texto enriquecido | 5 | 72 | Enriquecer HTML (enlaces, tiradas en línea), el editor y sus extensiones |
| Constantes | 5 | 9 | Enumeraciones |
| Avisos | 4 | 82 | Avisos emergentes |
| Sockets | 0 | 0 | No lo usa |

**Herencia, que es la mayor parte del contrato** [O]: dnd5e hereda directamente **66 clases de Foundry** (en 139 de
sus 425 clases; 371 tienen una de Foundry por encima) y **sobrescribe unos 360 métodos de 72 clases de Foundry**, de
ellos unos 200 protegidos (internos). Además llama al método del padre en 245 nombres distintos (140 protegidos). Por
carpeta de Foundry, las sobrescrituras caen en aplicaciones (136), documentos (79), campos de datos (46), modelos y
documento abstractos (27), lienzo (24), el marco de aplicaciones antiguo (20) y dados (10). Esto no se arregla con
dar los mismos nombres: hay que llamar a esos métodos en el mismo orden y con los mismos datos que Foundry, porque el
sistema mete su lógica en medio del ciclo de vida (preparar datos, antes y después de crear, de cambiar o de borrar,
preparar el contexto de una hoja, pintar sus partes, aplicar el cambio de un efecto campo a campo…).

**Miembros de instancia** (lo que lee de un actor, una hoja o una tirada ya creados), contados por nombre y quitando
los nombres genéricos de JavaScript y del DOM: unos **250 nombres que solo pueden ser de Foundry** y otros **380 que
el sistema también define** y no se pueden atribuir [O]. Los inequívocos se reparten sobre todo entre documentos,
lienzo, aplicaciones y dados.

**Cuánto código de Foundry hay detrás** [O, con un criterio grueso]: las 176 clases que toca (directamente o por sus
padres) viven en 153 archivos con unas **42.000 líneas de código sin comentarios, de unas 110.000** del cliente y el
código común. Sin la carpeta del lienzo, unas 32.000. No cuenta el código que no son clases (el juego, la
configuración, las constantes, las utilidades, los ganchos, las traducciones, los ajustes) ni lo que esas clases usan
por dentro. Una reimplementación no tendría por qué medir lo mismo, pero da el orden de magnitud.

**Cuánto cambia el API** [O]: el código de la 14 lleva unos 150 avisos de compatibilidad por cosas cambiadas en la 14
y unos 110 por la 13, además de unos 390 nombres globales que en la 13 pasaron a su espacio de nombres y siguen como
alias hasta la 15. dnd5e lleva otros 39 avisos propios. Cada generación de Foundry mueve cientos de puntos del API.

#### Hoja frente a mesa

Se repartió cada archivo del sistema en un grupo según su carpeta y se contó qué miembros usa cada grupo [O]:

| Grupo | Archivos | Miembros del API |
|---|---:|---:|
| Arranque (registro, configuración, ajustes, migración) | 38 | 182 |
| Hoja y tiradas (hojas, modelos, documentos, actividades, efectos, dados, tarjetas del chat) | 231 | 275 |
| Creador y subida de nivel (avances) | 47 | 61 |
| Compendio y diario | 25 | 68 |
| Calendario | 7 | 27 |
| Mesa (lienzo, combate, regiones, fichas de mesa) | 23 | 141 |

- **Arranque más hoja y tiradas: unos 375 miembros.** Por áreas: documentos 72, aplicaciones 66, lienzo 38,
  utilidades 31, dados 31, modelos 24, usuarios 15, efectos 14, paquetes 14, chat 14 y el resto, menos de 10 cada
  una [O].
- **Lo que solo usa la mesa: unos 90 miembros**, casi todos del lienzo (68) [O].
- **La hoja toca el lienzo** (38 miembros) para cosas que en la hoja son normales: los objetivos seleccionados al
  tirar daño, colocar la plantilla de un conjuro de área, invocar criaturas, la concentración como estado, tirar
  iniciativa, el texto flotante al perder puntos de golpe y la configuración de la ficha de mesa del personaje [O].
  Casi nunca lo protege: de unas cien referencias al lienzo, solo cinco usan acceso opcional y seis miran si está
  listo [O]. En Crisol el lienzo tendría que existir como sustituto que responda «no hay escena».
- **El sistema es un solo paquete**: al cargarlo se definen todas sus clases, también las de la mesa. Si una clase de
  Foundry que hereda no existe, la carga entera falla [I, por cómo funciona la herencia de clases en JavaScript]. Así
  que las 66 clases base tienen que existir aunque Crisol nunca pinte una ficha de mesa.

#### Lo imprescindible para abrir una hoja de personaje y tirar desde ella [I, por el reparto anterior]

| Pieza | Sin ella… |
|---|---|
| Las 66 clases base, aunque sea vacías, y los espacios de nombres | No carga el sistema |
| Configuración global, ganchos y el orden de arranque (iniciar, preparar, traducciones, listo) | No se registra nada: ni tipos, ni hojas, ni ajustes |
| Modelos de datos y campos con todo su comportamiento (limpiar, validar, iniciar, migrar, aplicar cambios de efectos) | No se preparan los datos del personaje |
| Documentos con sus colecciones incrustadas, su ciclo de cambios, banderas y permisos, y **el mundo en memoria con búsqueda síncrona** por id o UUID (unos 60 usos de la búsqueda síncrona) | No hay actor que enseñar ni objetos que listar |
| Marco de aplicaciones, mezcla de Handlebars, hoja de documento y de actor (partes, pestañas, acciones, formularios, arrastrar y soltar, menús, descripciones emergentes), ayudantes y elementos propios, incluido el editor de texto enriquecido | No se pinta la hoja |
| Traducciones y ajustes | La hoja sale con claves en vez de textos, o falla al leer un ajuste |
| Motor de tiradas (gramática, términos, modificadores, evaluación y su presentación), diálogos de tirada, mensajes del chat y enriquecer texto (enlaces y tiradas en línea) | No se tira desde la hoja |
| Usuarios (quién es máster), avisos, compendios (índice y carga, para soltar un conjuro o un objeto) | Fallan acciones sueltas |

## Compromisos y límites

- **Un sistema es código que extiende el cliente, no datos.** Por eso un sistema puede hacer cualquier cosa (dnd5e
  hace su propio creador, sus tarjetas, sus enriquecedores…). El precio: el contrato real entre sistema y Foundry no
  es una lista de funciones, sino unas 66 clases heredadas, 360 métodos sobrescritos y el orden en que Foundry los
  llama. Para ejecutarlo fuera hay que imitar el comportamiento, no solo la forma.
- **Toda la lógica vive en el cliente.** El servidor no sabe calcular una CA ni validar un personaje. En Foundry da
  igual porque cada cliente lo calcula. En Crisol choca con dos cosas: el servidor es quien valida y la IA, por el
  MCP, necesita los valores derivados.
- **El cliente tiene el mundo entero en memoria** y el sistema busca documentos de forma síncrona. Crisol no manda el
  mundo entero a cada cliente (y el módulo 5 filtrará lo que ve cada jugador): habría que precargar lo que la hoja
  pueda pedir.
- **Paquetes de plena confianza.** El código del sistema puede leer todo lo que ve el usuario y actuar en su nombre.
  Foundry lo acepta porque cada mesa es de quien la instala. En un SaaS con muchos mundos no vale.
- **El API se mueve mucho**: cientos de cambios por generación, y el sistema fija la mínima y la verificada. Un
  sistema hecho para la 14 no se instala en la 13. Mantener una capa compatible es un trabajo
  que no acaba.
- **La apariencia es la de Foundry**: la hoja de un sistema de Foundry depende de su CSS y de su marco de ventanas. No
  saldría con el aspecto de Crisol ni por bloques.
- **Los sistemas no van solos**: el español llega por módulos de traducción, y muchos sistemas de la comunidad
  incluyen o piden bibliotecas que son módulos (uno de los populares trae una de sockets). Los módulos que parchean
  métodos internos de Foundry no se pueden atender sin reproducir esos internos.
- **Lo bueno**: el manifiesto es claro y declarativo (tipos por clase de documento, qué sanear, compendios, idiomas,
  compatibilidad). Los compendios en LevelDB tienen una herramienta oficial MIT para pasarlos a JSON. Y el código de
  dnd5e está bien partido: el lienzo es una parte pequeña y casi aparte.

### Licencias

No es asesoría legal. Lo que dicen los textos:

**EULA de Foundry** (versión 11.293 de marzo de 2023. La copia instalada y la de su web coinciden) [O]:

- Con cada licencia se puede tener una sola instancia alojada accesible para otros. Prohíbe vender o alquilar el
  programa, su clave o el acceso a él, y publicar partes del programa salvo lo que permite la licencia para paquetes.
- **Licencia para paquetes** (sistemas, módulos, mundos): pueden usar, citar o copiar partes del código de Foundry,
  solo lo estrictamente necesario. **No se permite publicar paquetes que incluyan o citen su código y funcionen sin el
  programa base**, y se distribuyen para usarlos con una copia con licencia. Se puede vender el contenido propio de un
  paquete.
- No habla de ingeniería inversa ni de interoperabilidad. Dice que no se interprete como límite a los usos legítimos
  que permita la ley de derechos de autor. Se rige por la ley de Washington (EE. UU.).

Lo que se deduce [I]:

- Crisol no puede llevar ni una línea de Foundry, tampoco su cliente para ejecutar sistemas. La única vía es un API
  compatible escrito en sala limpia.
- La cláusula de «funcionar sin el programa base» obliga a los autores de paquetes, no a Crisol. Pero es la base con
  la que Foundry Gaming podría quejarse, y pone en un aprieto a un autor que quisiera adaptar su sistema a Crisol.
- Un paquete puede llevar trozos copiados del código de Foundry (la licencia de paquetes lo permite). Esos trozos no
  son MIT aunque el resto lo sea: servirlos desde Crisol sería servir código de Foundry.

**dnd5e** [O]:

| Parte | Licencia |
|---|---|
| Código | MIT |
| Texto de reglas | Material del SRD 5.1 y del SRD 5.2, CC BY 4.0, con su atribución |
| Fichas de criaturas (arte de mesa) | De un estudio de mapas y fichas. Solo dentro de Foundry |
| Arte oficial, iconos de escuelas de magia | De Wizards of the Coast. Solo para ejecutar dnd5e dentro de Foundry |
| Iconos de niveles de conjuro y fichas compuestas | De otros artistas. Solo con el sistema dentro de Foundry |
| Iconos SVG propios | De un repositorio de iconos libre, CC BY 3.0, con atribución |
| Fuentes | Apache 2.0 |
| Imágenes que citan los compendios | Sobre todo iconos del núcleo de Foundry (cientos en los monstruos), de un lote comercial con licencia para usarlos dentro de Foundry y no fuera |

Así que **«instalar dnd5e tal cual» en Crisol no es posible del todo**: el código y el texto del SRD sí viajan, pero
buena parte de las imágenes del sistema y de las que citan sus compendios no se pueden servir fuera de Foundry [I].
El nombre del juego es marca de Wizards of the Coast, y la licencia CC del SRD no da derechos de marca [O].

**Otros sistemas populares** (por su web pública) [O, web]:

| Sistema | Código | Contenido y arte |
|---|---|---|
| Pathfinder 2e | Apache 2.0 | Mecánicas con la OGL 1.0a. El contenido de Paizo va por un acuerdo entre Foundry Gaming y Paizo. El arte, con su licencia archivo a archivo. El README dice que el sistema se acoge a la licencia de paquetes de Foundry |
| Daggerheart (el que se presenta como sistema oficial en la web de Foundry) | MIT | El SRD con la licencia comunitaria de Darrington Press. El resto (logos, imágenes) solo dentro de Foundry. Se declara para uso personal o no comercial |
| Pathfinder 1e | GPL 3.0 | OGL 1.0a y la política de uso comunitario de Paizo |
| Call of Cthulhu 7e | GPL 3.0, e incluye una biblioteca de sockets MIT | Con la política para fans de Chaosium: prohíbe cobrar por usar el contenido, lo limita a Foundry y no da derechos comerciales |
| Warhammer Fantasy 4e | Apache 2.0 (según un índice de repositorios) | Publicado por Cubicle 7. El contenido de los libros va en módulos oficiales aparte |
| Shadowdark | MIT | Con la licencia de terceros de su editorial |
| Level Up (A5E) | MIT | Reglas con la OGL |

Patrón [I]: el código suele ser permisivo (MIT o Apache), pero hay sistemas populares GPL. El contenido y el arte casi
siempre están limitados a Foundry o a uso no comercial, y las políticas de fans de algunas editoriales prohíben cobrar:
en un servicio de pago como Crisol, aunque el código pudiera correr, ese contenido no podría ir.

**Marca** [O, web]: no encontramos el registro de «Foundry Virtual Tabletop» o «Foundry VTT». Decir que algo es
compatible con un producto de otro se suele permitir si es para indicar el destino del producto y de buena fe (en la UE,
el reglamento de la marca de la Unión, art. 14; en EE. UU., el uso nominativo). En la interfaz de Crisol el nombre no
sale, como dice `CLAUDE.md`.

**Para el abogado** [I]:

1. Directiva 2009/24/CE: las ideas y principios de un programa, también los de sus interfaces, no están protegidos
   (art. 1.2). Quien tiene licencia puede observar, estudiar y probar el programa (art. 5.3). La descompilación para
   interoperar se permite con condiciones (art. 6). Y el contrato no puede anular esas excepciones (art. 8). La
   sentencia SAS Institute (TJUE, C-406/10, 2012) dice que la funcionalidad, el lenguaje y los formatos de datos no
   son expresión protegida. ¿Cubre esto un API compatible con los mismos nombres de clases y métodos para que corra
   código de terceros? ¿Y con un EULA regido por la ley de Washington?
2. En EE. UU., Google contra Oracle (2021) trató la reimplementación de las declaraciones de un API como uso legítimo
   sin decidir si son protegibles. ¿Aplica aquí?
3. ¿Qué procedimiento de sala limpia hace falta? Aquí lo estudiamos leyendo su código instalado con licencia (no hizo
   falta descompilar: el JavaScript es legible). ¿Basta con que el adaptador se escriba solo desde estas notas, la
   documentación pública del API y el comportamiento observado?
4. Si Crisol sirve el código de un sistema MIT, Apache o GPL, lo distribuye. ¿Obliga la GPL a algo más que publicar ese
   código? ¿Se considera una obra combinada con el adaptador de Crisol? (La regla del proyecto: nada copyleft como
   dependencia.) ¿Cambia algo si es el máster quien sube el paquete y Crisol solo lo aloja para su mundo?
5. ¿Puede Crisol decir «compatible con sistemas de Foundry» en algún sitio (documentación, importador) sin
   autorización?
6. ¿Hay riesgo contractual para Enrique como titular de licencias de Foundry, por haberlas usado para este estudio?
7. ¿Conviene, antes que nada, preguntar a Foundry Gaming por un acuerdo (como el que tiene con Paizo)?

## Qué nos llevamos a Crisol

Crisol tiene dos clases de sistema que deben convivir: **los propios, que son datos** (los de serie, 5e 2014 y 5e
2024, y los que cree el máster), y **los de Foundry, que son código**. La propuesta es que los segundos se apoyen en los
primeros y no al revés.

### Capa 1: sistemas propios como datos

- **Un manifiesto con la forma del de Foundry**: id, versión, compatibilidad (con versiones de Crisol), los tipos por
  clase de documento (personaje, PNJ, objeto, conjuro, rasgo…), qué campos llevan HTML o rutas de archivo y cuáles son
  del máster, los compendios, los idiomas y los ajustes. Así lo declarativo de un sistema de Foundry casa uno a uno.
- **Campos con las clases de campo de Crisol** (las del módulo 2, más las que pida el juego: dado, fórmula, recurso con
  máximo…), validados en el servidor.
- **Fórmulas seguras en lugar de código**: los valores derivados (CA, bonos, espacios…) se calculan en el servidor con
  un evaluador de expresiones propio, sin JavaScript. Así la IA los lee por el MCP y el jugador no puede falsearlos.
  Es lo que Foundry no puede dar.
- **El creador y la subida de nivel, como pasos declarados** (elige, suma, concede), como los avances de dnd5e pero en
  datos.
- **La hoja, por bloques**, con el aspecto de Crisol.
- **Las tiradas, en el servidor**: el servidor saca el azar y guarda la tirada en el historial de la campaña, que ven
  todos y el máster en oculto. Foundry tira en el cliente y el servidor se lo cree.

### Capa 2: importar los datos de un sistema de Foundry, sin su código

- Leer el manifiesto y los compendios LevelDB, con la herramienta oficial MIT o con un lector propio, y convertirlos en
  tipos y contenido de compendio de Crisol.
- **Con un filtro de licencias**: solo lo que se pueda usar (el texto del SRD con su atribución, los iconos CC con la
  suya). Las imágenes con licencia limitada a Foundry se quitan o se cambian por las de Crisol.
- Esto ya da valor (los compendios del SRD de dnd5e como datos) y prueba que el mapeo de la capa 1 se sostiene.

### Capa 3: ejecutar el código de un sistema de Foundry (si el abogado da luz verde)

**Aislamiento** [I, a probar en un prototipo]:

- **Otro dominio registrable** solo para esto, no un subdominio del de Crisol: así no comparte cookies ni contexto de
  sitio.
- **Un iframe aislado sin el permiso de mismo origen**: tiene un origen opaco, sin cookies, sin almacenamiento y sin
  acceso a la página de Crisol. Es probable que necesite el permiso de formularios, porque el marco de aplicaciones
  procesa los formularios por su evento de envío, y sin ese permiso el navegador no lo dispara.
- **Política de contenidos estricta**: guiones y estilos solo del dominio aislado (archivos versionados y con huella),
  **ninguna conexión de red** (todo pasa por el puente), imágenes del dominio aislado y en línea, y sin evaluación de
  código. Para eso, al instalar el sistema se **precompilan sus plantillas Handlebars** y la aritmética de las fórmulas
  se evalúa sin construir funciones desde texto. La descarga externa de dnd5e queda bloqueada sin más.
- **Nada del sistema llega al servidor de Crisol como código.** El servidor solo ve operaciones a través del puente.

**Puente** [I]: un canal de mensajes entre la página de Crisol (la única con sesión) y el iframe. El iframe es un
cliente **no fiable** con exactamente los permisos del usuario, nunca más. Mensajes:

| Del iframe a Crisol | De Crisol al iframe |
|---|---|
| Operaciones de documento (crear, cambiar con su diferencia, borrar). El servidor aplica permisos, sanea y limita tamaños | El paquete inicial: el usuario, el actor y sus incrustados, el grupo, los documentos que cite, el índice de los compendios, ajustes y traducciones. Solo lo que ese usuario puede ver |
| Pedir documentos o compendios bajo demanda | Los cambios en tiempo real de lo que tiene cargado |
| Pedir azar para una tirada y publicar su resultado en el historial | El azar, sacado en el servidor |
| Leer y escribir ajustes (los del navegador también, porque el iframe no tiene almacenamiento) | Lo que se suelta desde Crisol (una página de la wiki, un objeto del compendio), traducido a lo que espera el sistema |
| Avisos, abrir otra hoja, elegir un archivo | |

**Adaptador** (el API compatible, en sala limpia), por orden de necesidad [I]:

1. Las 66 clases base y los espacios de nombres, con lo de la mesa como sustitutos vacíos y el lienzo como «no hay
   escena».
2. Modelos de datos y campos, con todo su comportamiento.
3. Documentos sobre un almacén en memoria que llena el puente, con incrustados, ciclo de cambios, banderas y permisos.
4. Configuración global, ganchos y el orden de arranque. Ajustes y traducciones.
5. Marco de aplicaciones, hojas, diálogos, formularios, arrastrar y soltar, menús, descripciones emergentes,
   ayudantes de plantilla y elementos propios (el editor de texto enriquecido, sobre una biblioteca MIT o el de
   Crisol), con una hoja de estilos base propia que dé las variables y las clases que esperan los sistemas.
6. El motor de tiradas y su presentación, y los mensajes del chat, que van al historial de tiradas de Crisol (con sus
   dados 3D, que pinta Crisol fuera del iframe).
7. Enriquecer texto. El marco antiguo de aplicaciones, lo justo para las pocas clases que lo usan.
8. Más adelante, con el módulo de la mesa: combate, fichas de mesa y plantillas de área, traducidos a lo de Crisol.

**El servidor y la IA**: el servidor no puede validar a fondo los datos de un sistema de código ni calcular sus
derivados. Hay dos opciones para el ADR: (a) como Foundry, fiarse de la forma de los datos dentro de los permisos y
sanear lo declarado, y que la IA vea solo los datos de origen; (b) ejecutar la parte de datos del sistema con el
adaptador en un aislamiento del servidor, sin DOM. La (b) da validación y derivados para el MCP, pero el paquete de
dnd5e define al cargar clases que heredan de elementos HTML, así que haría falta un DOM mínimo de pega [I].

**Riesgos** [I]:

- **Versiones**: fijar un perfil de compatibilidad por generación de Foundry (empezar por la 14), leer la mínima y la
  verificada del manifiesto y no cargar lo que quede fuera. Cada generación nueva es trabajo para Crisol.
- **Rendimiento**: 3,5 MB de código y medio de CSS por sistema, más el adaptador y el arranque completo del sistema en
  cada iframe. Hay que medir si va un iframe por hoja abierta (más simple, cada hoja en su panel de Crisol) o uno por
  mundo que aloje todas las ventanas (más ligero, pero choca con cómo Crisol coloca sus paneles).
- **El mundo en memoria**: lo que la hoja busque de forma síncrona y no esté precargado falla. Hay que seguir las
  referencias del actor al precargar.
- **Módulos**: al principio, solo sistemas y módulos de traducción. Nada de módulos que parcheen los internos.
- **Apariencia**: un sistema de Foundry se verá como en Foundry. Si el mapeo de campos lo permite, Crisol podría
  ofrecer además su hoja por bloques sobre los mismos datos.

### Orden propuesto

1. **Capa 1** (sistemas propios como datos), que hace falta igual para 5e 2014 y 2024. Ya con la forma del manifiesto
   de Foundry.
2. **Consulta al abogado y ADR** del aislamiento de código de terceros, en paralelo con la capa 1.
3. **Capa 2** (importar datos de un sistema de Foundry con filtro de licencias).
4. **Un prototipo de la capa 3**: dominio aparte, iframe, puente y el adaptador mínimo para que dnd5e arranque y abra
   una hoja de personaje solo para leer. Medir el arranque, la memoria y el API que se toca de verdad en ejecución (el
   estudio de hoy es estático). Decidir si se sigue.
5. Editar desde la hoja y tirar (operaciones por el puente, el motor de tiradas, el historial y el azar del servidor).
6. El resto de dnd5e: compendios, su creador y subida de nivel, efectos, enriquecer texto. La mesa, con su módulo.
7. Un segundo sistema con otra licencia y otra forma (Pathfinder 2e, Apache) para comprobar que el adaptador es
   general. Solo después, abrirlo a sistemas de la comunidad.

Preguntas abiertas:

- ¿Qué toca en ejecución abrir una hoja y tirar? Se mide en el paso 4, con la instancia de estudio, registrando los
  accesos al API.
- ¿Opción (a) o (b) para el servidor y la IA con los sistemas de código?
- ¿Quién instala un sistema de Foundry: Crisol desde un catálogo propio (Crisol distribuye) o el máster subiendo el
  paquete a su mundo (Crisol aloja)? Depende de lo que diga el abogado.
- ¿Dónde se consiguen las traducciones al español de un sistema de Foundry, si son módulos con su propio código y su
  propia licencia?
