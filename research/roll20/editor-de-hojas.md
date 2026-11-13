# El editor de hojas de personaje en Roll20

Módulo de Crisol: tanda 8 de `tasks/plan-revision.md` (el editor de sistemas a mano) · Fecha: 2026-11-12 · Versión
estudiada: Roll20 a fecha de hoy (Help Center actualizado entre 2024 y 2026-10; constructor casero de D&D 2024 de
2025-11)

## Pregunta

Cómo resuelve Roll20 que un usuario haga la hoja de su propio juego, para diseñar el editor de sistemas «a mano» de
Crisol:

1. Cómo explica cada cosa (textos de ayuda, ejemplos).
2. En qué orden pide las cosas.
3. Qué esconde o deja para avanzado.
4. Cómo enseña el resultado mientras se edita (vista previa, probar).
5. Cómo valida y muestra los errores.
6. Cómo llama a las cosas.

**Cómo se leyó.** Sin cuenta de Roll20 y solo con lo público. La wiki (`wiki.roll20.net`) y las páginas del Help Center
están tras una verificación anti-bots que no deja pasar ni a los dos navegadores de Playwright ni a WebFetch; el
archivo de Internet devolvió «demasiadas peticiones». Se leyeron los artículos del Help Center por su interfaz pública
de artículos (el mismo texto, sin la verificación): «Building Character Sheets», «Intro to Sheet Development»,
«Minimum Requirements & Best Practices», «Character Sheet Tips and Tricks», «How to Make Roll Templates», «Custom Roll
Parsing», «Charactermancer», «Default Sheet Settings» y «How to Use the Modifier Builder (D&D 2024)»; tres entradas del
blog (el Sandbox en 2020, el rediseño del constructor en 2023 y el constructor casero de D&D en 2025-11); la
introducción de la documentación de **Beacon**; y el hilo del foro donde se presenta **Sheet Architect**, un
constructor visual de terceros. No se vieron vídeos. Marcas:

- **[documentación]**: lo dice su ayuda oficial, su blog o la documentación de Beacon.
- **[observado]**: visto en el navegador (aquí solo el foro público, que sí abre).
- **[inferido]**: deducido, sin comprobar.

No hay **[observado]** de la app: Roll20 no tiene, para un juego cualquiera, un constructor visual oficial que se
pudiera ver sin cuenta de pago.

## Lo que hacen

### Tres caminos, ninguno es un editor por pasos para cualquier juego

| Camino | Para quién | Qué es |
|---|---|---|
| **Hoja propia** («Custom» en los ajustes del juego) y **Sheet Sandbox** | Suscriptores Pro que saben HTML y CSS | Se escribe la hoja a mano en HTML, CSS y JavaScript; el editor tiene cuatro pestañas (diseño en HTML, estilo en CSS, traducción y vista previa). El Sandbox es un juego de prueba de un solo jugador donde se suben los archivos y la hoja se recarga sola [documentación] |
| **Beacon** | Desarrolladores web, beta cerrada | Un kit para hacer la hoja como aplicación web moderna, probada contra sus «sandboxes» de mesa y de personajes con datos reales. Con él están hechas las hojas oficiales recientes (D&D 2024 y otras) [documentación] |
| **Constructor casero de D&D 2024** y su **constructor de modificadores** | Cualquier usuario, gratis | No hace sistemas: añade clases, subclases, especies y trasfondos propios a la hoja de D&D 2024, con rasgos por nivel que cambian números de la hoja [documentación] |

Además, **Sheet Architect** (de un autor de la comunidad, de pago, en alfa desde 2026-02) es el único constructor
visual para hojas de cualquier juego: arrastrar campos, listas repetibles y botones de tirada a un lienzo, la lógica en
un editor de nodos y una vista previa en tiempo real; compila a lo que Roll20 acepta [observado en el foro]. Que lo haya
tenido que hacer un tercero dice mucho del hueco.

### 1. Orden en que lo enseñan (la hoja propia)

El índice oficial va: empezar (la introducción), una guía de GitHub para principiantes, los **requisitos mínimos**, las
plantillas de tirada, la traducción, los scripts y el asistente de creación [documentación]. Dentro de la introducción:

1. Dónde está el editor (Juegos → el juego → Ajustes → plantilla de hoja → «Custom»).
2. Las **restricciones** de seguridad (qué etiquetas y qué CSS no se admiten).
3. Una lista de **errores comunes**.
4. El editor y su vista previa.
5. **Guardar datos**: cada caja que el jugador rellena es un «atributo» con nombre propio; números, textos, valores por
   defecto, máximos, valores calculados, ocultos, desplegables, casillas.
6. Botones de tirada.
7. **Secciones repetibles** (listas de largo libre: habilidades, armas).
8. Maquetación y estilo.
9. **Opciones avanzadas**: ajustes por defecto de la hoja, scripts, plantillas de tirada, compendio, asistente de
   creación [documentación].

Es decir: primero los datos, luego las tiradas, luego las listas, después el aspecto, y lo programable al fondo. El
orden es bueno; el problema es que todo está en código.

### 2. Cómo lo explican

