# El compendio de dnd5e en Foundry VTT frente al de Crisol

Módulo de Crisol: 3 (contenido `srd-5e` y capacidad `foundry`) y 4 (pantallas del compendio) · Fecha: 2026-11-05 ·
Versión estudiada: Foundry VTT 14.369 con dnd5e 6.0.6; Crisol en `main` (4b6e125)

## Pregunta

Desde el ADR-0014 se pueden traer datos de dnd5e (MIT, con contenido SRD en CC BY 4.0). Para decidir qué mejorar en el
compendio de Crisol:

1. **Cobertura**: cuántos documentos hay de cada tipo en cada uno y qué nos falta.
2. **Riqueza**: qué datos mecánicos tiene dnd5e (actividades, efectos, avances, propiedades, acciones de criaturas,
   componentes) que el nuestro no tiene o tiene peor, con entradas concretas.
3. **Pantalla**: qué hace bien la suya (barra, explorador, filtros, orden, búsqueda, fichas, enlaces) y qué echamos en
   falta.
4. **Propuestas** priorizadas: traer sus datos (y cómo pasarían a nuestro formato) o imitar lo que hacen, con su coste.

No se repite lo ya estudiado: el modelo de avances y las tablas (`avances-y-tablas.md`) y cómo está hecho un sistema
(`sistemas-y-su-api.md`).

## Lo que hacen

Grado de certeza: **[O]** observado en la instancia en marcha (pantallas y documentos leídos desde la página);
**[O, datos]** contado con un script sobre los compendios o sobre nuestros JSON; **[I]** inferido.

### Cómo se estudió

- Foundry 14 en marcha (mundo `crisol-rea`, Gamemaster), con scripts de Playwright fuera del repo (Chromium 153,
  1920×1080). Desde la página se leyeron los índices de los 23 compendios del sistema y documentos sueltos (conjuros,
  armas, objetos mágicos, criaturas, clases, dotes, especies), y se hicieron capturas de la barra, de la ventana de un
  compendio, del explorador con filtros, de las fichas y de las páginas de diario. Esta vez no se usó craft-anything:
  bastó leer los datos desde la propia aplicación.
- Crisol: los JSON de `packages/systems/src/examples/5e/content/`, el formato de `mechanics.ts` y `docs.ts`, la
  pantalla `compendium.tsx` y las capturas de `e2e/tests/compendio.spec.ts` y de una copia suya con más pasos (solo en
  el scratchpad).
- Comparación por **nombre en inglés y edición**: los nombres coinciden en casi todo, así que la diferencia de cada
  tipo se lista entrada por entrada.

### 1. Cobertura

dnd5e reparte su contenido en 23 compendios: unos 4450 documentos de objetos, actores y efectos (algunos repetidos,
porque los rasgos de monstruo también van dentro de cada criatura), 1421 páginas de diario de reglas y 97 tablas
aleatorias **[O, datos]**. Crisol tiene 3170 documentos **[O, datos]**.

