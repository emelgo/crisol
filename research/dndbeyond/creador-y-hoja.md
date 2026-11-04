# El creador de personajes y la hoja en D&D Beyond

Módulo de Crisol: 3. Sistemas, fichas y dados · Fecha: 2026-11-04 · Versión estudiada: web de dndbeyond.com (su app
de personajes 1.72.20) consultada el 2026-11-04 con la sesión de Enrique en Chromium 156, más su centro de ayuda
oficial, sus notas de cambios y sus foros

## Pregunta

Para Enrique, el creador de personajes y la hoja de D&D Beyond son lo fundamental. Queríamos entender cómo los
resuelven para diseñar los de Crisol, sin copiarlos:

1. **El creador**: los pasos y su orden, qué decide cada uno, cómo enseña las opciones, cómo valida, qué se puede dejar
   a medias, 2014 frente a 2024, el contenido propio y las fuentes activadas.
2. **Subir de nivel**: cómo se hace, qué se elige, multiclase, deshacer.
3. **La hoja**, en escritorio y en el móvil: cómo se organiza, qué se edita en ella y qué lleva al creador, recursos con
   usos, descansos, puntos de golpe, estados e inspiración.
4. **Tiradas desde la hoja**: qué se tira con un clic, ventaja y desventaja, daño y críticos, dados 3D, el registro de
   tiradas y quién ve qué en una campaña.
5. **Inventario y recursos**: contenedores, peso, monedas, sintonía, equipar.
6. **Qué nos llevamos a Crisol**.

Grado de certeza de cada afirmación:

- **[O]**: observado en vivo con la sesión de Enrique, en escritorio (1440 px) y en un móvil emulado (390 px, con
  toque).
- **[I]**: inferido, o lo que dicen la ayuda oficial, sus notas de cambios o sus foros sin haberlo visto. Se indica de
  dónde: [I, ayuda], [I, cambios], [I, foros].

Material: los cuatro personajes de su cuenta (un pícaro de nivel 10 con reglas de 2024, dos paladines de nivel 1 y uno
a medias, sin clase ni especie) y una de sus campañas, donde es máster: la hoja de un jugador y el registro de tiradas.
No se creó ni se cambió nada (ver «Cómo se hizo»).

## Lo que hacen

### 1. El creador

#### Por dónde se entra

- **Tres formas de crear** [I, ayuda y cambios]:
  - la **normal**, paso a paso, que es la que se estudia aquí;
  - una **guiada**, solo para nivel 1. Se puede usar sin cuenta, recuerda lo elegido si se cierra la pestaña y al
    acabar lleva a la hoja o a buscar partida;
  - **prediseñados** de varios niveles, que se reclaman y luego se cambian. Se filtran por reglas, clase, nivel y
    especie.
- **La normal guarda un personaje en blanco nada más entrar**, «para proteger tu trabajo» [I, ayuda]. Por eso la cuenta
  de Enrique tiene uno de nivel 1 «sin especie, sin clase»: la lista de personajes lo muestra como uno más, con ver,
  editar, copiar y borrar [O]. Por la misma razón no se abrió el creador para crear.
- **La lista de personajes** [O]:
  - huecos usados frente a disponibles (ilimitados con suscripción);
  - buscador;
  - ordenar por creación, nombre, nivel o modificación;
  - una hoja en blanco descargable;
  - ajustes.

#### La estructura

- **Una cabecera fija** con el título, el nombre del personaje y la barra de pasos [O]. A su lado, un botón de ayuda (?)
  que enseña u oculta los textos de ayuda, y un icono de hoja que sale apagado hasta que el personaje está listo
  [O el icono; I, ayuda, lo de apagado].
- **Los pasos**, numerados y en este orden [O]:

  | Paso | Qué decide |
  |---|---|
  | Portada | Retrato, nombre (con sugerencias) y las preferencias del personaje |
  | 1. Clase | Clase, nivel, subclase y elecciones de cada rasgo; PG máximos; multiclase; conjuros si lanza |
  | 2. Trasfondo | El origen y lo que da, más todo el texto de rol |
  | 3. Especie | La especie y las elecciones de sus rasgos |
  | 4. Características | Método y puntuaciones; el cálculo de cada una |
  | 5. Equipo | Equipo inicial o su oro; inventario y monedas |
  | Qué sigue | Ir a la hoja, exportar a PDF, unirse a una campaña o crear una |

- El orden es el de las reglas de 2024 (la clase primero, el origen después), y se aplica igual al contenido de 2014
  [O el orden; I que valga para 2014, porque no hay otro creador].
- **La navegación es libre** [O]: cualquier paso desde la barra, más flechas de anterior y siguiente a los lados del
  nombre. No hay botón de «terminar»: cada cambio se guarda solo [I].
- **Cada paso tiene su dirección**, con dos estados: «elegir» (la lista) y «gestionar» (lo elegido) [O]. Retrato y
  nombre se repiten arriba en todos los pasos [O].

#### La portada: las preferencias

Son las mismas que en la hoja (gestionar → ajustes) [O]:

