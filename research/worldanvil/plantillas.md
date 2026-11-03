# Plantillas de artículo en World Anvil

Módulo de Crisol: 2. Tipos de página, plantillas y consultas · Fecha: 2026-11-03 · Versión estudiada: web pública a
fecha de hoy

## Pregunta

Las mismas siete preguntas de la nota de Kanka (`research/kanka/tipos-y-relaciones.md`): plantillas de serie y
propias, qué pasa al cambiarlas, clases de campo y enlaces, listas inversas automáticas, el flujo de crear desde
plantilla, las quejas, y la API.

**Cómo se leyó.** La web de World Anvil pide una comprobación antibots. Se pudo leer entera una página (la guía de las
plantillas de artículo, en el navegador). Las demás páginas de su ayuda, su Codex y su foro de sugerencias se conocen
por los extractos que da el buscador. Se leyeron completos una entrada de su blog y la especificación pública de su API.
Ni cuenta ni código. Grado de certeza:

- **[guía]**: la guía oficial de plantillas, leída entera.
- **[extracto]**: páginas oficiales (ayuda, Codex) vistas solo en los extractos del buscador.
- **[blog]**: blog oficial.
- **[API]**: especificación pública de la API.
- **[foro]**: sugerencias e incidencias de la comunidad, por extractos.
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### El modelo, en breve

En World Anvil, la plantilla es el tipo del artículo. Hay 28 de serie [guía]: personaje, organización, asentamiento,
edificio, lugar geográfico, objeto, especie, etnia, tradición, mito, documento, idioma, material, conflicto, unidad
militar, título, profesión, ley natural, tecnología, conjuro, condición, vehículo, trama, informe de sesión, prosa y el
genérico, entre otras. La API enumera unas 26 clases internas [API]. Algunas tienen variantes: la organización se
presenta distinta como religión, país o unidad militar, con otras preguntas [foro].

Todas comparten una introducción de texto libre, unas **preguntas guía** opcionales en un panel del editor, secciones
para maquetar, y los **campos propios de su plantilla**. Algunas traen funciones especiales: árbol familiar y paneles de
relación en el personaje, red diplomática en la organización, árbol de tramas en la trama, diccionario en el idioma,
modo lectura en la prosa, enlace con la campaña en el informe de sesión [guía].

### 1. Plantillas de serie y propias

- **Las 28 de serie son fijas.** No se crean plantillas desde cero [extracto]. Una sugerencia para renombrar, ocultar o
  añadir secciones de preguntas por mundo se rechazó, remitiendo a las plantillas propias [foro].
- **Plantillas propias de artículo**, solo en los niveles de pago altos [extracto]:
  - Se hacen en el estudio, que es de la **cuenta**, y se **atan a uno o varios mundos**, donde salen en la pantalla
    de crear [blog, extracto].
  - **Siempre parten de una de serie**, su «madre», y heredan sus campos y funciones [blog, extracto].
  - Cambian el contenido por defecto (introducción, columnas laterales, pie, etiquetas) y el estilo (una clase CSS para
    todos sus artículos y CSS propio) [extracto].
  - En modo avanzado se reescribe la maquetación entera con HTML y un lenguaje de plantillas, usando las variables de la
    madre, más datos libres en JSON [blog].
  - **No añaden campos nuevos** [extracto].
- **Las plantillas de bloques de reglas** (statblocks) son del usuario, no del mundo [API].
- Para un campo suelto en la columna lateral de un artículo hay que escribirlo en su marcado propio [extracto].

### 2. Al cambiar una plantilla

- El contenido y el CSS de una plantilla propia se copian al artículo al crearlo, así que cambiarlos no toca los
  artículos hechos [extracto].
- En cambio, la maquetación en modo avanzado se aplica también a los artículos ya creados: si se rompe la plantilla, se
  rompen todos. El propio Codex se contradice en esto y avisa de que se está reorganizando [extracto].
- Desatar una plantilla de un mundo no afecta a sus artículos. Borrarla los devuelve a la plantilla de serie de la que
  partía [extracto].
- **Un artículo no cambia de tipo.** La guía oficial dice que hay que crearlo de nuevo con la plantilla correcta y copiar
  el texto [guía]. Hay sugerencias aceptadas para pasar de genérico a un tipo concreto, sin constancia de que se hicieran
  [foro]. Sí se puede pasar un artículo a una plantilla propia desde sus acciones especiales [extracto].

### 3. Clases de campo y enlaces

- **Los campos los fija la plantilla.** Hay datos rápidos (fecha de fundación, líder) y campos largos de texto
  (historia, bienes) [extracto]. En la API, casi todos los campos de un lugar son texto, también la población. Su
  subtipo es una lista (por ejemplo, la clase de lugar) [API].