| Tipo | Crisol 2014 | dnd5e 2014 | Crisol 2024 | dnd5e 2024 | Qué cambia |
| --- | --- | --- | --- | --- | --- |
| Conjuros | 319 | 319 | 339 | 340 | Los mismos. El de más de dnd5e 2024 no está en el SRD 5.2.1 (buscado en su texto) |
| Criaturas | 317 | 337 | 330 | 385 (381 nombres) | Lo de más: perfiles de lo que crean conjuros y objetos (ojo arcano, objetos animados, corceles, arma espiritual, figuritas, alfombras), variantes de 2014 (enjambres, rata enferma) y 5 marcadas «Free Rules» sin licencia |
| Armas | 37 | 40 | 38 | 42 | Iguales; dnd5e añade el golpe sin armas y los bastones de foco |
| Armaduras y escudos | 13 | 13 | 13 | 14 | Iguales (nombres algo distintos en 2014) |
| Objetos mágicos | 238 | 599 | 258 | 316 | dnd5e 2014 **desdobla** cada genérico en variantes concretas (cada arma +1/+2/+3, cada cinturón de gigante, cada armadura de adamantina); en 2024 desdobla menos y usa «encantamientos» sobre una base |
| Equipo, monturas, vehículos, mercancías | 174 | 186 | 156 | 204 | dnd5e separa las piezas de cada lote, trae venenos y trampas como objetos (2024), las cartas de la baraja y las monturas y vehículos como actores |
| Clases / subclases | 12 / 12 | 12 / 12 | 12 / 12 | 12 / 12 | Iguales |
| Rasgos de clase | 188 | 234 | 242 | 255 | dnd5e trae **las opciones como documentos**: invocaciones (32 y 28), metamagia (8 y 10), estilos de combate, pactos, opciones del cazador. Nosotros las tenemos solo en el texto (2014) o en un rasgo «Opciones de…» (2024) |
| Especies | 13 | 9 | 9 | 14 | En 2024, dnd5e hace de cada linaje una especie (elfo drow, alto, silvano…); nosotros, una elección dentro de la especie |
| Rasgos de especie | 92 | 26 | 33 | 36 | Nuestros 92 de 2014 incluyen rasgos de solo texto (edad, alineamiento, tamaño, idiomas); dnd5e los pone en los avances y desdobla el aliento del dracónido por color |
| Trasfondos / dotes | 1 / 1 | 1 / 1 | 4 / 17 | 4 / 17 | Iguales |
| Estados | 15 | (en las reglas) | 15 | (en las reglas) | dnd5e además trae 173 efectos sueltos listos para aplicar (inmunidades, ventajas, estados) |
| Reglas | 72 | 20 entradas, 407 páginas | 188 | 53 entradas, 1014 páginas | 386 de sus páginas de 2024 son referencias cortas pensadas para enlazarse desde los textos |
| Tablas aleatorias | — | 31 | — | 66 | Nosotros las dejamos dentro del texto, como tablas de Markdown |
| Personajes hechos | — | 12 | — | 48 | Sin licencia indicada en sus datos |

**Licencias** **[O, datos]**: cada documento de dnd5e dice su libro, licencia y reglas. Casi todo es SRD 5.1 o 5.2 con
CC BY 4.0, pero hay excepciones: 5 criaturas y 2 objetos marcados «Free Rules» sin licencia, más de 400 documentos
(rasgos de monstruo de 2024, personajes hechos, perfiles de invocación) sin licencia escrita, y al menos un conjuro
marcado CC BY que no aparece en el SRD 5.2.1. Si se trae algo, **no basta con su etiqueta**: hay que cruzarlo con lo que
ya sale del SRD (nuestros conceptos).

**Idioma** **[O]**: dnd5e solo trae inglés (su carpeta de idiomas tiene un único archivo). No hay ningún módulo de
traducción instalado; no comprobé las traducciones de la comunidad.

### 2. Riqueza de cada entrada

**El modelo de dnd5e, en corto** **[O]**: lo que se tira con un documento son **actividades** de varias clases
(ataque, salvación, daño, curación, prueba, utilidad, lanzar un conjuro, invocar, encantar otro objeto, transformar,
teletransportar). Cada una lleva su coste de activación, lo que consume (usos del objeto, espacios, recursos), su
alcance y objetivo, sus partes de daño (dados, caras, bono, tipos y **su propio escalado**) y los efectos que aplica.
Los **efectos activos** cambian rutas de los datos del personaje con un modo (sumar, sustituir, mejorar, multiplicar),
pueden imponer estados y tienen duración. Los **avances** de clases, especies, trasfondos y dotes ya están estudiados
en `avances-y-tablas.md`.

**Conjuros.** En lo básico vamos a la par: conjuros con tirada (ataque, salvación, daño o curación) 148 nuestros
frente a 150 suyos en 2014, y 171 frente a 172 en 2024; con daño, 77/75 y 96/97 **[O, datos]**. La diferencia está en
lo demás:

| Qué | Crisol 2014 / 2024 | dnd5e 2014 / 2024 |
| --- | --- | --- |
| Efectos sobre quien lo recibe | 8 / 8 | 166 / 152 |
| Estado que impone (paralizado, asustado…) | 0 / 0 | 41 / 61 |
| Invocaciones con su perfil | 0 / 0 | 29 / 34 |
| Área estructurada (forma y tamaño) | 0 (texto) | 88 / 81 |
| Duración estructurada | 0 (texto) | 232 / 238 |
| Componente material con coste o que se gasta | 0 (texto) | 49 y 30 / 1 y 30 |
| Escalado | uno por documento | por cada parte de daño, por objetivos y por consumo |

