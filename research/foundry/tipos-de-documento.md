# Tipos de documento, campos y referencias en Foundry VTT

Módulo de Crisol: 2. Tipos de página, plantillas y consultas · Fecha: 2026-11-03 · Versión estudiada: 14.369 y dnd5e 6.0.6

## Pregunta

Cómo da Foundry tipo y campos a sus documentos, para escribir la spec del módulo 2 («Desde plantilla», campos en el
panel y tablas que se llenan solas):

1. **Tipos y subtipos** de documento: quién los declara y si un mundo o un usuario puede crear tipos sin programar.
2. **Campos** de cada tipo: qué clases hay, cómo se validan y se dan valores por defecto, y sobre todo los campos que
   apuntan a otros documentos: cómo se guardan, se validan y se resuelven, y qué pasa si el destino se borra.
3. **Cambios de esquema**: qué pasa con los documentos ya creados.
4. **Referencias inversas**: si calcula o enseña «qué apunta a este» y cómo lo mantiene al día.
5. **Crear un documento**: el diálogo de tipo y lo que hace de plantilla.
6. **Hojas**: si el formulario sale del esquema o lo hace a mano cada sistema.

## Lo que hacen

Grado de certeza: **[código]** leído en el código instalado (el común, el del cliente, el del servidor y el de
dnd5e), **[inferido]** deducido sin comprobarlo. Esta vez no se arrancó la instancia: no hay nada observado en
ejecución.

### 1. Tipos y subtipos

Cada clase de documento (actor, objeto, página del diario, escena…) dice si admite subtipos. Los admiten, entre
otros, el actor, el objeto, la página del diario, el efecto, el mensaje del chat, el combate, la carta y el
comportamiento de región. La entrada del diario, la escena o la carpeta no [código].

| Quién | Qué declara | Cómo |
|---|---|---|
| Núcleo | Unos tipos fijos en algunas clases: la página del diario trae texto, imagen, PDF y vídeo, y el mazo trae mazo, mano y montón | En el propio código. Esos nombres quedan reservados [código] |
| Sistema | Los subtipos de su juego | Una lista por clase de documento en su manifiesto. Por cada subtipo dice qué debe sanear el servidor: los campos con HTML, los que son rutas de archivo y los que solo cambia el máster. Los campos en sí los registra su código al arrancar, en el cliente [código] |
| Módulo | Subtipos extra | Igual que el sistema, pero el nombre lleva delante el id del módulo, para no chocar. Solo existen mientras el módulo está activo [código] |
| Mundo | Nada | Su manifiesto no tiene ese apartado [código] |

dnd5e declara cinco tipos de actor (personaje, PNJ, vehículo, grupo y encuentro), catorce de objeto, cinco de página
del diario (clase, subclase, lista de conjuros, regla y lugar del mapa), diecinueve de mensaje y algunos más [código].
Algunas clases obligan a elegir un subtipo (actor y objeto). Otras dejan el tipo «base» [código].

Al lanzar el mundo, el servidor junta los tipos del núcleo, del sistema y de los módulos activos y manda la lista a
los clientes. El nombre de cada tipo y una pista se traducen por clave [código].

**¿Tipos nuevos sin programar? No.** Hay dos restos:

- Un sistema podía declarar tipos y campos en un archivo JSON de plantilla de datos, sin código, con bloques de
  campos compartidos. En la 14 está obsoleto: el servidor avisa y se quita en la 16 [código].
- Todo documento tiene unas «banderas», un objeto libre por ámbito, y uno de los ámbitos es el mundo. Ahí cabe
  cualquier dato, pero sin esquema, sin validación y sin control en la hoja. Solo se escribe por código, con una macro
  [código. lo de la macro, inferido: no vimos interfaz en el núcleo].

### 2. Campos

Los datos de un subtipo son un modelo de datos: una lista de campos tipados, que pueden anidarse. Clases de campo del
núcleo, en nuestras palabras [código]:

| Familia | Clases |
|---|---|
| Simples | Texto (con opciones cerradas o libre), número (mínimo, máximo, entero, paso, positivo), casilla, color, ruta de archivo, HTML, JSON, ángulo, transparencia, tono, cualquier valor |
| Compuestas | Grupo de campos, objeto libre, objeto con claves libres y valores tipados, lista, conjunto, unión de grupos según un campo de tipo |
| De documento | Id de documento, referencia por id, referencia por UUID, tipo de documento, datos del subtipo, colecciones incrustadas, permisos, banderas y estadísticas |