| Preferencia | Opciones |
|---|---|
| Fuentes | Por categoría: contenido propio, núcleo y ampliado de 2024, suscripción, un socio, núcleo y ampliado de 2014, legado, socios (todos o por editorial). Solo se ve lo que se posee y está activado; quitar todo impide terminar |
| Dados digitales | Sí o no, **por navegador**, no por personaje |
| Rasgos opcionales | Rasgos de clase opcionales; origen personalizado |
| Avance | Por hitos o por experiencia |
| PG al subir | Fijos o tirados a mano |
| Requisitos | Se pueden desactivar por separado para dotes y para multiclase |
| Conjuros a nivel superior | Enseñar y resaltar los que se pueden lanzar con espacios más altos |
| Carga | Normal, sin carga o detallada; si las monedas pesan |
| Características | Modificador arriba o puntuación arriba |
| Privacidad | Solo la campaña, pública con enlace, o privada |

#### Clase

- **Elegir** [O]:
  - un buscador y grupos plegables por categoría de fuente, cada uno con una línea que lo explica;
  - una tarjeta por clase, con icono, nombre y libro.
- **Al pulsar una clase sale un diálogo de confirmación** [O]:
  - el resumen: característica principal, dado de golpe y salvaciones;
  - un enlace a su página de detalle;
  - sus rasgos por nivel, desplegables;
  - «cancelar» o «añadir clase». Nada se añade sin confirmar.
- **Gestionar** [O]:
  - **Arriba**: el nivel total y el tipo de avance. Al lado, los PG máximos y los dados de golpe, con un botón que abre
    un diálogo: PG fijos, modificador, anulación, lo que suma la Constitución y tres valores de referencia (fijo, medio
    y máximo posible).
  - **Por cada clase**: una cabecera con la subclase, un desplegable de nivel y una X para quitarla.
  - **Los rasgos de clase**, en acordeón: nombre, «N elecciones» y nivel. Al abrir uno sale su texto con las
    elecciones en línea, y **las elecciones se anidan**: la mejora de característica pide elegir una dote, y esa dote
    pide a su vez una característica y una pericia.
  - **Al final**, cuántos rasgos llegan a niveles más altos y «añadir otra clase».
- Los lanzadores añaden y preparan conjuros también aquí [I, ayuda].

#### Trasfondo

- Un desplegable con el origen y, debajo, lo que da: habilidades, herramientas, una dote y las mejoras de
  característica, con su contador de elecciones [O]. Hay también un trasfondo personalizado [I, ayuda].
- Después, **todo el texto de rol** en el mismo paso [O]:
  - detalles: alineamiento, fe, estilo de vida;
  - lo físico: pelo, piel, ojos, altura, peso, edad, género;
  - lo personal: personalidad, ideales, vínculos, defectos;
  - las notas: organizaciones, aliados, enemigos, historia y otras.
- La dirección del paso aún se llama «descripción»: el antiguo paso de descripción se ha fundido con el trasfondo [O la
  dirección; I la historia].

#### Especie

- **Elegir** [O]:
  - una lista agrupada por fuente, con filtro de fuentes y un interruptor de «mostrar legado»;
  - las especies de 2014 llevan la etiqueta de legado;
  - las que tienen variantes muestran cuántas.
- **Gestionar** [O]:
  - resumen y enlace a la página de detalle;
  - los rasgos, con las elecciones de cada uno (linaje, sus conjuros, idiomas);
  - «cambiar especie».

#### Características

- **Un desplegable de método**, vacío al principio [O]. Según la ayuda, los métodos son matriz estándar, compra por
  puntos y manual [I, ayuda].
- **El método «manual o tirado»** añade grupos de tiradas: seis botones de tirar por grupo, más grupos si se quieren,
  reiniciar el grupo y aplicar el resultado [O, en el personaje de nivel 10]. Esas tiradas van al registro de tiradas
  [I, cambios: corrigieron que salieran a nombre del máster].
- **El cálculo de cada característica**, a la vista y con la misma cadena que la barra lateral de la hoja [O]:
  - el total y su modificador;
  - la base;
  - las bonificaciones, cada una con su origen (el trasfondo, cada dote);
  - la puntuación fijada;
  - la bonificación acumulable;
  - otro modificador;
  - la anulación.

#### Equipo y «qué sigue»

- **Equipo** [O]:
  - el equipo inicial, elegido con **«equipo» u «oro»**;
  - el inventario actual, con el estado de cada objeto: en uso, puesto, empuñado o la cantidad;
  - el peso total, otras posesiones, añadir objetos y las monedas.
- **Qué sigue** [O]: ver la hoja, exportar a PDF, ver todos los personajes, y unirse a una campaña o crear una.

#### Validar y dejar a medias

- **Lo pendiente se marca con un (!)** en todo el creador [I, ayuda]. En los personajes vistos no quedaba nada
  pendiente.
- **«Listo para la hoja»**: hasta tener clase, trasfondo, especie y características no hay hoja ni PDF [I, ayuda]. El
  personaje a medias sale igualmente en la lista [O].
- **Los requisitos se explican en cada opción**: la multiclase dice qué falta (punto 2) y cada dote lleva sus
  requisitos en su texto [O]. Con los requisitos desactivados en las preferencias, no se comprueban [I].
- **Todo puede quedar a medias**: no hay paso final que cierre nada [I].

#### 2014 frente a 2024

- **No hay un «modo de reglas» del personaje**, sino categorías de fuentes que se activan una a una [O]. Las etiquetas
  «5e» (2014) y «5.5e» (2024) están por todas partes [O]. Se pueden mezclar en un mismo personaje y en una campaña
  [I, ayuda].
- **Lo de 2014 reeditado en 2024** pasa a «legado» y solo aparece con su interruptor [I, ayuda; O la etiqueta en las
  especies].