Ejemplos **[O]**:
- *Bola de fuego*: los dos tienen la salvación de Destreza con la CD de conjuros, 8d6 de fuego, la mitad al superarla y
  +1d6 por nivel de espacio. dnd5e añade la esfera de 6 m (que dibuja en la mesa), «objetivos: criaturas» y el alcance
  como número y unidad. Nuestro alcance, tiempo, duración y componentes son texto.
- *Proyectil mágico*: nuestro 1d4+1 de fuerza no dice cuántos dardos ni que suben con el espacio; dnd5e lo lleva en el
  número de objetivos, como fórmula del nivel al que se lanza.
- *Inmovilizar persona*: los dos piden salvación de Sabiduría; dnd5e además impone «paralizado» al fallar, con su
  duración y la salvación al final de cada turno, y escala los objetivos. El nuestro no aplica el estado.
- *Bendición*: en Crisol, solo texto; dnd5e la resuelve con un efecto que suma 1d4. Nuestro formato no deja poner dados
  en un efecto («los dados van en las acciones»).
- *Arma espiritual* 2024: nos falta el +1d8 por nivel de espacio; en dnd5e, además, es una invocación con su perfil.

**Armas y armaduras.** Aquí vamos a la par **[O]**: categoría, arma base, propiedades, maestría, daño, versátil, tipo
de daño, peso y coste; en armaduras, CA base, Destreza y su tope, Fuerza y desventaja en Sigilo. El ataque y el daño
nuestros salen de campos calculados con quien la lleva, igual que la actividad de ataque de dnd5e. Solo cambia que su
distancia (normal y larga) y el alcance son números, y la nuestra, texto («80/320»).

**Objetos mágicos.** Es donde más perdemos **[O, datos]**:

| Qué | Crisol 2014 / 2024 | dnd5e 2014 / 2024 |
| --- | --- | --- |
| Con acciones | 0 / 0 | 260 / 268 (con algo más que un ataque) |
| Lanzan un conjuro | 0 | 48 / 69 |
| Con usos o cargas | 38 / 43 | 198 / 203 |
| Con efectos | 27 / 29 | 84 / 169 |
| Con precio | 0 | 599 / 302 |
| Solo texto | 177 / 191 | — |

- *Varita de bolas de fuego*: tenemos sus 7 cargas y su recuperación, pero no la acción de lanzar (aunque el ejemplo
  de `docs.ts` sí la trae). dnd5e la enlaza al conjuro con su CD fija y el gasto de una carga.
- *Pociones de curación* (2024): en Crisol, una sola entrada de texto; dnd5e trae cada poción con su curación y se
  gasta al usarla.
- *Arma +1, +2 o +3* y *Lengua de fuego*: en Crisol, texto. dnd5e 2024 los resuelve como **encantamientos**: se
  aplican a un arma que ya se tiene y le cambian el nombre, el bono, la rareza y el daño. En 2014, en cambio, trae cada
  combinación como un objeto aparte (por eso 599).
- *Anillo de protección*: igual en los dos (+1 a CA y salvaciones, con sintonía).
- Precio: el SRD 5.2.1 trae una tabla de valor por rareza, así que el de 2024 se puede calcular. El SRD 5.1 no trae
  precios de objetos mágicos; de dónde salen los de dnd5e 2014 no lo comprobé.

**Criaturas.** dnd5e guarda cada criatura como un actor con sus objetos (armas, rasgos, conjuros) y sus actividades
**[O]**. Nosotros, un perfil con los campos básicos, el bloque entero en el texto y una lista de acciones extraídas del
texto inglés.

| Qué | Crisol 2014 / 2024 | dnd5e 2014 / 2024 |
| --- | --- | --- |
| Acciones o actividades | 674 / 584 | 1565 / 2145 |
| Ataques | 513 / 422 | 552 / 505 |
| Salvaciones | 227 / 175 | 384 / 451 |
| Con recarga | 44 / 63 | 64 / 87 |
| Legendarias | 27 / 22 | 93 / 107 |
| Conjuros dentro del perfil | 0 | 313 / 404 |
| Sentidos, idiomas, hábitat, tesoro | solo en el texto | estructurados |