**Opciones comunes de cada campo** [código]: obligatorio, admite nulo, admite vacío, valor inicial (fijo o calculado
a partir del resto de datos), solo lectura, solo para el máster, etiqueta, pista, texto de ejemplo y una regla de
validación propia.

**Limpiar y validar** [código]:

- Primero se **limpia**: se convierte al tipo («3» pasa a 3), se recorta el texto, se redondea un entero y se ajusta
  al paso. Lo que falta toma el valor inicial.
- Después se **valida**, en orden: valores especiales (nulo o ausente), el tipo, los hijos, la regla propia y una
  regla conjunta entre varios campos del mismo modelo.
- En modo **estricto** (crear y editar) un fallo para la operación. En modo **no estricto** (leer de la base), un
  valor que falla se cambia por el inicial si ese vale. Si no hay arreglo, el documento queda inválido (ver el
  apartado 3).

**Tipos compuestos de bloques**: dnd5e arma cada subtipo sumando grupos de campos reutilizables (descripción,
monedas, objeto físico, actividades, avances…). Un tipo nuevo es una mezcla de grupos ya hechos más lo suyo [código].

**Quién valida**: el cliente, con el modelo del sistema. El servidor no tiene los modelos de los subtipos: guarda los
datos del tipo como un objeto y solo sanea lo que el manifiesto declara (HTML, rutas y campos del máster) [código].
Un cliente o un script que mande datos que no casan con el modelo los deja guardados, y el fallo sale al volver a
cargarlos [inferido].

#### Campos que apuntan a otros documentos

| Forma | Qué guarda | Qué valida | Cómo se resuelve | Control en la hoja |
|---|---|---|---|---|
| Por id | El id del destino, dentro de una colección fija del mundo (carpeta, usuario, actor…) | Solo que el id tenga la forma correcta | Al leer, buscando en la colección del mundo. Si no está, da vacío. Dentro de un compendio, siempre vacío (salvo carpetas) | Un desplegable con los documentos que el usuario ve. Si el valor actual es uno que no ve, lo añade con su nombre |
| Por UUID | La ruta completa (colección, id y, si va dentro de otro, los ids de dentro), o una ruta relativa al documento | La forma, y si se pide, la clase de documento y si es incrustado o no. **Nunca el subtipo** | Bajo demanda, también en compendios, a veces de forma asíncrona. Si no está, da vacío | Etiquetas: se añade soltando un documento o pegando su UUID, con tope o modo «uno solo». Si no encuentra el destino, enseña la clase y el id |
| Por identificador (dnd5e) | Un texto corto y estable, como el de la clase a la que pertenece una subclase | Que sea un identificador válido | Buscando en un índice por identificador | Un texto |

[código en las tres filas]

- **Varios enlaces** son una lista de cualquiera de las anteriores. El encuentro de dnd5e guarda una lista de UUID
  de actores, cada uno con su cantidad. El grupo, una lista de ids de actores [código].
- **El identificador** existe porque copiar del compendio al mundo cambia el id: la relación entre clase y subclase,
  o entre conjuro y lista, aguanta la copia si va por un nombre estable [código. el motivo, inferido].
- **Restringir a un subtipo** («solo conjuros») no lo hace el campo. Lo hace la hoja al soltar el documento, con un
  aviso [código].
- **Nada comprueba que el destino exista** al guardar [código].

**Qué pasa si se borra el destino** [código]:

| Destino borrado | Qué hacen |
|---|---|
| Carpeta | El servidor sube lo de dentro a la carpeta madre o lo borra, según se elija |
| Usuario | El servidor borra sus ajustes |
| Entrada del diario con nota en el mapa | El cliente redibuja la nota |
| Todo lo demás, incluido todo lo del sistema | Nada. El valor sigue guardado y al leerlo da vacío. Nadie avisa al borrar ni lo limpia |

dnd5e lo tapa al leer: el grupo quita de su lista en memoria los miembros que ya no existen y deja un aviso en la
consola, y el encuentro los salta al pedirlos. El dato guardado no cambia [código].

### 3. Cambios de esquema