- **Un ejemplo por cada concepto**, siempre en código: un campo de fuerza, un modificador que es la mitad de la fuerza,
  un botón de «engañar» que suma una habilidad a un d20 [documentación].
- **Errores comunes numerados** antes de empezar: olvidar el prefijo que hace que un campo se guarde (y entonces el dato
  se pierde al cerrar la hoja), olvidar el prefijo de las clases de estilo, poner un guion bajo en el nombre de una
  lista repetible, **fiarse solo de la vista previa**, no mirar hojas ya hechas, no pedir ayuda [documentación].
- **Una pregunta por regla** en el constructor de modificadores de D&D: «¿En qué valor empieza?», «¿Qué bonos se suman
  encima?», «¿Cuál es el mínimo o el máximo?», «¿Por cuánto se multiplica?», «¿Qué valor lo sustituye todo?», cada una
  con un ejemplo de juego (una piel metálica que fija la CA en 15; un +2 que la sube a 17; una fuerza que no baja de
  19; un vuelo de cinco veces el bono de competencia) y un consejo («multiplica por −1 para restar») [documentación].
  Es su mejor texto de ayuda, y lo que más se parece a lo que buscamos.
- **El rediseño del constructor (2023)** salió de entrevistar a másteres novatos: el asistente antiguo tenía bloques
  de texto tan largos que había quien pasaba diez minutos leyendo un paso. El nuevo enseña **solo el trozo de reglas
  del paso en curso**, y en la hoja hay iconos que abren la regla de cada cosa [documentación].

### 3. Qué esconden para avanzado

- Los **ajustes por defecto** de la hoja (para todas las fichas del juego: si es PJ o PNJ, el oro inicial, si las
  tiradas preguntan), los **scripts** que recalculan al cambiar algo, las **plantillas de tirada** (cómo sale el
  resultado en el chat: cabecera, filas, secciones que solo salen si hubo crítico o si superó un número), el **cálculo
  propio de resultados** (contar éxitos, por ejemplo), el **compendio** y el **asistente de creación** [documentación].
- Los requisitos mínimos separan «lo mínimo» (que se vea decente, botones de las tiradas más comunes, cajas para lo que
  hay que apuntar) de «más allá del mínimo» (estilo trabajado, plantillas, scripts, traducción) [documentación].
- La regla de la comunidad: **una hoja de la comunidad no debe traer creación ni subida de nivel** (por derechos de
  autor); solo las hojas oficiales lo hacen [documentación]. Por eso el asistente de creación es raro fuera de lo
  oficial.

### 4. Cómo enseñan el resultado

- **Vista previa en vivo** en la pestaña del editor: se actualiza al tocar el HTML, el CSS o la traducción. Pero la
  ayuda insiste en que **es solo aproximada**: no ejecuta los scripts, **no enseña los valores calculados**, y las
  plantillas de tirada salen sin procesar (recomiendan ponerlas al final para que no tapen la hoja). Para estar seguro
  hay que guardar, entrar en la partida, recargar y abrir una ficha [documentación].
- **El Sandbox** mejora eso: un juego de prueba donde la hoja se recarga sola al subir los archivos, sin recargar toda
  la mesa; permite probar los ajustes por defecto; hasta 15 a la vez, solo para uno mismo [documentación]. Aun así, los
  ajustes por defecto «no se pueden probar antes» de mandarlos al repositorio, según su propio artículo
  [documentación].
- **Probar una tirada** es tirarla en la partida: pulsar el botón y mirar el chat. Para ver qué hay dentro de un botón,
  la ayuda explica un truco (pulsarlo, ir al chat y pulsar la flecha arriba) [documentación].
- En el **constructor de modificadores**, «verás el efecto en la hoja» en cuanto se guarda [documentación].
- **Sheet Architect** anuncia como gran ventaja precisamente «ver exactamente cómo se verá la hoja mientras la
  construyes» [observado en el foro].

### 5. Cómo validan y muestran errores

- **Casi no validan.** Los errores se descubren por sus efectos: un campo mal nombrado no guarda el dato; un estilo sin
  prefijo no se aplica; una lista con guion bajo no guarda nada; una etiqueta reservada impide que la hoja cargue. La
  ayuda manda a **inspeccionar el elemento** en el navegador para ver si un filtro de seguridad cambió algo
  [documentación].
- **Los avisos son la lista de errores comunes**, escrita en la ayuda, no en la pantalla [documentación].
- El **asistente de creación** sí valida: el botón «Siguiente» comprueba los campos obligatorios del paso antes de
  avanzar; «Atrás» no lo hace [documentación]. El rediseño de 2023 movió los errores **antes del último paso** para no
  mandar al usuario de vuelta al final [documentación].
- **Sheet Architect** añadió marcar en rojo el nodo de lógica con error y revisar el estilo exportado en busca de lo
  que Roll20 rechazaría [inferido: lo dice un resumen del buscador de un mensaje posterior del hilo, que no se leyó].

### 6. Cómo llaman a las cosas