Problemas medidos en lo nuestro **[O, datos]**: 131 acciones con la etiqueta sin traducir (en 67 criaturas; el
extractor deja la inglesa cuando las secciones en los dos idiomas no tienen las mismas entradas), 55 criaturas con una
recarga en el texto sin acción con recarga, y 82 con alguna salvación en el texto y ninguna acción de salvación
(algunas de esas salvaciones serán de rasgos, no de acciones: la cifra es un techo).

- *Dragón rojo adulto* (2024): nuestro solo tiene «Rend» (sin traducir: «Desgarro») y el recurso de acciones
  legendarias. Le faltan el aliento de fuego (CD 21, 17d6, recarga 5–6), el lanzamiento de conjuros y las tres acciones
  legendarias. En dnd5e salen como filas con su tirada y su fórmula, la recarga marcada y las acciones y resistencias
  legendarias como contadores.
- *Guerrero goblin* (2024): el 1d4 de más «si el ataque tenía ventaja» lo sumamos **siempre** como segunda parte de
  daño. dnd5e lo separa en dos ataques (normal y con ventaja). No medí cuántas criaturas más tienen ese fallo.

**Clases.** El avance de la clase está estudiado aparte (`avances-y-tablas.md`), y nuestros `grants` cubren lo mismo
con otra forma. Lo que nos falta en el compendio **[O]**:
- la **descripción** de la clase: nuestras 24 clases no tienen texto (ni rasgos básicos, ni introducción, ni tabla);
- la **tabla de la clase** (nivel, bonificador, rasgos y columnas como «Tomar aliento» o «Maestrías»): dnd5e la enseña
  en su página de diario con un enlace en cada rasgo;
- el **equipo inicial** estructurado: dnd5e trae las opciones A/B/C con sus objetos enlazados y el oro; nosotros lo
  dejamos «a mano».

**Dotes y trasfondos.** Las mismas 17 dotes de 2024. dnd5e sabe qué característica mejora cada dote (y filtra por
ello); 11 de las 17 llevan avances y 5, efectos. De nuestras 18 dotes, 3 están automatizadas del todo y 2 en parte. *Alerta* está
igual en los dos (competencia en iniciativa). *Iniciado en la magia*, en Crisol, es solo texto.

**Bien de lo nuestro** **[O]**: textos en español e inglés en cada entrada; cada conjuro dice sus clases (dnd5e lo
guarda en páginas de diario aparte, como listas); las versiones de cada edición, unidas por concepto; y la mecánica en
un formato pensado para que lo escriba la IA.

### 3. Pantalla

**La barra de compendios** **[O]**: una lista de compendios agrupados en carpetas («Legado» y «Moderno», y dentro, por
tema), con su buscador y un botón al explorador. Cada compendio se abre en una ventana propia con carpetas (los
conjuros, por nivel), buscador y orden alfabético o manual.

**El explorador de dnd5e** **[O]** es una ventana con pestañas verticales (clases, subclases, especies, dotes,
trasfondos, objetos, conjuros, monstruos, vehículos) y, a la izquierda, **filtros propios de cada pestaña**:
- conjuros: nivel (de… a…), escuela, lista de clase, lista de subclase, propiedades (concentración, ritual,
  componentes) y tiempo de lanzamiento;
- monstruos: VD (de… a…), tamaño, tipo, hábitat y tipos de movimiento;
- objetos: clase de objeto, sintonía, precio (de… a…), maestría, rareza y «mágico»;
- dotes: tipo (origen, general, estilo de combate, don épico), «pasiva» y qué característica mejora;
- clases y especies: «lanza conjuros», «visión en la oscuridad»;
- en todas, la fuente (SRD 5.1, SRD 5.2…).

Las casillas tienen tres estados: **incluir, excluir** (rojo) o nada. El modo «avanzado» deja mezclar tipos. Un
engranaje elige qué compendios entran. Los resultados son una lista con icono, nombre, clase de documento y fuente; al
**pasar el ratón** sale una tarjeta con lo principal (en un conjuro: tiempo, alcance, objetivo, componentes, duración y
el texto). Al pulsar, abre la ficha; también se arrastran a una hoja **[I]** (no lo probé).