**Lo que guarda cada documento** [código]: la versión del programa, el sistema y su versión con que se escribió, las
fechas de creación y de cambio y el último autor. Lo pone el servidor. También guarda de dónde se copió (ver el
apartado 5).

**Dos niveles de migración** [código]:

| Cuándo | Quién | Qué hace |
|---|---|---|
| Al leer, siempre | Cada modelo, en el cliente (y en el servidor para lo del núcleo) | Pasa los datos viejos a la forma actual antes de limpiarlos. Si falla, deja un aviso y sigue. Puede dejar alias con los nombres viejos que avisan de que están obsoletos. Lo que falta toma el valor inicial. Todo en memoria: no se guarda hasta la siguiente escritura |
| Al lanzar el mundo | El servidor, para los campos del núcleo | Recorre cada colección y aplica a los documentos escritos con una versión anterior las migraciones registradas por versión, y los reescribe. No abre documentos de una versión más nueva |
| Al entrar el máster tras actualizar el sistema | dnd5e, desde el cliente del máster | Guarda en un ajuste del mundo con qué versión migró. Si el sistema pide migrar desde una versión mayor, recorre actores, objetos, macros, tablas, fichas de las escenas y compendios del mundo, con barra de progreso, y reescribe lo que cambia. Si la versión es demasiado vieja, avisa de que puede fallar. Incluye los documentos inválidos |

**Documentos inválidos** [código]: el cliente carga cada documento en modo estricto. Si no valida, lo aparta: no sale
en el directorio pero no se borra. Al máster, el pie del directorio le dice cuántos hay y lleva a un informe. Los
incrustados inválidos se descartan de la lista de su padre.

**Tipo que desaparece**: si se desactiva el módulo que daba un subtipo, ese tipo sale de la lista y sus documentos
dejan de validar, así que quedan apartados hasta reactivarlo [código. el efecto en pantalla, inferido].

**Cambiar el tipo de un documento** exige reemplazar entero sus datos de tipo, en la misma operación. No encontramos
interfaz para hacerlo ni en el núcleo ni en dnd5e [código. búsqueda limitada].

### 4. Referencias inversas

**No hay un índice general.** El servidor no conoce las relaciones, igual que con los enlaces del texto (ver
`journal.md`) [código].

Lo que hay, caso por caso [código]:

- **Núcleo**: el actor sabe qué fichas suyas hay en cada escena. Lo mantiene cada cliente en memoria: la ficha se
  apunta al prepararse y se borra al quitarla. Y alguna búsqueda por recorrido: «¿qué nota del mapa es de esta
  entrada?» recorre las notas de la escena activa.
- **dnd5e**: varios registros en memoria del cliente:
  - de un efecto, los documentos que dependen de él,
  - de un invocador, las criaturas que ha invocado,
  - de una actividad de encantar, los objetos encantados,
  - de un conjuro, las listas de conjuros que lo incluyen,
  - índices de clases, subclases y otros por identificador.

**Cómo se mantienen** [código]: cada documento se apunta cuando se prepara (al cargar y tras cada cambio) y se borra
al quitarlo. No se guardan en ningún sitio: cada cliente los rehace en cada carga. Lo de compendios no se apunta.
Las listas de conjuros solo cuentan si un paquete o el mundo las declara en su manifiesto, y se cargan al arrancar.

**Para qué los usan**: la hoja de un conjuro dice en qué listas está. Una copia del conjuro en el mundo pregunta por
las listas de su original del compendio, gracias a que guarda de dónde se copió [código].

Funciona porque cada cliente tiene en memoria el mundo entero [inferido, como en `journal.md`]. El precio: cada
cliente recalcula, lo que no está cargado no cuenta, y cada relación inversa hay que programarla aparte.

### 5. Crear un documento

**Diálogo del núcleo** [código]:

- Tres datos: nombre, tipo y carpeta.
- El nombre lleva uno propuesto: la etiqueta del tipo y, si ya existe, un número entre paréntesis. Cambia al cambiar
  de tipo. Si se deja vacío, se usa el propuesto.
- El tipo es un desplegable ordenado, con una pista bajo él que cambia con el tipo. Quien abre el diálogo puede
  limitar los tipos (al crear un objeto dentro de un actor, por ejemplo).
- Al aceptar, crea el documento y abre su hoja.