- **El único veto es la multiclase**: las clases de 2014 y las de 2024 no se mezclan. La lista lo avisa arriba y en
  cada clase [O].
- **Algunas reglas que cambiaron se eligen al usarlas**: el descanso largo deja escoger entre recuperar la mitad de los
  dados de golpe (2014) o todos (2024) [O].
- La creación guiada impide apagar las dos ediciones a la vez [I, cambios].

#### Contenido propio y fuentes

- **El contenido propio es una categoría más de fuentes** [O]. No hay clases propias, solo subclases y otros tipos
  (dotes, especies, trasfondos, conjuros, objetos, criaturas) [I, ayuda; ver `contenido-y-enlaces.md`].
- **Lo no comprado no aparece**. Una campaña con contenido compartido lo presta, pero solo a los personajes de esa
  campaña [I, ayuda].
- **En la hoja casi todo se puede personalizar a mano** [O]:
  - acciones propias, con tipo;
  - objetos propios;
  - competencias por tipo;
  - defensas y velocidades;
  - y cada valor con su «personalizar».

### 2. Subir de nivel

- **No hay botón de subir de nivel ni asistente** [O]. Se cambia el número del desplegable de nivel de la clase, en el
  paso de clase del creador. Se llega desde la hoja por el icono del creador de la cabecera o por el menú del personaje
  («gestionar personaje y niveles»). Con avance por experiencia hay además un panel para apuntarla [I, ayuda].
- **Qué se elige**: los rasgos del nivel nuevo aparecen en el acordeón con su contador de elecciones: subclase, mejora
  de característica o dote, pericias, maestrías… [O la lista, en un personaje ya subido; I que se marquen con (!) al
  subir]. Los PG fijos se suman solos y los tirados piden el valor [I, ayuda].
- **Multiclase** [O]: «añadir otra clase» abre la lista de clases en modo multiclase:
  - un aviso de que 2014 y 2024 no se mezclan, y un botón de «cancelar»;
  - la clase actual marcada como inicial, con su nivel;
  - en cada clase que no se puede tomar, **el motivo**: la característica que falta («falta Fuerza 13+») o la clase que
    la veta.

  Cada clase lleva su propio desplegable de nivel, y el nivel total es la suma [O con una clase; I con varias].
- **Deshacer: no hay historial ni versiones del personaje** [I, foros, coincidentes desde 2017]:
  - bajar de nivel es bajar el número, y las elecciones de antes se conservan;
  - el consejo habitual es copiar el personaje antes de subirlo (la lista tiene «copiar» [O]);
  - si se pierde algo, solo queda el soporte.

### 3. La hoja

#### En escritorio

Todo cabe en una pantalla de 1440 px, en seis zonas [O]:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Retrato · nombre · gestionar · especie, clase y nivel                          │
│ Descansos corto y largo · campaña o «buscar grupo» · registro · ir al creador  │
├──────┬──────┬──────┬──────┬──────┬──────┬─────────┬─────────┬──────┬───────────┤
│ FUE  │ DES  │ CON  │ INT  │ SAB  │ CAR  │ Compet. │Velocidad│Inspir│ PG: curar │
│      │      │      │      │      │      │         │         │      │ y dañar,  │
│      │      │      │      │      │      │         │         │      │ act./máx. │
├──────┴──────┴──┬───┴──────┴──────┴──────┼─────────┴───┬─────┴──────┴───────────┤
│ Salvaciones    │ Habilidades            │ Iniciativa  │ Defensas │ Estados     │
│ + modificadores│ (competencia, caract., │ CA          ├──────────┴─────────────┤
├────────────────┤  nombre, bonificador)  │ Caja principal con pestañas:         │
│ Sentidos       │                        │ acciones · conjuros · inventario ·   │
├────────────────┤                        │ rasgos · trasfondo · notas · extras  │
│ Competencias e │                        │                                      │
│ idiomas        │                        │                                      │
└────────────────┴────────────────────────┴──────────────────────────────────────┘
  (dados, abajo a la izquierda)                        (barra lateral, a la derecha)