Lo que no tiene: columnas (nivel, VD, rareza) ni orden por ellas, solo alfabético; mezcla las dos ediciones sin
agruparlas; todo en inglés; ventanas flotantes que se tapan entre sí.

**Las fichas** **[O]**:
- *Conjuro*: cabecera con icono, nombre y «3.er nivel · Evocación»; una lista de datos (tiempo, alcance, objetivo,
  componentes, duración, materiales), el texto plegable y etiquetas de clase al pie. Otras pestañas: detalles (todo
  editable), actividades y efectos.
- *Criatura*: no es un bloque de texto sino una **hoja viva**: CA, PG, iniciativa, VD y bonificador; las seis
  características con su salvación; a la izquierda, velocidades, habilidades, sentidos, inmunidades, idiomas, hábitat,
  equipo y tesoro como etiquetas; a la derecha, rasgos, acciones, acciones adicionales y legendarias, cada una con usos,
  tirada (+14, «DES 21») y fórmula (1d10 + 8 cortante, 2d4 fuego), y los contadores de acciones y resistencias
  legendarias.
- *Objeto mágico*: rareza, precio y peso en la cabecera, y sus actividades (la varita: «Bola de fuego», con su gasto).
- *Clase*: rasgos básicos en una tabla (con el equipo inicial enlazado), su texto y la pestaña de avances por nivel.
- *Diario de reglas*: la página de cada clase con su tabla de rasgos (cada rasgo, un enlace), sus subclases y, en el
  capítulo de conjuros, la **lista de cada clase** agrupable por nivel o por escuela.

**Enlaces en el texto** **[O]**: los textos llevan referencias a estados, reglas y otros documentos. Al pasar el ratón
por «paralizado» en *Inmovilizar persona* sale una tarjeta con la regla entera, que a su vez enlaza «incapacitado» y
«ventaja». Algunos números del texto se calculan (el área de *Bola de fuego*, los dardos de *Proyectil mágico*).

**El compendio de Crisol** **[O]**: una sola pantalla de tres columnas. A la izquierda, el buscador (en los dos
idiomas y sin tildes, primero lo que se llama así), los tipos como botones y la lista (nombre, tipo y «2024» o «2014 ·
Legado»), de 100 en 100. En el centro, la entrada: sus campos, su texto en Markdown y, en las clases, lo que concede
por nivel con enlaces. A la derecha, la edición, el nombre en inglés, la otra versión y la atribución.

Lo que echamos en falta frente a dnd5e:
- **ver la mecánica**: el compendio no enseña ni las acciones, ni el daño, ni los usos, ni los efectos, ni cuánto
  automatiza Crisol; *Bola de fuego* se ve igual que si fuera solo texto;
- **filtros por campos** (nivel, escuela, clase, VD, rareza…), columnas en la lista y orden;
- **tarjeta al pasar** por un resultado y **enlaces** en el texto a estados, reglas y conjuros;
- la **criatura como hoja**: hoy es su bloque en texto, con la segunda fila de la tabla de características (las
  salvaciones de 2024) sin rótulo;
- la **clase**: sin descripción ni tabla, y con «Dado de golpe (caras) 10» y «Dado de golpe 1d10» repetidos;
- listas por clase agrupadas por nivel.

De paso, un fallo de contenido **[O, datos]**: 76 bloques de nuestras descripciones son tablas de una sola columna. Al
menos varias (en «¿Qué es un conjuro?» de 2014, «Competencia», «Trampas» o «Combate» de 2024) son texto de un recuadro
del PDF partido en filas. No las revisé todas.

## Compromisos y límites

- dnd5e gana en automatización porque su formato es grande y propio: actividades con muchos campos y efectos que
  apuntan a rutas internas de sus datos. Traducir sus efectos a los nuestros exige una tabla de rutas a mano
  (bonificadores a ataques, salvaciones, CA, resistencias, velocidades…), como ya se vio en `sistemas-y-su-api.md`.
