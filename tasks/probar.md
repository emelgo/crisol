# Lo que tiene que probar Enrique

Lista viva: todo lo que haya que probar se apunta aquí y se marca cuando lo pruebe. Lo que diga va a «Lo que dijo» (al
final) y de ahí a su arreglo, o a `docs/diseno.md` si es una norma de la interfaz.

- **Staging**: https://neo.crisol.144-91-122-245.sslip.io, con el módulo 2, los arreglos del 2026-11-04, los dados,
  los sistemas, srd-5e entero, los personajes y su hoja (PR #93 a #103).
- **La IA**: el conector «Neo Crisol» de claude.ai (`https://neo.crisol.144-91-122-245.sslip.io/mcp`), con la cuenta
  de propietario.
- **En local**, con los cambios al momento: http://localhost:5173 (lo arranco cuando haga falta).

## Módulo 3: personajes (en staging: PR #100)

En una campaña con el 5e (en sus ajustes, «5e» y sus ediciones):
- [ ] **La campaña en su vista**: al entrar en ella, la barra cambia (su nombre, Personajes, Compendio, Dados); la
  llama vuelve a Mis mundos.
- [ ] **El compendio**: buscar en español o en inglés («fireball»), filtrar por tipo, leer un conjuro, una criatura y
  una clase (con lo que concede por nivel); «2014 · Legado» lleva a la otra versión. Una jugadora también lo ve.
- [ ] **Personajes**: «Personaje nuevo» (el máster elige quién lo juega); su tarjeta y su vista previa; su ventana
  (nombre, quién lo juega, borrar).
- [ ] **El creador**: elegir clase, especie y trasfondo; lo que falta sale con (!) en los pasos y a la derecha; elegir
  en el panel (las habilidades, el estilo de combate; la mejora de característica a nivel 4 y los aumentos de un
  trasfondo de 2024, con «−» y «+»); las características con sus cuatro métodos (los 4d6, en el registro de dados);
  «Terminar».
- [ ] **Subir de nivel y multiclase**: cambiar el nivel de la clase, «Añadir otra» (la que no se puede, con su
  motivo: «Necesitas Inteligencia 13»), «Confirmar el nivel N».
- [ ] **La ficha y sus versiones**: «Creado · Nivel 1» y cada nivel confirmado; «Restaurar» (se deshace desde el
  historial).
- [ ] **Lo que ve cada uno**: una jugadora ve solo los suyos; el máster, todos.
- [ ] **Las tablas aleatorias**: en una página, «+» → «Tabla»; sus filas (lo que se pisa o deja huecos, avisado), «Sin
  reemplazo», tirar en una campaña (la fila sale marcada «Ahora» y la tirada, en el registro de dados), «Reiniciar».
- [ ] **Desde claude.ai**: que la IA haga un personaje con `crear_personaje` y `elegir_personaje`, y lo suba de nivel;
  que haga una tabla y tire en ella (`tirar_en_tabla`).

## Módulo 3: la hoja en partida

En un personaje terminado, su «Ficha»:
- [ ] **Tirar a un clic**: una característica, una habilidad, la iniciativa y el ataque de un arma; arriba, «Con
  ventaja» o «Con desventaja» y quién la ve (la tirada sale en el registro de dados con su nombre: «Thora · Atletismo»).
- [ ] **Los PG**: «Cuánto» y «Daño» (primero se van los temporales), «Curar», «Temporales»; varios clics seguidos se
  suman.
- [ ] **Lo que se cambia jugando**: la inspiración, el cansancio, las salvaciones contra muerte, las monedas y las
  notas; tras recargar, sigue ahí.
- [ ] **Lo que lleva**: en «Inventario», «Añadir» del compendio, «Equipado» (un escudo sube la CA), cantidad y
  quitar; los estados (Envenenado…) arriba, con su «Añadir».
- [ ] **Usos y descansos**: gastar una Furia; «Descanso corto» (un brujo recupera la magia de pacto; los PG no) y
  «Descanso largo» (todo lleno).
- [ ] **Con el teclado**: las pestañas con las flechas, Inicio y Fin.
- [ ] **Desde claude.ai**: `partida_personaje` (daño, curación, gastar un uso, descansar) y `tirar_por_personaje`.

## Módulo 3: el pulido (PR #104)

- [ ] **Los tutoriales guiados** de la campaña, Personajes, un personaje, el Compendio y la pestaña Tabla: salen la
  primera vez y, para verlos otra vez, su botón de ayuda («Tutorial guiado de esta vista»).
- [ ] **Sin personajes**, la pantalla vacía con su botón grande.
- [ ] **«Reiniciar» una tabla** pregunta antes; lo que sale al tirar se anuncia.

## Módulo 3: los dados para otros juegos

- [ ] **Un Daggerheart hecho por la IA**: pídele en claude.ai que te haga un sistema de Daggerheart para una campaña
  (sus dos d12 de Esperanza y Miedo, la ventaja de +1d6, el daño con tantos dados como su competencia). Después,
  un personaje en esa campaña y tirar desde su hoja: el resultado dice «con Esperanza» o «con Miedo», los dobles son
  crítico, y «Con ventaja» suma 1d6.

## Módulo 3: srd-5e, punto de control 4 y final (todo el contenido, en staging: PR #98)

Todo el contenido de los dos SRD ya está sacado: 3170 documentos (estados, texto de las reglas, conjuros, objetos
mágicos, criaturas, especies, trasfondos, dotes y las 12 clases con su subclase), en los dos idiomas y con su página.

- [ ] **Una muestra al azar contra el PDF**: `tasks/muestra-srd-5e.md` lleva unos 20 de cada tipo (263), con su
  página en cada PDF y lo primero de su texto. Abrir el PDF en esa página y mirar que el nombre, los números y el texto
  cuadran en los dos idiomas; lo que esté mal, apuntarlo al lado. Los PDF, en `datos-locales/srd/`.
- Lo sabido, para no buscarlo: en el texto de las reglas, algún recuadro cae en la sección de al lado en un idioma (el
  PDF los coloca en otra página); las tablas grandes de armas y armaduras no van en el texto (ya son contenido).
- [ ] **Desde claude.ai, en un chat nuevo** (ya en staging): «búscame la bola de fuego del 5e y léemela», «¿qué hace el
  estado de apresado?», «hazme un bárbaro de nivel 5 y dime su CA en furia», «léeme el perfil del aboleth». Y los
  criterios de éxito de `docs/specs/srd-5e.md`.

## Módulo 3: srd-5e (fases 1 y 2, en staging: PR #97)

El 5e de serie con su contenido de las dos ediciones (de momento, todo el equipo y el guerrero con el campeón: 474
documentos). Spec: `docs/specs/srd-5e.md`.

- [ ] **Punto de control 2, en staging o en local**:
  - en «Sistemas», «De serie»: el **5e** el primero, con sus tipos, sus campos en los dos idiomas, sus tiradas, sus dos
    fuentes con su atribución y sus ajustes (reglas generales, multiclase mixta);
  - en la ventana de una campaña, elegir el **5e**: sus dos ediciones, «Lo que está en las dos» (solo con las dos
    activas), las reglas generales 2024/2014, «Así se ve al elegir» con cosas de verdad (lo de 2014, «Legado», si se
    ven las dos versiones), la atribución; sin ninguna edición avisa y no guarda.
- [ ] **Punto de control 2, desde claude.ai** (en un chat nuevo, para que salgan las herramientas nuevas): pedirle a la IA que busque en el contenido del
  5e (`buscar_contenido`, también con la campaña), que lea la cota de malla y la espada larga (`leer_contenido`) y que
  pruebe un guerrero de nivel 5 con ellas (`probar_formula`, `probar_tirada`, `probar_accion`): CA 16, PG 44, un ataque
  de +6 y Tomar aliento de 1d10 + 5. Después, que haga un sistema propio con contenido con su mecánica
  (`guardar_contenido`) y que lo pruebe.

## Módulo 3: sistemas (en staging)

Ya en staging (PR #96): todo se puede probar allí. Spec: `docs/specs/sistemas.md`.

- [ ] **Punto de control 3** (sin editor desde el 2026-11-05: los sistemas se hacen con la IA):
  - «Sistemas» en la barra de Mis mundos (y en el menú de la llama del móvil), con «5e» y «En blanco» de serie;
  - «Sistema nuevo» dice que se hacen con la IA; sube un archivo (uno roto dice qué falla, por sus nombres y con la
    ruta debajo, y no sube nada; el bueno sale en los tuyos) y baja uno vacío;
  - cada sistema abre su ventana: bajarlo y en qué campañas está; si es tuyo, también cambiarle el nombre y borrarlo
    (solo si ninguna campaña lo usa);
  - en la ventana de una campaña (y al crearla), elegir su sistema; con uno que tenga fuentes, idiomas o ajustes, sus
    opciones; y la ficha de dados de esa campaña empieza por su tirada por defecto.
- [ ] **Final, desde claude.ai** (con el conector «Neo Crisol»): pedirle a la IA un sistema
  de 2d6 + atributo. Debe leer el formato (`formato_sistemas`), crearlo, validarlo y probar una fórmula y una tirada;
  sale en «Sistemas». Después, que le cambie una tirada (por rutas) y que lo elija en una campaña. En modo asistente,
  crear y cambiar esperan tu aprobación, con el nombre del sistema en la cola; borrarlo, también.

## Módulo 3: dados (en staging)

Ya en staging (PR #95): todo se puede probar allí. Spec: `docs/specs/dados.md`.

- [ ] **Punto de control 2**: tú y una jugadora en dos navegadores, con «Dados» en la barra:
  - una tirada tuya «para todos» le llega al momento;
  - una suya «al máster» te llega marcada, y una «para mí» suya te sale como «Para sí»;
  - una «oculta» tuya no le llega;
  - el desglose, «Repetir» y la tirada explicada mientras se escribe;
  - el color de tus dados en el perfil, y la hoja de dados en el móvil (menú de la llama → «Dados»).
- [ ] **Punto de control 3**: los dados 3D: caen con tu color y quedan en lo que dice el registro; los de la jugadora
  caen en tu pantalla con el suyo; en las opciones de la ficha (el engranaje) se apaga «Ver caer los dados de los demás».
- [ ] **Lo de las revisiones** (arreglado; que lo veas tú):
  - «Repetir» en una tirada «al máster» de la jugadora: la tuya sale «oculta», no para todos;
  - `20d6` de golpe: la página no se para mientras caen;
  - pulsar muy seguido una tirada de una página: pasadas 60 en un minuto, dice «Demasiadas tiradas seguidas».
- [ ] **Final**: los criterios de éxito de `docs/specs/dados.md`:
  - tú tiras `1d20+5` y a una jugadora le caen los dados con tu color y le sale en el registro al momento;
  - ella tira «al máster»: tú lo ves marcado; una segunda jugadora no recibe nada; lo tuyo oculto, nadie más;
  - en una página escribes `` `dice: 2d6+3` ``, la pulsas y sale en el registro;
  - desde claude.ai, la IA tira en la campaña (oculta, salvo que le pidas que la vean todos) y lee las últimas;
  - con el teclado: tirar, y el total se anuncia.



Los criterios de éxito de `docs/specs/plantillas.md`, en el orden en que se usan.

### Campos

- [ ] En una página cualquiera, desde el panel: un campo de opciones, un enlace a una sola página y un reloj.
- [ ] Mandar a la papelera una página enlazada desde un campo: el aviso al borrarla cuenta también las páginas que la
  apuntan desde un campo, y el campo la enseña tachada.

### Crear desde plantilla

- [ ] «Página nueva» → «Desde plantilla» → PNJ: sale con sus campos en el panel y sus apartados en el texto. La marca
  junto al título lleva a su plantilla.
- [ ] Desde un enlace `[[…]]` a una página que aún no existe: crearla eligiendo plantilla.
- [ ] **Criterio 1**: ponerle Facción al PNJ, abrir la facción y verlo en «Miembros». Lo mismo con Lugar →
  «Habitantes», y con un Objeto cuyo Portador es el PNJ → «Lleva encima».
- [ ] «⋯» → «Aplicar plantilla…» en una página ya hecha: añade lo que falta sin borrar nada.

### Plantillas propias (Mis mundos → Plantillas)

- [ ] **Criterio 2**, en este orden (Frentes apunta a Frente, así que Frente va primero):
  1. «Frente» desde cero, con Nivel, Estado, un reloj de 8 y Regiones (→ Lugar);
  2. copiar PNJ como «PNJ de Eana» y añadirle Frentes (→ Frente);
  3. en Frente, la tabla «PNJ del frente» (PNJ de Eana · Frentes);
  4. crear un frente y dos PNJ de Eana con él: salen en su tabla.
- [ ] Escribir el texto de una plantilla (sus apartados) y crear una página con ella.
- [ ] **Criterio 3**: quitar un campo de «Frente»; los frentes ya hechos no cambian.
- [ ] Borrar una plantilla propia: sus páginas dicen «(borrada)» junto al título y sus tablas siguen.
- [ ] Las de serie no se cambian: candado y «Copiar».

### Deshacer

- [ ] **Criterio 5**: desde el historial, deshacer crear una página desde plantilla y crear una plantilla.

### La IA, desde claude.ai

- [ ] **Criterio 4**: que cree en pocas llamadas 20 páginas desde plantilla (lugares, facciones y PNJ) enlazadas entre
  sí; después, que lea una facción con `leer_pagina` y reciba sus miembros.
- [ ] Que busque «PNJ cuyo Lugar es …» y que haga una plantilla propia.

### Teclado y móvil

- [ ] **Criterio 7**: elegir plantilla, rellenar campos y configurar una tabla solo con el teclado.
- [ ] Lo mismo en el móvil.

### Ya comprobado (no hace falta probarlo)

- **Criterio 6**: el 95 % de las tablas, en 43 ms con 5.000 páginas (el límite es 150 ms).
- **Criterio 7**, la parte automática: la CI en verde y sin supresiones nuevas; axe sin fallos críticos ni graves.

## Módulo 1: wiki (pendiente desde el 2026-10-30)

- [ ] **Deshacer con versiones** (punto 7 de sus pruebas). Arreglado el 2026-11-04: era el párrafo vacío que el editor
  añadía al abrir una página (punto 6), que dejaba una versión a tu nombre. Probar: que la IA añada algo al final de
  una página, abrirla y deshacer lo de la IA desde el historial.
- [ ] **Lo demás de tus pruebas, arreglado el 2026-11-04** (con la IA desde claude.ai):
  - cambiar un secreto por bloque sin su `^s-id`: conserva su id (1);
  - la fecha de la página cambia al escribir en el texto (2);
  - buscar algo de un secreto dice en qué sección está (3);
  - una nota oculta de una línea, `%%…%%`, vuelve en una línea (4);
  - abrir una página ya no le añade un párrafo vacío al final (6);
  - «Buscar en la página» (Ctrl+Alt+F) mira también dentro de los secretos y de los enlaces (8).
- [ ] **Punto 6**: el PDF de una hoja de dos columnas con statblock, nota lateral y tabla (ningún bloque partido y nada
  de la interfaz en el papel), e «Imprimir» en Chrome, Firefox y Safari.
- [ ] **Final**: los criterios de éxito de `docs/specs/wiki.md` que aún no ha probado:
  - páginas con subpáginas, todos los bloques, propiedades, etiquetas, enlaces, secretos y archivos (1);
  - la IA crea 20 páginas enlazadas y cambia una sección de una página abierta, que se ve sin recargar (3);
  - restaurar una versión anterior (4);
  - exportar el mundo a .zip (6);
  - buscar «dragon» y «dargón» encuentra «Dragón» (7);
  - el árbol, la vista previa y el editor con el teclado, y una página mediana abierta en menos de 1 s (8).

## Por arreglar antes de probarlo

Nada ahora mismo.

## Lo que dijo

(Aquí, lo que diga al probar, con la fecha.)