- **Los enlaces van atados a una plantilla.** El campo «Líder» de una organización solo acepta artículos de personaje
  [guía]. Hay enlaces sencillos (madre, gobernante, organización) y listas de enlaces (otros gobernantes, aspirantes,
  salas conectadas) [API].
- **No hay campos propios.** La petición de añadir uno o dos campos a una plantilla o a un artículo (alguien echaba en
  falta «Debilidades» en el personaje) se rechazó [foro].

### 4. Listas inversas

- **Árboles automáticos** a partir de los campos madre: la organización muestra al pie su árbol de organizaciones, y el
  lugar con un lugar madre genera el suyo [extracto]. Son de serie, por plantilla.
- **Paneles de relación**: la relación entre dos personajes (amigos, pareja, enemigos…) sale en los artículos de los
  dos. Lo mismo entre organizaciones, que además forman una red diplomática [guía].
- **Árboles familiares** a partir de los padres de cada personaje [guía].
- **No se vio una lista de miembros o de habitantes** que salga sola de los campos enlace [inferido]. La comunidad
  recomienda etiquetar los artículos y pegar una lista por etiqueta con su marcado [foro].
- Peticiones abiertas: poder elegir organizaciones hijas y no solo la madre, varios lugares en vez de uno, que las
  especies de un sublugar aparezcan en el lugar que lo contiene, y que el líder pueda ser una organización [foro].
- Los árboles de contenido son otra cosa: se hacen a mano y admiten cualquier artículo [extracto].

### 5. Crear un artículo desde plantilla

- Un botón de crear, presente en todas las pantallas, abre el **selector de plantillas**: una cuadrícula con buscador,
  una descripción al pasar el ratón y un enlace a la guía. Las plantillas propias atadas al mundo salen arriba. Los
  bloques de reglas van en otra pestaña [extracto, blog].
- Se elige la plantilla, se escribe el título y se abre el editor con su panel de preguntas [extracto].
- Si ninguna encaja, se usa la genérica, que no trae preguntas [guía].
- Incidencias recientes: el creador nuevo de artículos vaciaba las plantillas propias (noviembre de 2025), y otro
  usuario veía que todo artículo nuevo salía como organización [foro].

### 6. Límites y quejas visibles

- No se puede cambiar el tipo de un artículo [guía, foro].
- No se pueden añadir campos ni ocultar o renombrar las secciones de preguntas sin pasar a un nivel de pago alto, y ni
  así se añaden campos [foro, extracto].
- Personalizar de verdad exige HTML y un lenguaje de plantillas, con variables mal documentadas: un usuario dice que
  depende del saber popular [extracto, foro].
- Enlaces demasiado estrictos o sencillos: líder solo personaje, solo organización madre, un solo lugar [foro].
- En las comparativas se repite que la curva de aprendizaje es dura y que la interfaz abruma [extracto].
- La documentación propia se contradice (qué cambios llegan a los artículos hechos) [extracto].

### 7. API

- API v2, en beta abierta desde 2023. Su documentación general se actualizó por última vez en agosto de 2023 [extracto,
  API].
- **El tipo es de solo lectura**: cada artículo trae su clase, fijada al crearlo, y una referencia a su plantilla propia
  si la tiene [API].
- **Los campos propios de cada plantilla** se describen por plantilla, y la propia especificación avisa de que la lista
  no está completa [API].
- **Los enlaces** vuelven como referencias a artículos, sueltas o en listas. Un parámetro de detalle, de -1 a 3, decide
  cuánto se devuelve, y el nivel 2 incluye los datos de enlace [API].
- No hay rutas para las plantillas propias de artículo. Sí para las plantillas de bloques de reglas, que se listan por
  usuario [API].

## Compromisos y límites

Las plantillas fijas y llenas de preguntas ayudan a quien empieza un mundo de cero: cada tipo sugiere qué pensar. El
precio es la rigidez. El tipo no se cambia, los campos no se añaden y los enlaces solo aceptan lo que la plantilla
previó. La personalización existe, pero es de pago, toca el aspecto y no los datos, y exige saber programar. Casi todos
los campos son texto, así que no hay tablas ni filtros por valor. Las listas automáticas son árboles por campo madre y
paneles de relación, no tablas configurables.

## Qué nos llevamos a Crisol

- **Plantillas de serie fijas, pero cortas.** Coincidimos en que las de serie no se tocan. Lo que no copiamos es la
  avalancha de preguntas: las nuestras traen pocos campos y tres o cuatro apartados (PNJ: Especie, Rol, Facción y Lugar,
  más Quién es, Cómo interpretarlo y Ganchos).
- **La página se edita libremente después.** Es justo lo que World Anvil niega y lo que más se le pide: añadir un campo
  a un artículo concreto.