- Desdoblar los objetos mágicos (2014) llena el compendio de casi duplicados; el encantamiento de 2024 es más limpio,
  pero necesita una mecánica nueva (aplicar un objeto sobre otro).
- Sus textos son HTML en inglés con referencias propias de Foundry; no nos sirven tal cual. Los nuestros salen de los
  SRD en español e inglés.
- El explorador filtra muy bien, pero la lista enseña poco de cada resultado y no ordena por columnas; la tarjeta al
  pasar suple parte de eso con el ratón, no en el móvil.
- La etiqueta de licencia de dnd5e no es fiable del todo (entradas sin licencia, una marcada CC BY fuera del SRD).

## Qué nos llevamos a Crisol

### Propuestas, por prioridad

Coste aproximado en días de trabajo, con pruebas y revisión.

| # | Qué | Traer o imitar | Cómo | Coste |
| --- | --- | --- | --- | --- |
| 1 | **Enseñar la mecánica en la entrada**: una sección «En juego» con cada acción (ataque +X o salvación de DES con su CD, daño y tipo, mitad al superar, recarga, usos, coste legendario), los recursos y su recuperación, los efectos en palabras, el escalado («+1d6 por nivel de espacio por encima del 3») y cuánto automatiza Crisol (todo, en parte, solo texto) con lo que se lleva a mano | Imitar | Solo web: los datos ya llegan en `getCampaignContent` | 1–2 |
| 2 | **Arreglar lo medido en el contenido**: las 131 etiquetas sin traducir, las recargas y salvaciones que no salieron, el daño condicional del goblin, la acción de la varita y las tablas de una columna | Usar dnd5e como comprobación | Un comparador en `scripts/srd` que cruce por nombre en inglés el número de acciones, el bono de ataque, la CD y el daño de cada criatura con dnd5e y liste las diferencias; los arreglos van en los extractores | 2–3 |
| 3 | **Filtros por campos, columnas y orden** en la lista: conjuros (nivel, escuela, clase, concentración, ritual), criaturas (VD, tamaño, tipo), objetos mágicos (rareza, sintonía), armas (categoría, propiedades, maestría), dotes (categoría); casillas de incluir y excluir; una o dos columnas por tipo (nivel y escuela, VD y tipo, rareza) y orden por ellas; todo en la URL | Imitar, mejor que ellos (ellos no tienen columnas) | Filtros genéricos sacados de los campos del tipo (opciones, sí o no, número): vale para cualquier sistema. El índice del contenido (hoy nombre, tipo, fuente y concepto) tiene que llevar esos campos. El tipo de criatura y el de objeto mágico son texto: convertirlos en opciones | 3–4 |
| 4 | **Completar criaturas y objetos mágicos con la mecánica de dnd5e**: acciones completas (ataques, salvaciones, recargas, legendarias, usos por día), sentidos e idiomas como campos; en objetos, cargas, pociones que curan, efectos pasivos y precio por rareza (2024) | Traer datos | Un paso nuevo en `scripts/srd`: leer los compendios de dnd5e (su LevelDB o un volcado), emparejar por nombre en inglés y edición (casi todo coincide; unas 20 excepciones a mano), pasar cada actividad a nuestra acción (dados + `@caracteristicas.X.mod`, CD como fórmula), y tomar las etiquetas en español de nuestro texto. Solo números y estructura; textos, los nuestros. Solo lo que ya está en nuestro SRD | 4–6 |
| 5 | **La criatura como hoja**: cabecera con CA, PG, VD y características con salvaciones; sentidos, idiomas y resistencias como etiquetas; acciones en filas con su tirada y su fórmula, y botón para tirarlas | Imitar | Depende de la 4 (datos completos) y reutiliza lo de la hoja de personaje | 2–3 |
| 6 | **La página de la clase**: rasgos básicos, descripción y **la tabla de la clase calculada de nuestra mecánica** (los rasgos de cada nivel salen de los `grants` y las columnas, de evaluar nivel a nivel las fórmulas de sus recursos, como los usos de «Tomar aliento») | Imitar | La descripción, de los PDF del SRD; la tabla, en la web o en el servidor, sin datos nuevos | 2–3 |
| 7 | **Enlaces y tarjetas en el texto**: estados, reglas del glosario y conjuros mencionados enlazan a su entrada y enseñan una tarjeta al pasar (y al tocar, en el móvil) | Imitar | Marcar los enlaces al extraer (una sintaxis propia de enlace a concepto) mejor que adivinarlos en la web | 2–3 |
| 8 | **Las opciones como documentos**: invocaciones, metamagia, estilos de combate, pactos y opciones del cazador, para que el creador las ofrezca | Traer la lista y su mecánica | Los textos en español, de los PDF del SRD; la lista y lo automatizable, de dnd5e | 2–3 |
| 9 | **Ampliar el formato de la mecánica** con lo que dnd5e resuelve y nosotros no: estado que impone una acción al fallar o al impactar; número de objetivos y su escalado; área y alcance como números; dados en los efectos de tirada (Bendición, Guía); una acción que lanza un conjuro del contenido (varitas, bastones, criaturas lanzadoras); daño opcional (con ventaja). Después, traer de dnd5e esos datos de los conjuros | Imitar el modelo y luego traer datos | Cambia el formato del ADR-0012: un ADR nuevo, validación, motor, hoja y documentación para la IA | 8–12 |
| 10 | **Objetos que se aplican a otro**: «Arma +1», «Lengua de fuego», «Armadura de resistencia»: al añadirlos se elige el arma o armadura y se le aplica (nombre, bono, daño). Nuestra arma ya tiene `bono` | Imitar el encantamiento de 2024, no el desdoble de 2014 | Mecánica nueva; va bien con la 9 | 3–5 |
| 11 | **Tablas del SRD** (las de los objetos, la locura, las personalidades…) como tablas aleatorias que se tiran | Imitar; texto nuestro | En Crisol las tablas son pestañas de páginas del mundo: decidir si un sistema puede traerlas (el módulo 4 ya lo prevé) y sacarlas de los PDF en español; dnd5e sirve de lista de comprobación | 2–3 |
| 12 | **Perfiles de invocación** (los de los conjuros y objetos) | Traer datos | Cuando la mesa (módulo 6) sepa invocar | — |