**dnd5e** lo cambia por una rejilla de tipos con su icono, **recuerda el último tipo elegido** de cada clase de
documento y en algunos sitios elige qué tipos ofrecer según dónde se crea [código].

**Valores por defecto del tipo** [código]:

- los iniciales de cada campo del modelo,
- una imagen por defecto para cada tipo,
- lo que el código añade al crear (en dnd5e, un personaje nace con su ficha vinculada, amistosa y con visión).

dnd5e **no aplica esos extras si el documento viene de un compendio**: respeta lo que trae [código].

**Lo que hace de plantilla**: no hay plantillas como tal. Hacen sus veces [código]:

- **El compendio**: arrastrar o importar copia el documento al mundo. Le quita el id, el orden y los permisos (quien lo
  importa queda de propietario) y **guarda el UUID del original**.
- **Duplicar**, desde el directorio o en una página del diario: copia con un nombre de copia y **guarda el UUID del
  original**.
- Exportar al compendio borra esas marcas de origen.
- No hay vínculo vivo: si cambia el original, las copias no cambian. El origen guardado sirve para consultas (las
  listas de conjuros del apartado 4) y para lo que quieran hacer los módulos.

### 6. Hojas y formularios

- **Cada clase de campo sabe dibujar su control** y su grupo de formulario (etiqueta, control y pista) [código]:
  texto con opciones → desplegable, número, casilla, color, ruta con selector de archivos, HTML → editor, referencia
  por id → desplegable, por UUID → etiquetas. Las etiquetas y pistas salen de las traducciones según la ruta del
  campo.
- **La hoja la maqueta a mano cada sistema**, con plantillas HTML que colocan cada control. dnd5e trae 326 plantillas.
  Unas 86 usan el atajo que pinta el grupo de un campo [código].
- **Generado desde el esquema**, en un solo sitio: el diálogo de los comportamientos de región recorre los campos del
  tipo y pinta un grupo por campo, en apartados [código].
- La **hoja básica** de un subtipo sin hoja propia solo enseña el nombre, la imagen y la descripción, o el UUID si no
  hay nada de eso. No pinta los campos del tipo [código].
- Se pueden registrar varias hojas por tipo y elegir cuál usar, por documento o por defecto [código].

## Compromisos y límites

- **Tipos como código de paquete**: dan lógica, cálculos y hojas a medida. A cambio, el máster no puede crear un tipo
  ni añadir un campo sin programar. Lo que le queda (las banderas) no tiene forma ni interfaz.
- **Esquema por tipo**: todos los documentos de un tipo tienen los mismos campos. Por eso un cambio de esquema obliga
  a migrar todo, y de ahí la maquinaria de dos niveles y los documentos apartados.
- **Validación en el cliente**: el servidor no conoce los campos del sistema y fía en lo que le mandan, salvo el
  saneado que declara el manifiesto.
- **Referencias débiles**: solo se valida la forma. Ni integridad, ni aviso al borrar, ni lista de rotas, y el
  subtipo del destino lo vigila la interfaz.
- **Referencias inversas hechas a mano**, en memoria y en cada cliente, solo para lo que alguien programó. Valen
  porque el cliente lo tiene todo.
- **Inválidos apartados**: la carga no se rompe, pero el documento desaparece de la vista y solo queda un recuento.
- **El selector por id enseña el nombre del destino actual aunque no lo veas**: una fuga pequeña, del estilo de las de
  `journal.md`.
- **Plantilla = copia que recuerda su origen**: simple y sin sorpresas, porque cambiar el original no toca las
  copias. Y el origen guardado permite consultas.
- **Lo mejor**: los controles que salen de cada clase de campo, el nombre propuesto sin choques, la pista por tipo al
  crear, recordar el último tipo, que los extras del tipo no pisen lo que trae la plantilla y guardar el origen.

## Qué nos llevamos a Crisol

Frente a lo decidido con Enrique para el módulo 2:

- **Plantillas como datos, no como código.** Es lo que Foundry no deja: el máster crea «Frente» sin programar. Las de
  serie (PNJ, Lugar, Facción, Objeto, Misión y Sesión) van en el mismo formato que las propias, de solo lectura, con un
  id fijo y legible (como sus identificadores), para que la IA y las copias las nombren igual siempre. Copiar una de
  serie guarda de cuál salió.