- **Atributo** (cada dato de la ficha), **habilidad** en el sentido de «acción guardada en la ficha», **macro**,
  **botón de tirada**, **sección repetible**, **plantilla de tirada**, **hoja**, **asistente de creación**
  («Charactermancer»), **ajustes por defecto** [documentación].
- La jerga técnica está en todas partes porque el medio es el código: prefijos, etiquetas HTML, scripts, i18n.
- En el constructor de D&D, en cambio, todo es de mesa: «rasgo», «modificador», «valor base», «bono», «mínimo»,
  «máximo», «multiplicador», «sustituir» [documentación].

## Compromisos y límites

- **Ganan** potencia total y una comunidad enorme: cientos de hojas en un repositorio abierto, con unos requisitos
  mínimos que cuidan la calidad, y Beacon para hojas de nivel profesional.
- **Pierden** a todo el que no programa: hacer la hoja de un juego propio exige ser Pro, saber HTML y CSS y aprender las
  manías de Roll20. El único constructor visual es de un tercero y de pago.
- **La vista previa miente un poco** y lo admiten: no calcula, no ejecuta scripts, no enseña las tiradas. El ciclo real
  es guardar → entrar en la partida → recargar → abrir una ficha → tirar.
- **Los errores son silenciosos**: un dato que no se guarda o un estilo que no se aplica, sin mensaje; la «validación»
  es una lista de errores comunes en la ayuda.
- **Las cosas están separadas por tecnología, no por pregunta de mesa**: los datos en el HTML, el aspecto en el CSS, las
  cuentas en los scripts, cómo sale una tirada en una plantilla aparte, la creación en otro sitio.
- **Lo casero de D&D sí está bien resuelto** (preguntas cortas con ejemplo y efecto visible en la hoja), pero solo sirve
  para un juego y no deja al máster ofrecer sus especies a los jugadores desde una lista (según su propio personal en el
  foro, eso sería «compendios propios», que no tienen).

## Qué nos llevamos a Crisol

1. **El orden de su introducción, sin el código**: qué datos tiene un personaje → cómo se tira → listas (armas,
   habilidades) → cómo se ve → creación → lo avanzado. Coincide con los pasos de mesa del plan.
2. **Preguntas cortas con ejemplo de juego**, como su constructor de modificadores: cada «?» de Crisol responde a una
   pregunta («¿En qué valor empieza?») con un caso real y corto («la armadura natural de una especie: CA 15»).
3. **Solo la regla del paso en curso**, nunca un muro de texto: su propia investigación lo dice (diez minutos leyendo
   un paso).
4. **Vista previa que no miente**: la ficha de al lado calcula de verdad (fórmulas, máximos) y tira de verdad; si algo
   no se puede mostrar, se dice. Es la queja número uno de Roll20 y la promesa principal de Sheet Architect.
5. **Errores con mensaje, nunca silenciosos**: cada cosa que en Roll20 «simplemente no funciona» (un nombre repetido,
   una lista mal nombrada, una tirada que apunta a un dato que no existe) debe ser un aviso de la revisión, con su
   sitio y un ejemplo de cómo arreglarlo.
6. **Validar al avanzar, no al final**, como su asistente y su rediseño: el paso dice lo que le falta antes de seguir,
   pero sin bloquear (en Crisol se puede seguir con avisos abiertos y la revisión los recoge).
7. **Ajustes por defecto con su descripción** (cada opción lleva un texto que dice qué cambia): idea útil para los
   ajustes del sistema que luego la campaña puede tocar.
8. **Cómo sale la tirada en el registro** como parte del paso «¿Cómo se tira?» y no como un archivo aparte; con
   secciones que salen solo si hubo crítico o pifia, elegidas, no escritas.
9. **Lo distinto**: nada de código, ni prefijos, ni HTML; el nombre interno se propone solo; y las listas repetibles se
   llaman por lo que son («armas», «habilidades»), no «secciones repetibles».

## Fuentes

- Help Center de Roll20 (`help.roll20.net/hc/en-us/articles/…`), leído el 2026-11-12: «Building Character Sheets»
  (360037773393), «Intro to Sheet Development» (360037773413), «Minimum Requirements & Best Practices» (360037773453),
  «Character Sheet Tips and Tricks» (360037773373), «How to Make Roll Templates» (360037257334), «Custom Roll Parsing
  for Character Sheets» (4403865972503), «Charactermancer» (360037257394), «Default Sheet Settings» (360041542554),
  «How to Use the Modifier Builder (D&D 2024)» (33635963721367).
- Blog de Roll20: «Custom Sheet Sandbox now on the Dev Server» (2020-02-04), «Redesigning the Roll20 Character
  Builder» (2023-08-04), «D&D Homebrew Character Builder is here» (2025-11-19), «Create homebrew D&D species features».
- Documentación de Beacon: `roll20.github.io/beacon-docs` (introducción).
- Foro de Roll20: hilo «[Tool][Alpha] Sheet Architect» (2026-02-03, `app.roll20.net/forum/permalink/12665384`) (su continuación, 12717904, solo por el resumen del buscador).
- No se pudieron leer: `wiki.roll20.net` (verificación anti-bots) ni el archivo de Internet (límite de peticiones).