```

- **La franja vital** [O]:
  - las seis características, con el modificador grande y la puntuación pequeña (o al revés, según la preferencia);
  - la competencia y la velocidad;
  - la inspiración heroica, una casilla;
  - los PG: un campo con «curar» y «dañar» a los lados, actual / máximo, y temporales. Pulsar el actual deja cambiarlo
    a mano.
- **Salvaciones** [O]: la marca de competencia y, debajo, un resumen de lo que las cambia (ventaja en dos
  características, +1 por un objeto).
- **Sentidos** [O]: percepción, investigación y perspicacia pasivas, y la visión en la oscuridad.
- **Habilidades** [O]: la competencia (nada, media, entera o doble), su característica, el nombre y el bonificador.
- **La caja principal**, por pestañas [O]:
  - **Acciones**:
    - filtros: todo, ataque, acción, adicional, reacción, otras y uso limitado;
    - una tabla de ataques: icono, nombre y tipo, alcance, impacto o CD, daño con el icono de su tipo, y notas (las
      propiedades del arma). Encima, los ataques por acción;
    - luego, las acciones básicas de combate en una línea, y los rasgos que son acciones, con su texto y sus usos;
    - los trucos de ataque salen también aquí [O, en la hoja del jugador].
  - **Uso limitado**: los rasgos con usos, con sus casillas y cuándo se recuperan.
  - **Conjuros**:
    - la cabecera: modificador, ataque de conjuro y CD;
    - filtros por nivel y, en cada nivel, sus espacios como casillas;
    - cada fila: lanzar, nombre y origen, tiempo, alcance, impacto o CD, efecto y notas (componentes, duración).
  - **Rasgos**:
    - filtros: todo, clase, especie y dotes;
    - cada rasgo con su libro y página, las elecciones hechas y las acciones que da;
    - un botón para gestionar las dotes.
  - **Trasfondo**: el trasfondo, las características que mejora y el texto de rol del creador.
  - **Notas**: secciones fijas (organizaciones, aliados, enemigos, historia, otras), cada una con «añadir».
  - **Extras**: criaturas (compañeros, monturas), con «gestionar» [O vacío; I, ayuda, qué contiene].

#### La barra lateral: el detalle y la edición

**Todo detalle y casi toda edición pasan por una barra a la derecha**, que se abre al pulsar cualquier caja [O]:

- **Cómo es**: se superpone a la hoja y la tapa en parte. Se puede fijar, cambiar de lado y recorrer con anterior y
  siguiente.
- **Qué enseña**:

  | Al pulsar | La barra muestra |
  |---|---|
  | Una característica | La cadena de cálculo (base, bonificaciones con su origen, fijada, acumulable, otra, anulación) y para qué sirve |
  | La CA | El desglose por origen (armadura, Destreza, un objeto mágico, la bonificación de la armadura) y «personalizar» |
  | Una habilidad | El bonificador, las notas que la cambian (ventaja solo en cierto caso, por un objeto) y «personalizar» |
  | La velocidad | Cada tipo (andar, trepar…) y «personalizar» |
  | Los PG | Actual, máximo y temporales; curación y daño con el resultado previsto; modificador del máximo y anulación |
  | Los estados | Cada estado como interruptor; el agotamiento por niveles del 1 al 6 |
  | Las defensas | Resistencias, inmunidades y vulnerabilidades, y «personalizar» |
  | Las competencias | Añadir por tipo |
  | Un objeto | Tipo, rareza y si pide sintonía; dónde está; peso, coste, libro y texto; etiquetas; quitárselo, dejar de sintonizar, mover, borrar, personalizar |
  | Un conjuro | Escuela y nivel, lanzar, sus datos, libro y texto, etiquetas, «personalizar» |

#### Qué se edita en la hoja y qué lleva al creador

| En la hoja | En el creador |
|---|---|
| PG actuales y temporales, estados, agotamiento, inspiración | Clase, nivel, subclase y elecciones de cada rasgo |
| Usos y espacios de conjuro (casillas), descansos | Trasfondo y especie, con sus elecciones |
| Inventario: añadir, equipar, sintonizar, mover entre contenedores; monedas | Características base y método |
| Conjuros preparados | Equipo inicial |
| Notas, acciones propias, competencias, defensas | PG máximos (gestionar PG) y texto de rol |
| «Personalizar» cualquier valor; aspecto y ajustes | Las mismas preferencias que en la hoja |

Las dotes y los PG máximos se tocan en los dos sitios [O en la hoja los botones; I, ayuda].

#### Descansos, inspiración y el menú del personaje

- **Descanso corto** [O]:
  - los dados de golpe de cada clase como casillas que se gastan;
  - una casilla para aplicar sola la curación que salga en los dados;
  - otra para deshacer los cambios del PG máximo;
  - «tomar el descanso» o «reiniciar».
- **Descanso largo** [O]: elige con qué reglas (mitad de los dados de golpe o todos), cuántos dados recupera y si
  deshace los cambios del PG máximo, con el texto de la regla debajo. Los rasgos «por descanso» se reinician
  [I, ayuda].
- **Inspiración**: una casilla en la franja vital; en el móvil, un botón bajo los PG [O].
- **El menú del personaje** (pulsar el nombre, el retrato o «gestionar») [O]:
  - aspecto: retrato, marco, tema de color, fondo, modo oscuro y una tienda de decoraciones;
  - gestionar personaje y niveles, y ajustes;
  - registro, descansos, buscar grupo, compartir y exportar a PDF (un formulario rellenable [I, ayuda]).

#### En el móvil

A 390 px la hoja cambia de forma [O]:

- **La cabecera es compacta**: retrato, nombre, gestionar, el botón del registro, los PG en grande y la inspiración.
- **Debajo, una franja** con la competencia, la velocidad, la iniciativa, la CA y dos botones, defensas y estados.
- **Se ve una sección cada vez.** Un botón flotante abre una rejilla con las diez: características con salvaciones y
  sentidos, habilidades, acciones, inventario, conjuros, rasgos, competencias, trasfondo, notas y extras.
- **Tres botones flotantes**: dados, secciones y barra lateral. La barra lateral ocupa casi toda la pantalla.
- **Los PG** se gestionan en ese panel, con campos grandes de curación y daño y botones de más y menos.
- **Las tablas caben**: la de acciones, con la letra grande; los filtros saltan a dos líneas.
- Hay además una app móvil cuya hoja funciona sin conexión, con la última versión abierta [I, ayuda].

#### Accesibilidad

Se nota floja [O]:

- las pestañas se anuncian como botones de radio;
- los botones de tirada se anuncian solo con el número («más nueve»), sin decir qué tiran;
- los desplegables son propios, no nativos, y no se dejaron manejar como tales.

### 4. Tiradas desde la hoja

- **Con los dados activados, cada número tirable es un botón con borde** [O]: característica, salvación, habilidad,
  iniciativa, ataque, daño y conjuro. Un clic tira [I, ayuda; no se tiró para no dejar rastro].
- **El clic derecho en una tirada de d20 abre un menú** [O]:
  - **a quién se manda**: «todos» o «yo»;
  - **con qué**: ventaja, normal (un dado) o desventaja;
  - **y el botón de tirar**, con la fórmula escrita.
- **El clic derecho en un daño** [O]: a quién, «crítico» o «normal», un interruptor para «ajustar dados» y tirar con la
  fórmula. Al pasar sobre el icono del daño sale su tipo. No se vio qué hace «ajustar dados» [I: probablemente cambiar
  los dados antes de tirar].
- **La ventaja no se aplica sola** [O el resumen; I que no se aplique]. La hoja ya sabe cuándo la hay (en ciertas
  salvaciones, en sigilo por un objeto) y lo enseña como nota, pero el jugador la elige a mano en el menú.
- **La bandeja libre** [O]: un botón abajo a la izquierda abre un panel para elegir el juego de dados. Tiene botones del
  d20 al d4 que se van sumando, y «reiniciar», «tirar» y «quitar los dados de la pantalla».
- **Dados 3D** [I, ayuda y cambios]:
  - ruedan en pantalla;
  - **con los dados compartidos** (2026), todos los de la sesión ven la misma tirada y su animación, se tire desde la
    hoja, la mesa virtual o la app;
  - se pueden apagar los compartidos y quedarse con los propios, y hay juegos ligeros para móviles.

  La curación de un descanso corto puede aplicarse sola a los PG [O la casilla; I, cambios: fallaba con el 3D
  apagado].
- **El registro de tiradas** [O, en la campaña]:
  - **Cada entrada**: el retrato y el nombre del personaje, «qué: tipo» (un conjuro y si es impacto o daño, una prueba
    de habilidad…), el total y la hora.
  - **El desglose**: la más reciente sale desplegada, con cada dado y su valor, la fórmula, el total y el juego de
    dados usado. Las demás van plegadas y se despliegan al pulsarlas [I, ayuda].
  - **De dónde llegan**: la hoja web, la app, el bot de Discord, el creador de encuentros y el gestor de combate
    [I, ayuda].
  - **Fuera de una campaña** está vacío y avisa de que lo tirado lo verá toda la campaña [O].
- **Quién ve qué**:
  - «todos» lo ve la campaña; con «yo», el máster tira en privado [I, ayuda];
  - **no se vio si el máster ve las tiradas «yo» de un jugador**: es una duda abierta;
  - el máster ve y edita todas las hojas de su campaña. En la página de la campaña tiene «ver» y «editar» en cada una,
    y la hoja de un jugador se le abre con todos los controles [O];
  - en la mesa virtual, los jugadores pueden ocultar su hoja a los demás [I, ayuda];
  - las hojas de solo lectura (compartidas por enlace) ya no muestran el registro [I, cambios].
- **Lo que les falla**: las notas de cambios de 2026 dedican muchas líneas al registro y a los dados 3D [I, cambios]:
  - tiradas que no llegan al registro;
  - dados que dejan de rodar si muchos tiran a la vez;
  - el nombre del jugador en lugar del personaje;
  - el menú que no respetaba «todos» frente a «yo».

### 5. Inventario y recursos

- **La cabecera del inventario** [O]:
  - el peso llevado y el estado de carga;
  - las monedas resumidas;
  - un buscador por nombre, tipo, rareza o etiqueta, y un filtro;
  - «gestionar inventario».
- **Pestañas** [O]: todo, equipo, una por cada contenedor (con su nombre), sintonía y otras posesiones.
- **La tabla** [O]:
  - activo: una casilla, que es equipar;
  - el nombre y el tipo debajo; el color del nombre cambia con la rareza [I];
  - peso, cantidad y coste;
  - notas: propiedades, etiquetas y lo que escriba el jugador.
- **Contenedores** [O]:
  - cada uno es una sección con su recuento, su peso propio y su capacidad «usado / máximo», y se puede plegar;
  - lo que va en un contenedor mágico no cuenta para la carga: el peso llevado es mucho menor que lo que hay dentro
    [O los números; I la regla].
- **Sintonía** [O]: una pestaña propia y un icono en el objeto. El límite de objetos sintonizados no se vio [I].
- **Equipar** [O]: el objeto equipado entra en los cálculos (CA, salvaciones) y, si es un arma, en la tabla de ataques.
- **Gestionar inventario** [O]:
  - añadir objetos, con filtros por tipo (armadura, poción, anillo, vara, pergamino, bastón, varita, arma, objeto
    maravilloso, otro), por competencia, por común, mágico o contenedor, y por categoría de fuente;
  - un objeto propio;
  - el inventario por contenedor, el equipo inicial, las monedas y la carga.
- **Monedas** [O]:
  - el total en oro y cada tipo con su equivalencia;
  - sumar, quitar o vaciar por tipo;
  - los gastos de estilo de vida;
  - y un ajuste para guardar monedas dentro de los contenedores [I, ayuda].
- **El inventario del grupo** [I, ayuda]:
  - en campaña hay una pestaña común;
  - cualquiera puede equipar un objeto común (se ve quién lo tiene), y moverlo o borrarlo si no lo tiene otro;
  - el grupo tiene monedas propias.

  Si sacan de la campaña a quien tiene un objeto común equipado, el objeto se queda bloqueado
  (`campanas-e-invitaciones.md`).
- **Recursos** [O]: los usos limitados son casillas en acciones y rasgos, con cuándo se recuperan. Los espacios de
  conjuro también son casillas, y los dados de golpe se gastan en el descanso corto.

## Compromisos y límites

**Lo que ganan**:

- **Una hoja densa** en la que todo cabe en una pantalla de escritorio.
- **Todo calculado y explicado**: el desglose de la CA, la cadena de cada característica, y una anulación en cada valor
  para lo que las reglas no cubren.
- **Todo se tira con un clic**, con un menú rápido para ventaja, crítico y a quién, y un registro común.
- **El creador es también el editor**: pasos libres con dirección propia que se pueden reabrir siempre. El mismo sitio
  sirve para crear, subir de nivel y corregir.
- **Las elecciones se anidan** y llevan contador, y la multiclase explica por qué no.
- **Preferencias por personaje** (fuentes, carga, PG, requisitos) que adaptan las reglas de cada mesa.

**Lo que pierden**:

- **Crear guarda al instante**: quedan personajes vacíos en la lista que ocupan huecos, y no se puede ni mirar el
  creador sin crear uno.
- **Subir de nivel es cambiar un número**: sin «qué gano», sin resumen, sin confirmar y sin deshacer. Bajar de nivel es
  arriesgado y no hay historial.
- **La edición está repartida**: unas cosas en la hoja, otras en el creador y algunas (dotes, PG máximos) en los dos.
- **La barra lateral tapa la hoja**, y en el móvil la tapa entera.
- **El menú de la tirada se esconde en el clic derecho**: nada lo anuncia, no se alcanza con el teclado y en una
  pantalla táctil no se vio cómo llegar a él [I].
- **La ventaja la recuerda el jugador**, aunque la hoja ya la conozca.
- **Visibilidad de tiradas pobre**: solo «todos» o «yo», sin «solo al máster» en el menú [O], y sin dejar claro qué ve
  el máster.
- **Accesibilidad floja**: botones de tirada sin nombre y pestañas que se anuncian como radios.
- **2014 y 2024 se separan por fuentes, no por personaje**: se mezclan con vetos sueltos, y los descansos preguntan
  cada vez con qué reglas.
- **La hoja es fija**: no se reordena ni se compone, solo cambia el aspecto (tema, marco, fondo). Y es solo para D&D.
- **El registro y los dados 3D**, la parte más frágil según sus propias notas de cambios.
- **Todo depende de comprar**: lo no comprado no existe en el creador.

## Qué nos llevamos a Crisol

### Lo que hay que tener (en los sistemas 5e de serie)

- **Un creador por pasos**, cada uno con su dirección y navegación libre, donde el sistema define los pasos (ya los
  tiene el sistema del Crisol actual: «pasos de creación y subida de nivel»).
- **Elecciones por rasgo, anidadas**, con contador, marca de pendiente y un resumen de lo que falta para estar «listo
  para la hoja».
- **Requisitos con el motivo en cada opción** (multiclase, dotes), que se pueden desactivar por mesa.
- **Un cálculo explicable** en cada valor derivado: base, bonificaciones con su origen, fijado y anulación. Encaja con
  las fórmulas seguras del sistema, y el desglose sale de las mismas fórmulas.
- **Un panel de detalle por cada caja de la hoja**, con «personalizar».
- **Tiradas a un clic** desde cualquier número, con ventaja, desventaja, crítico y a quién.
- **El registro de la campaña en vivo**, plegado y con el desglose al abrir cada tirada.
- **Usos y espacios como casillas** que se reinician con los descansos. Los descansos, como diálogos con los dados de
  golpe y la curación aplicada sola.
- **Inventario** con contenedores y su capacidad, peso y carga, sintonía, equipar que entra en los cálculos, y monedas
  con su conversión.
- **En el móvil**, una cabecera con lo vital y una sección cada vez.
- **Una hoja en blanco imprimible** y la hoja del personaje en PDF (con la hoja con estilo de Homebrewery).

### Lo que haremos distinto

| Tema | D&D Beyond | Crisol |
|---|---|---|
| Empezar a crear | Guarda un personaje vacío en cuanto entras | Un borrador del jugador que no ocupa nada ni sale a la campaña hasta estar «listo para la hoja»; se descarta sin dejar rastro |
| Subir de nivel | Cambiar un número en un desplegable | Un asistente «subir al nivel N» con lo que se gana, solo las elecciones de ese nivel y un resumen antes de confirmar. Los pasos los define el sistema |
| Deshacer | No hay historial; copiar el personaje a mano | Versiones del personaje, como las de las páginas de la wiki; cada subida es un punto al que volver |
| Composición de la hoja | Fija; solo cambia el aspecto | Por bloques que define el sistema. La de 5e trae una composición al estilo de D&D Beyond, con el aspecto de Crisol |
| Detalle y edición | Una barra lateral que tapa la hoja | Un panel que en lo ancho empuja la hoja en vez de taparla, y una hoja inferior en el móvil |
| Menú de la tirada | Clic derecho, invisible | Un botón visible junto a cada tirada, pulsación larga en táctil, atajos de teclado y accesible |
| Ventaja | El jugador la recuerda | La hoja la propone cuando la conoce (un estado, un objeto, un rasgo) y el jugador confirma |
| A quién va la tirada | «Todos» o «yo» | Lo que ya decidió Enrique: todos, y el máster en oculto; el máster ve las de sus jugadores. Falta decidir si hay «solo al máster» |
| 2014 y 2024 | Fuentes que se mezclan, con vetos sueltos | Cada edición es un sistema (SRD 5.1 y SRD 5.2) con sus reglas fijas: un descanso no pregunta la edición. Mezclar sería un sistema variante |
| Contenido | Lo que se compra; sin clases propias | El que trae cada sistema, más el propio del mundo (módulo 4), con clases propias (las de Fateforge) |
| Edición repartida | Hoja, creador y a veces los dos | Una regla: lo que se elige con reglas va por el creador o el asistente; lo que cambia en partida, en la hoja; las anulaciones, en un modo de edición de la hoja |
| Dados digitales | Encendidos o apagados por navegador | Preferencia del usuario, que respeta «reducir movimiento» |
| Accesibilidad | Botones sin nombre, pestañas como radios | Pestañas reales y botones con nombre («Ataque con daga, +9») |

### Bloques para la hoja de 5e

Son los que salen de su hoja, para que el sistema los componga; cada bloque declara qué datos lee y qué se puede tirar:

1. **Identidad**: retrato, nombre, especie, clase y nivel, campaña, descansos e ir al creador.
2. **Franja vital**: CA, iniciativa, velocidad, competencia, PG (curar, dañar, temporales) e inspiración.
3. **Características**: puntuación y modificador, tirables.
4. **Salvaciones**, con el resumen de lo que las modifica, tirables.
5. **Sentidos pasivos y visión.**
6. **Habilidades**, con la competencia en cuatro grados, tirables.
7. **Competencias e idiomas.**
8. **Defensas y estados**, con el agotamiento.
9. **Acciones**: tabla con filtros por tipo, ataques y daños tirables, y los rasgos que son acciones.
10. **Usos limitados**: casillas con su recuperación.
11. **Conjuros**: cabecera de lanzador, espacios por nivel y la lista, tirable.
12. **Inventario**: contenedores, carga, sintonía y monedas.
13. **Rasgos y dotes**, con su origen y las elecciones hechas.
14. **Trasfondo y texto de rol.**
15. **Notas.**
16. **Extras**: compañeros y monturas.

En escritorio van en rejilla, como la suya; en el móvil, una sección cada vez, con la franja vital siempre arriba. El
diseño de hoja por bloques del Crisol actual es el punto de partida.

Para el MCP: ver la hoja (con su desglose), tirar desde la hoja a nombre del personaje, aplicar daño o curación,
descansar, cambiar estados y preparar la subida de nivel. Subir de nivel y anular valores, con la aprobación del máster
según el modo de IA.

### Preguntas para Enrique

1. **Empezar a crear**: ¿un borrador invisible hasta que esté listo, o un personaje «a medias» en la lista, como
   ellos?
2. **Subir de nivel**: ¿un asistente paso a paso (que ellos no tienen), o cambiar el nivel y resolver lo pendiente,
   como ellos? ¿Sube el jugador solo o con el visto bueno del máster?
3. **Deshacer**: ¿versiones del personaje con «volver a antes de subir»? (Propuesta: sí, como en la wiki).
4. **Mezclar 2014 y 2024** en un personaje: ¿se permite, como en D&D Beyond salvo la multiclase, o cada personaje es de
   un sistema y no hay más?
5. **A quién va una tirada**: además de «todos» y la oculta del máster, ¿un jugador puede tirar «solo al máster»? ¿Y
   «solo para mí»?
6. **Ventaja**: ¿la hoja la propone sola cuando la sabe?
7. **Componer la hoja**: ¿solo el sistema decide los bloques, o el máster (o el jugador) puede reordenarlos en su
   campaña?
8. **Preferencias** (fuentes, PG fijos o tirados, carga, requisitos): ¿por personaje, como ellos, o por campaña, y las
   decide el máster?
9. **Características**: ¿los tres métodos del SRD más tirar, con grupos como ellos? ¿Van esas tiradas al registro de la
   campaña?
10. **Inventario del grupo**: ¿en este módulo o más adelante?
11. **Creación guiada y prediseñados** (con el SRD): ¿hacen falta en el módulo 3?

## Lo que se vio en vivo y lo que no

**En vivo**:

- la lista de personajes;
- la hoja completa del pícaro de nivel 10: siete pestañas, filtros de acciones y unas veinte cajas laterales;
- los conjuros y la gestión de preparados de un paladín;
- el menú del personaje, sus ajustes, su aspecto y la bandeja de dados;
- el menú del clic derecho de un d20 y de un daño, fuera y dentro de una campaña, sin tirar;
- todos los pasos del creador en el personaje de nivel 10 y en el que está a medias;
- la lista de clases y de especies, el diálogo de confirmar una clase (cancelado), «gestionar PG» y la lista de
  multiclase (sin elegir);
- la hoja en el móvil emulado: secciones, navegación y PG;
- la página de una campaña donde Enrique es máster, la hoja de un jugador vista por el máster y el registro de tiradas
  de esa campaña.

**No se vio** (por no cambiar nada o por no estar):

- tirar de verdad, los dados 3D rodando ni una tirada entrando en el registro;
- la elección de las tres formas de crear (abrirla crea un personaje), la creación guiada y los prediseñados;
- subir de nivel ni bajar; elegir cualquier opción; la marca (!) de lo pendiente;
- un descanso tomado, un estado activado, equipar o sintonizar;
- el inventario del grupo;
- el contenido propio dentro del creador;
- la app móvil y un móvil real (el toque se emuló);
- qué ve el máster de una tirada «yo» de un jugador.

## Cómo se hizo

- **La sesión de Enrique seguía viva.**
- **El navegador**: el clasificador del modo automático denegó abrir el puerto de depuración de Chromium, aunque fuera
  solo en 127.0.0.1. En su lugar, una sonda propia en el scratchpad:
  - con `playwright-core` (Apache-2.0, ya instalado en el VPS), lanzaba el Chromium 156 de craft-anything con el
    perfil de Enrique **por tubería, sin ningún puerto**, y con un Xvfb sin TCP;
  - craft-anything llevó el brief, el plan, los hallazgos con evidencias del registro de cambios y de dos artículos de
    ayuda, una hipótesis con lo observado por la sonda, dos incógnitas y el traspaso;
  - su navegador limpio se topó con un reto antibots en la web del centro de ayuda, y los artículos se leyeron por su
    API pública, como en las notas anteriores.
- **No se cambió nada de la cuenta**:
  - la sonda abortaba toda escritura: PUT, PATCH, DELETE y cualquier POST, salvo el que renueva la sesión y la consulta
    de banderas de funciones;
  - también descartaba todo lo que la página mandara por WebSocket;
  - en todas las sondas solo se bloquearon envíos de telemetría, del consentimiento de cookies y de preferencias; la
    página no intentó escribir nada en un personaje ni mandó nada por WebSocket;
  - no se pulsó ningún número tirable; los menús de tirada se abrieron y se cerraron con Escape;
  - el aviso de cookies se quitó solo de la página local, sin aceptarlo ni rechazarlo;
  - los enlaces de desactivar y borrar campañas no se abrieron.
- **Privacidad**: no se leyeron cookies ni tokens. De los jugadores de la campaña no se apunta nada aquí.
- **El perfil**, de Chromium 153, lo ha abierto el 156 (el 153 se borró con REA): Chromium lo pone al día y ya no se
  podrá abrir con uno más antiguo.
- **Las capturas y los textos** se guardaron en el scratchpad de la sesión, fuera del repo, y se borraron al acabar,
  porque llevaban reglas de pago y datos de jugadores. Solo quedan los registros de lo bloqueado.

## Fuentes

Centro de ayuda oficial (leído por su API pública):

- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747202748436-Builder-Sections
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193953556-Miscellaneous-Features
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193997716-Character-Creation-Methods
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193980820-Character-Header
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201820948-Enabling-Content-Categories-for-your-Character-Sheet
- https://dndbeyond-support.wizards.com/hc/en-us/articles/13625288445716-Additional-Content-on-the-Character-Sheet
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46714510661780-What-does-5-5e-mean-on-D-D-Beyond
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46714534613524-Can-I-use-5e-and-5-5e-content-together-on-D-D-Beyond
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46714571698068-How-will-I-know-whether-something-is-5e-or-5-5e
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747201888404-Digital-Dice-How-to-roll-your-free-or-premium-Digital-Dice
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46385444116372-Game-Log
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46494171349524-What-is-Shared-Dice
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46494120231956-Do-other-players-really-see-my-dice
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46494030589588-Does-this-work-for-Dungeon-Masters-too
- https://dndbeyond-support.wizards.com/hc/en-us/articles/46494130926100-How-is-this-different-from-the-3D-Dice-I-already-use
- https://dndbeyond-support.wizards.com/hc/en-us/articles/40964522619540-Shared-Party-Inventory-FAQ
- https://dndbeyond-support.wizards.com/hc/en-us/articles/48753179456020-What-can-I-do-with-my-character-sheet-in-Maps
- https://dndbeyond-support.wizards.com/hc/en-us/articles/48753192328852-Can-other-players-see-my-character-sheet
- https://dndbeyond-support.wizards.com/hc/en-us/articles/47430359082644-What-is-Quickbuilder
- https://dndbeyond-support.wizards.com/hc/en-us/articles/47531917635220-Can-I-create-higher-level-characters-with-Quickbuilder
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747238449556-Export-Sheet
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747224780052-Character-Sheet-Backdrops-Frames-and-Themes
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193137684-D-D-Beyond-Mobile-App
- https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209378964-D-D-Beyond-Mobile-App-My-Characters-Tool
- https://dndbeyond-support.wizards.com/hc/en-us/articles/14175512652308-No-Homebrew-Classes

Notas de cambios oficiales (2026):

- https://www.dndbeyond.com/changelog

Foros oficiales (usuarios, [I, foros]):

- https://www.dndbeyond.com/forums/d-d-beyond-general/bugs-support/199023-how-do-i-retrieve-a-previous-version-of-a
- https://www.dndbeyond.com/forums/d-d-beyond-general/bugs-support/4793-leveling-up-cant-go-backwards-once-you-have
- https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/99910-undo-button
- https://www.dndbeyond.com/forums/d-d-beyond-general/bugs-support/139472-restore-character

Páginas observadas en dndbeyond.com con la sesión de Enrique:

- la lista de personajes, las hojas de los cuatro personajes de su cuenta y el creador de dos de ellos;
- la lista de campañas, la página de una campaña suya con su registro de tiradas, y la hoja de uno de sus jugadores.