- **El esquema vive en la página.** La plantilla siembra campos y apartados, y la página guarda su copia. Así cambiar
  una plantilla no toca las páginas (decidido) y nos ahorramos su maquinaria: ni migraciones de páginas por plantilla,
  ni páginas apartadas. A cambio, **cada campo sembrado guarda el id estable del campo de la plantilla**: es lo que
  hace que «Facción» sea el mismo campo en todos los PNJ aunque alguien lo renombre en una página.
- **Recordar de qué plantilla salió**, como su UUID de origen: la página guarda el id de la plantilla. Y, como dnd5e
  con los conjuros, ese origen sirve para consultar («páginas de tipo PNJ»). Si se borra una plantilla propia, la
  página no cambia ni se esconde: sigue diciendo «PNJ», con el nombre guardado.
- **Cada clase de campo trae su control.** Los siete (texto, número, opciones, enlace, varios enlaces, reloj y casilla)
  son bloques del panel (ADR-0008), cada uno con su control, sus opciones y su valor inicial. Nada de maquetar a mano
  (Enrique no quiere formularios): el orden de los bloques es la maqueta. Lo que en Foundry es la excepción (pintar
  desde el esquema) en Crisol es la norma.
- **Validar en el servidor, siempre.** Cada clase de campo tiene su contrato compartido y el servidor lo aplica al
  guardar el panel, venga de la interfaz o de la IA. De ellos copiamos la limpieza: «3» pasa a 3, se recorta el texto
  y se ajusta al rango.
- **Enlaces de campo con integridad.** Van por id de página, como los del texto, y entran en la tabla de enlaces
  (ADR-0003) marcando de qué campo salen. Al guardar, el servidor comprueba que el destino existe, que es del mismo
  mundo y, si el campo lo pide, que salió de la plantilla pedida: la restricción de tipo se hace en el servidor, no
  solo en el selector. El selector busca por título, nunca pide un id.
- **Si el destino va a la papelera**, ni limpiarlo en silencio ni dejar un «desconocido»: el campo lo enseña como
  enviado a la papelera y vuelve solo al restaurarla. El aviso al mandarla a la papelera cuenta también los campos que
  la apuntan («es la facción de 12 PNJ»).
- **Las tablas que se llenan solas son referencias inversas generales, en el servidor.** Foundry no las tiene y dnd5e
  las programa una a una en la memoria de cada cliente, porque el cliente tiene el mundo entero. En Crisol no lo tiene,
  y la IA también las lee. Se calculan con una consulta sobre esa tabla: páginas que apuntan a esta desde el campo X y
  que salieron de la plantilla Y. Se mantienen solas porque la tabla se rehace con cada guardado del panel, en la
  misma transacción, y no hay nada que invalidar en memoria. El módulo 5 les pondrá su filtro de permisos.
- **Configurarlas con dos desplegables**: primero la plantilla y luego un campo de enlace de esa plantilla. Las
  plantillas de serie traen las suyas (Facción trae «Miembros»: PNJ cuyo campo Facción es esta página).
- **El diálogo «Desde plantilla»**: de ellos, la pista de una línea por plantilla, el icono, recordar la última
  elegida y un nombre propuesto que no choque. Sin elegir carpeta: la página nace donde se pide, como las demás.
- **Errores de datos sin páginas apartadas.** Un campo que no valida (por ejemplo, tras cambiar una clase de campo en
  una versión de Crisol) se enseña marcado y conserva su valor. Esos cambios van con las migraciones de base de datos
  que ya tenemos, más una normalización al leer como red (el valor inicial si falta), como su primer nivel.
- **Cambiar de plantilla una página** queda fuera: Foundry exige reemplazar todos los datos y ni da interfaz. Si
  hiciera falta, sería «aplicar plantilla», que solo añade lo que falta.
- **Lo oculto, en el módulo 5**: su desplegable enseña el nombre de un destino que no ves. Los campos de enlace y las
  tablas que se llenan solas pasarán por la proyección.

Preguntas para la spec:

- Una plantilla propia copiada de PNJ, ¿cuenta como PNJ en las tablas («Miembros»)? dnd5e pregunta por el original de
  una copia. Podríamos ofrecer «PNJ y sus copias».
- Un campo añadido a mano en una página, sin plantilla, ¿puede entrar en una tabla? Con el id estable, solo si se eligió
  de una plantilla. Si no, haría falta buscar por nombre de campo.
