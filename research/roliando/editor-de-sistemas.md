# El creador de sistemas en Roliando

Módulo de Crisol: tanda 8 de `tasks/plan-revision.md` (el editor de sistemas a mano) · Fecha: 2026-11-12 · Versión
estudiada: roliando.com (interfaz «Tinta», novedades hasta la 0.1.11) y sus guías públicas a fecha de hoy

## Pregunta

Antes de diseñar el editor de sistemas «a mano» de Crisol, queríamos saber cómo resuelve Roliando el suyo (la tarjeta
«Sistemas» del Taller):

1. Cómo explica cada cosa (textos de ayuda, ejemplos, «?»).
2. En qué orden pide las cosas.
3. Qué esconde o deja para avanzado.
4. Cómo enseña el resultado mientras se edita (vista previa, probar una tirada).
5. Cómo valida y cómo muestra los errores.
6. Cómo llama a las cosas: palabras de mesa frente a tecnicismos.

**Cómo se leyó.** No se repite lo ya anotado en `crear-y-compatibilidad.md` (el marco común de los creadores, las 24
partes, el paquete `.zip`) ni en `sistemas-y-libros.md` (módulos, libros, compendio). Hoy **no se pudo entrar** con la
cuenta de prueba: al iniciar sesión, Roliando pide aceptar unos Términos y una Política de privacidad nuevos antes de
dejar seguir, y aceptar un contrato en nombre de Enrique no nos toca; se cerró sin aceptar y **no se creó ni cambió
nada**. Por eso esta nota junta lo **observado** dentro de la app el 2026-11-10 (en la fase de `crear-y-compatibilidad.md`)
con **nueve guías públicas** leídas hoy: «Creador de sistemas: primeros pasos», «Campos y fórmulas», «Diseño de la
ficha», «Tiradas», «Combate», «Creación de personaje y progresión», «Modo código (estilo Roll20)» e «Importar un
sistema», más el índice de guías. Marcas:

- **[observado]**: visto dentro de la app con la cuenta de prueba (2026-11-10).
- **[documentación]**: lo dice su ayuda pública (`/guias/…`).
- **[inferido]**: deducido, sin comprobar.

## Lo que hacen

### 1. Entrada: un nombre y ya hay sistema

- Se crea desde Taller → Sistemas → Crear (o con la paleta de órdenes). Lo único que se pide es el **nombre del juego**;
  con eso el sistema existe y **se guarda solo**: no hay botón de guardar [documentación, observado].
- Tres puntos de partida: **en blanco** (sin dados, atributos ni rótulos de ningún juego), **basado en otro sistema
  propio**, o desde un PDF [documentación]. En la app, «Basar en otro sistema» es una acción del propio asistente
  [observado]. La guía de importar no describe el camino del PDF: es lo más reciente y lo menos documentado
  [documentación, inferido].
- El plan gratuito admite un solo sistema propio [documentación, ya en `sistemas-y-libros.md`].

### 2. Ritmo: el mismo creador a tres profundidades

Lo más característico. Un selector de **ritmo** decide cuántas partes se ven [observado, documentación]:

| Ritmo | Qué enseña |
|---|---|
| Rápido | Cuatro pasos: nombre, dados, atributos y hoja. Sale una ficha básica en minutos |
| Normal | Las partes de un sistema completo |
| Avanzado | Suma lo técnico: funciones propias, automatizaciones, mapa del sistema, traducción, código, planilla |

El ritmo no crea otro editor: es el mismo documento con más o menos partes a la vista. Cada parte acaba en un botón
«Siguiente: *nombre de la parte*» que marca un camino sin obligar a seguirlo; a la izquierda, la lista de partes se
corta con «N partes más» para no abrumar [observado].

### 3. El orden de las partes

Cinco grupos con nombres de mesa: **Ficha** (portada, campos, diseño, estilo, hojas de grupo), **Personaje**
(creación, rasgos, niveles), **En la mesa** (tiradas, combate, opciones de mesa, economía), **Contenido** (objetos,
bestiario, barajas, catálogos, paquetes) y **Avanzado** (mapa, funciones, automatizaciones, árboles, traducción, código,
planilla) [observado, documentación]. La guía recomienda **empezar por los campos y luego el diseño de la ficha**
[documentación]: primero qué tiene un personaje, después cómo se ve.

Dentro de cada parte el orden también va de lo imprescindible a lo opcional:

- **Tiradas**: primero «¿con qué se tira?» (una de cinco familias de dados), luego grupos **plegables** (resolución,
  críticos, nombres de los resultados, ventaja, reservas, dificultad del máster, modificadores, dados propios, tablas)
  y, por último, la tirada de cada campo. La guía dice que para empezar basta con el dado, el modo de resolución y los
  umbrales de crítico y pifia [documentación].
- **Combate**: «casi todo es opcional»; para empezar, solo **qué campo es la vida** y **una acción de ataque**, y
  probarla en el mapa antes de seguir. Daño contra dureza, localización, resistencias por niveles, tablas por margen,
  descansos y marco del token quedan en un bloque de reglas opcionales [documentación].