Orden propuesto: 1 y 2 enseguida (baratas y cambian mucho lo que se ve); 3, 4 y 5 juntas, porque una criatura
completa y filtrable es lo que más se usa en partida; 6, 7 y 8 con el creador; 9 y 10, con su ADR, cuando haga falta
automatizar más conjuros y objetos; 11 y 12, en el módulo 4 y la mesa.

### Qué no traer

- Imágenes e iconos (son de Foundry o de su arte, no CC BY).
- Sus textos en inglés: los nuestros salen del SRD en los dos idiomas.
- Lo que no esté en nuestro SRD: las entradas «Free Rules», el conjuro de más de 2024, los personajes hechos y los
  precios de objetos mágicos de 2014 hasta saber de dónde salen.
- El desdoble de objetos mágicos de 2014.

Todo lo traído va en `docs/terceros.md`. Queda por decidir cómo marcar el origen en los JSON del contenido, que no
admiten una cabecera como los archivos de código.

### Qué haremos distinto

- Lo que ya hacemos mejor y no hay que perder: los dos idiomas en cada entrada y en la búsqueda, las ediciones unidas
  por concepto con «también en» y la elección de la campaña, las clases dentro de cada conjuro y una pantalla de
  lectura en vez de ventanas que se tapan.
- Filtros sacados de los campos del sistema, no escritos a mano por tipo: así sirven para Fateforge o para un sistema
  hecho con la IA.
- Columnas y orden en la lista, que el explorador de dnd5e no tiene.
- Las tarjetas al pasar también deben abrirse al tocar, para el móvil.

### Sin comprobar

- Arrastrar desde el explorador a una hoja y abrirlo para elegir desde la hoja de personaje.
- Las traducciones al español de la comunidad.
- Cuántas criaturas más tienen daño condicional sumado siempre, como el goblin.
- El origen de los precios de los objetos mágicos de 2014 en dnd5e.
- Las cuentas de esta nota dependen de cómo se cuenta (por ejemplo, «mágico» por rareza o por propiedad); las de
  acciones en nuestro texto salen de patrones sobre el inglés y son aproximadas.