- **Plantillas propias de la cuenta, como las suyas**, pero sin atarlas a mundos: salen en todos. Y desde cero o
  copiando, no solo heredando de una de serie.
- **Que la copia de una de serie recuerde de dónde viene.** World Anvil guarda la madre de cada plantilla propia y el
  artículo sigue siendo de su clase de serie. Es el mismo problema de linaje que se ve en la nota de Kanka: las tablas
  de «páginas de tipo PNJ» tienen que saber si incluyen las plantillas hechas a partir de PNJ. Lo decide la spec.
- **No cerrar el cambio de plantilla.** La spec puede dejar cambiar la plantilla que recuerda una página. Como los
  campos son de la página, cambiarla no destruye nada.
- **Enlace de un tipo, pero sin encerrar.** Su «líder solo personaje» genera quejas. Nuestro campo enlace «de un tipo»
  puede filtrar el selector por esa plantilla, y la plantilla también puede decir «de cualquiera». Que la spec decida si
  el tipo es un filtro del selector o una regla que el servidor exige.
- **Uno o varios desde el principio.** Sus peticiones (varios lugares, organizaciones hijas) y los cambios de Kanka en
  2026 dicen lo mismo: el campo «varios enlaces» tiene que estar desde el primer día, y la tabla debe encontrar una
  página tanto si el campo es de un enlace como de varios.
- **Datos con tipo, no solo texto.** La población como texto impide ordenar o sumar. Nuestros campos de número, opciones
  y casilla permiten tablas útiles.
- **Una sola fuente de verdad sobre qué cambia.** Su Codex se contradice sobre qué llega a los artículos hechos. En
  Crisol la regla es simple y va en la ayuda: cambiar una plantilla nunca toca las páginas hechas.
- **La API como contraejemplo.** Tipo de solo lectura, campos por plantilla «sin completar» y nada de plantillas propias.
  Nuestro MCP expone las plantillas con su lista completa de campos, clave, clase y opciones, para que la IA rellene sin
  adivinar.

## Fuentes

Leídas enteras:

- https://www.worldanvil.com/learn/article-guides/article-templates (en el navegador)
- https://blog.worldanvil.com/worldanvil/dev-news/custom-article-templates-what-are-they-and-how-can-they-help-you/
- https://blog.worldanvil.com/worldanvil/world-anvil-tutorial-the-create-interface
- https://www.worldanvil.com/api/external/boromir/documentation
- https://wa-cdn.nyc3.cdn.digitaloceanspaces.com/assets/prod/boromir-documentation/swagger/openapi.yml (y sus partes de
  artículo, lugar y plantillas de bloques)

Vistas solo en los extractos del buscador (la web pidió la comprobación antibots):

- https://www.worldanvil.com/learn/article-guides/custom-templates
- https://www.worldanvil.com/w/WorldAnvilCodex/a/custom-article-templates
- https://www.worldanvil.com/learn/article-guides/articles
- https://www.worldanvil.com/learn/article-guides/create-article
- https://www.worldanvil.com/learn/beginner-tutorials/get-started-articles
- https://www.worldanvil.com/learn/article-guides/automatic-trees
- https://www.worldanvil.com/learn/article-templates/organization
- https://www.worldanvil.com/learn/bbcode-tutorials/article-layout
- https://www.worldanvil.com/learn/styling/article-css-classes
- https://www.worldanvil.com/community/voting/suggestion/719dff64-75af-44e2-95c2-51b3caae5bfd/view
- https://www.worldanvil.com/community/voting/suggestion/fbd7729d-a10a-4c11-83bb-6c341a0c8edd/view
- https://www.worldanvil.com/community/voting/suggestion/8b14a66a-d5dd-40de-b78d-c7a656ebfdb0/view
- https://www.worldanvil.com/community/voting/suggestion/3156b2a9-f3c5-4e5c-a95a-aae3bf237f30/view
- https://www.worldanvil.com/community/voting/suggestion/af4d36ac-b954-4866-b2a5-72658d73ed40/view
- https://www.worldanvil.com/community/voting/suggestion/055d3ad9-b2e5-4242-978a-9f404c836852/view
- https://www.worldanvil.com/community/voting/suggestion/6d5f4233-4fd5-47fd-8699-0ba1e46215b4/view
- https://www.worldanvil.com/udan-tracker/b5fd24e0-f2b3-4d22-bdeb-e722865f07f1/view
- https://www.worldanvil.com/udan-tracker/83b0388c-7252-4e12-be63-fb18147b489c/view
- https://www.legendkeeper.com/best-world-anvil-alternatives/ (comparativa de un competidor)
- https://alternativeto.net/software/world-anvil