- **Creación del personaje**: pasos con nombre, descripción e icono, que se reordenan y duplican; métodos de generar
  valores (libre, reparto de puntos, tirar y asignar, valores fijos); un mecanismo común, las **concesiones** (dar
  puntos, subir un campo, dar un rasgo, ofrecer un menú, hacer una tirada), que reutilizan la creación, los niveles y
  los árboles. La guía aconseja empezar con **un solo camino de progresión** y dejar los árboles («la capa avanzada»)
  para después [documentación].

### 4. Cómo explican cada cosa

- **Ejemplos insertables** en las fórmulas: junto al editor hay fórmulas de ejemplo que se insertan con un clic
  [documentación].
- **Sugerencias mientras se escribe**: al teclear una fórmula salen los campos y funciones que existen, y se aceptan
  con el teclado [documentación].
- **Ejemplo debajo de cada opción** en las reglas con niveles (resistencias): bajo cada nivel se ve qué haría con un
  caso [documentación].
- **Descripción por opción** en los campos de elegir (cada clase o clan puede llevar su texto) [documentación].
- **Ejemplos de juego reales** en las guías (vida 0 → «Inconsciente»; la dureza que deja «Conmocionado»; el mago que ve
  sus conjuros y el guerrero sus maniobras), y un aviso del **error frecuente** de cada parte (por ejemplo, duplicar la
  vida si la fórmula base y la tabla de niveles suben lo mismo) [documentación].
- La ayuda detallada **vive en las guías**, no en la pantalla: las guías no describen ningún «?» por campo, y en la
  sesión del 2026-11-10 tampoco se anotaron [documentación, inferido].

### 5. Cómo enseñan el resultado mientras se edita

- **Vista previa a la derecha** en todos los creadores; en el de sistemas, una **ficha de muestra** que se ve como
  escritorio, tableta o móvil. Un sistema nuevo sale vacío hasta que tiene campos [observado, documentación].
- La guía de diseño matiza que no es una vista «en tiempo real» del todo: la forma de comprobar es abrir la ficha de
  muestra y revisar el móvil tras cada cambio [documentación].
- **«Generar la hoja desde los campos»**: si aún no hay diseño, crea un bloque por campo para que algo se vea enseguida
  [documentación].
- **Resultado de la fórmula al lado**, calculado con un valor de muestra [documentación].
- **«Tirar una vez»** en la parte de tiradas: prueba la configuración sin afectar a ninguna mesa [documentación]. En el
  marco del creador hay además un botón **«Probar»** arriba a la derecha [observado].
- **Probar las automatizaciones**: se ejecutan sobre una ficha de ejemplo y señala cuáles se dispararían; si dos se
  llaman en bucle, el motor las corta tras unas vueltas [documentación].
- En el combate, el **registro paso a paso** (armadura, luego resistencia, luego daño final) hace de explicación del
  resultado [documentación].

### 6. Cómo validan y muestran errores

- **«Revisión» en la cabecera**: lista los problemas del sistema (por ejemplo, que no tiene nombre) y cada uno lleva
  **«Ir a la parte»**, que salta a donde se corrige [observado, documentación].
- **El error debajo del campo**: si una fórmula no se entiende o nombra un campo que no existe, el aviso sale justo
  debajo [documentación]. Una casilla de dados con una expresión mal escrita **se pone en rojo** [documentación].
- **Tolerancia en vez de bloqueo**: un campo inexistente vale 0 y la ficha no se rompe; los límites recortan lo que
  teclea el jugador pero dejan pasar los bonos [documentación]. Se puede seguir editando con problemas abiertos.
- **Deshacer generoso**: Ctrl+Z fuera de los textos, y al borrar sale un aviso con «Deshacer» unos segundos
  [documentación].
- Al importar, lo que no se entiende **se descarta con aviso, nunca en silencio**, y los errores de paquete dicen qué
  falta (la licencia, un archivo citado) [documentación].

### 7. Qué esconden para avanzado

- Todo el **ritmo Avanzado** (funciones, automatizaciones, código, traducción, planilla) [documentación].
- En cada campo, una sección **Avanzado** plegada: ocultarlo en la creación o en el resumen; y en los efectos, «solo
  si», prioridad, «cuándo se aplica» y «no se acumula con» [documentación].
- **Lo que el formulario no cubre se edita en JSON**, campo a campo o bloque a bloque, como válvula de escape
  [documentación].
- **El modo código «a lo Roll20»** (HTML, CSS y scripts) dentro del mismo creador, con ida y vuelta: «Generar desde el
  sistema» escribe el código a partir de los campos, y al volver a traducirlo se elige **añadir solo lo nuevo** (lo
  seguro) o **reemplazar** (con confirmación). Es para quien viene de Roll20 o prefiere escribir [documentación].

### 8. Cómo llaman a las cosas

- Mesa: sistema, ficha, parte, campo, bloque, pestaña, tirada, tirar alto / tirar bajo, crítico, pifia, empate, reserva,
  ventaja, vida, defensa, acción, condición, estado, rasgo (perk), nivel, descanso, concesión.
- Separan **etiqueta** (el nombre que se ve) de **clave** (el nombre interno que usan las fórmulas, que no conviene
  cambiar después) [documentación].
- Pero en cuanto se baja un nivel aparecen tecnicismos sin traducir: «widget», «perk», nombres de propiedades del
  documento, sufijos de máximo y penalización, marcadores de plantilla de tirada, «sheet-workers» [documentación]. La
  frontera entre palabras de mesa y jerga queda justo en la línea de «avanzado», y no siempre se respeta.

## Compromisos y límites

- **Ganan** un camino corto de verdad (nombre → dados → atributos → hoja con el ritmo Rápido) sin cerrar la puerta a
  sistemas enormes: el ritmo esconde partes, no las quita, y el JSON y el código quedan de válvula.
- **Pierden** por tamaño: 24 partes y decenas de opciones por parte. Aun con ritmo y «N partes más», la superficie es
  inmensa y la ayuda tiene que irse a guías largas fuera de la pantalla. Su ayuda tiene incoherencias de recuento
  (ya anotado en `sistemas-y-libros.md`), señal de que crece más deprisa de lo que se explica.
- **Vista previa irregular**: es buena en la ficha y en «Tirar una vez», pero la propia guía de diseño avisa de que hay
  que abrir la ficha de muestra para ver el resultado real; y el creador de personajes no tiene vista previa descrita.
- **La revisión es corta**: la cabecera la avisa y «Ir a la parte» es muy útil, pero los errores finos (fórmulas,
  dados) viven solo en su campo, de modo que hay que pasar por la parte para verlos [inferido].
- **Tolerar errores** (campo inexistente = 0) evita fichas rotas, pero puede esconder una fórmula mal escrita que
  nadie ve hasta la partida.
- **Jerga en avanzado**: al abrir lo avanzado o los efectos salen claves internas; el usuario que no programa se topa
  con ellas antes de lo que debería.

## Qué nos llevamos a Crisol

1. **Primero el nombre y ya existe**, guardado solo y con deshacer a mano; nada de «guardar» al final.
2. **Un camino corto y visible**, como su ritmo Rápido: en Crisol, los pasos con palabras de mesa del plan («¿Qué tiene
   un personaje?», «¿Cómo se tira?», «¿Cómo se ve la ficha?», «¿Cómo se crea un personaje?», «¿Qué hay en el
   compendio?») y, al final de cada uno, «Siguiente: …». Sin selector de ritmo: lo avanzado va al fondo de cada paso,
   plegado, en vez de tres modos.
3. **Dentro de cada paso, de lo imprescindible a lo opcional**, como sus tiradas y su combate: en «¿Cómo se tira?»,
   primero el dado y si se tira alto o bajo; críticos, ventaja y reservas, plegados; fórmulas, al fondo.
4. **Decir qué basta para empezar** en cada paso («con la vida y un ataque ya se juega»): lo hacen en las guías;
   nosotros, en una línea en la propia pantalla.
5. **«Generar la ficha desde los campos»**: que la hoja no nazca vacía; luego se ordena.
6. **Probar sin mesa**: «Tirar una vez» y una ficha de ejemplo al lado. Crisol ya tiene `probar_formula` y
   `probar_tirada` en el MCP: la pantalla debe usar lo mismo.
7. **«Revisión» siempre a la vista con «Ir a…»** en cada aviso, y el error también debajo de su campo. Mejor que ellos:
   la revisión lista **todos** los avisos (también los de fórmulas y dados), con los mismos mensajes del esqueleto.
8. **Ejemplos insertables y sugerencias al escribir** en fórmulas y en dados; y un ejemplo debajo de cada opción que lo
   necesite. Lo que ellos tienen en guías largas, en Crisol va al «?» pequeño de cada campo, con un ejemplo real y
   corto.
9. **Etiqueta y clave separadas**, pero la clave se propone sola a partir de la etiqueta y vive en lo avanzado.
10. **Lo distinto**: no tendremos modo código ni JSON a mano en la pantalla (para eso están el esqueleto y la IA por
    MCP); y evitaremos que la jerga asome al abrir lo avanzado: también allí, palabras de mesa.

## Fuentes

- Guías públicas de roliando.com (leídas el 2026-11-12): `/guias`, `/guias/creador-primeros-pasos`,
  `/guias/creador-campos`, `/guias/creador-diseno`, `/guias/creador-tiradas`, `/guias/creador-combate`,
  `/guias/creador-creacion-progresion`, `/guias/modo-codigo-roll20`, `/guias/importar-sistemas`.
- Lo observado con la cuenta de prueba el 2026-11-10: `research/roliando/crear-y-compatibilidad.md`.
- Cuenta de prueba, 2026-11-12: se entró y se paró en la pantalla de aceptar los Términos nuevos; no se aceptó ni se
  cambió nada.
