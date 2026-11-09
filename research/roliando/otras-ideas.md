# Otras ideas de Roliando (mesa, campaña, importación)

Módulo de Crisol: varios (1, wiki; 5, visibilidad; 6, mesa; campaña alrededor de la Mesa, ADR-0019) · Fecha:
2026-11-10 · Versión estudiada: web pública de roliando.com a fecha de hoy (novedades hasta la 0.1.11)

## Pregunta

Lo que salió al estudiar sistemas y libros (`research/roliando/sistemas-y-libros.md`) y no cabía allí: funciones de
Roliando, fuera del compendio, que puedan aportar algo a Crisol. Mismas fuentes y marcas de certeza que esa nota
([guía], [web], [inferido]); nada de esto se vio por dentro, porque todo pide cuenta.

## Lo que hacen

### Wiki de la campaña («Mundo»)

- Entradas de varios tipos en una sola estantería, enlaces con dobles corchetes (con alias), «nombrada en» como
  enlaces inversos, relaciones que se leen desde los dos lados con tipos de serie y propios, y árbol familiar [guía].
- **Secretos**: un bloque solo para el máster que el servidor separa al guardar y nunca manda a los jugadores; un
  spoiler que llega tapado; en los PNJ, qué ve la mesa (nada, tarjeta, campos o ficha entera) [guía].
- Visibilidad por entrada: todos, solo el máster o elegir equipos o jugadores; lo nuevo nace oculto [guía].
- Grafo editable, línea temporal con reloj del mundo y calendarios, wiki pública con contraseña opcional [guía].
- Importa de Obsidian, LegendKeeper y Notion (entra oculto hasta publicarlo) [guía].

### Sincronía con Obsidian

Un plugin de Obsidian sincroniza **en los dos sentidos** el Mundo, el Diario y los mapas de las campañas que uno dirige,
con un token de solo lectura o de escritura; los conflictos se marcan para compararlos, nunca se borra nada al otro
lado, y los bloques secretos llegan como aviso y vuelven a ser secretos al subir [guía]. También dan un enlace de
calendario para suscribirse a las sesiones [guía].

### Mesa y partida

- Mesa con muros, puertas, luces, plantas, relieve y alturas, clima y hora, zonas de evento (trampas, terreno difícil,
  puertas con acertijo), macros, modo inmersión, puzzles y «apps de mesa» para los jugadores [web, guía].
- Combate 5e automatizado: salvaciones que tira cada jugador, tarjetas por afectado en las áreas, concentración,
  reacciones avisadas, resistencias; reconoce sus límites (criaturas sin reacciones automáticas, algunos conjuros a
  mano) [guía].
- **Daño con tarjeta** (opcional): el golpe deja una tarjeta para aplicar entero, mitad, doble o curar, en vez de restar
  al momento [guía].
- **Presets de ajustes** (novato, avanzado) con «ver qué cambia» antes de aplicar y deshacer; ajustes de la campaña
  con niveles de vista que solo esconden, nunca cambian valores; hasta 40 ajustes propios del máster [guía].
- **Mesas paralelas**: varias mesas a la vez en una campaña, cada una con su máster y sus jugadores [guía].
- Importación de mapas (UVTT, Owlbear, Foundry, TaleSpire, Dungeondraft) y de mundos enteros de Foundry con un
  informe final de lo que entró, lo que no y por qué; las regiones que no se pueden traducir entran desactivadas para
  revisarlas [guía].

## Compromisos y límites

Hacen muchísimo en muy poco tiempo (la interfaz actual tiene días), y la ayuda lo nota: guías que no casan con su
título y funciones que solo se nombran. La amplitud tiene coste en coherencia [guía, inferido].

## Qué nos llevamos a Crisol

1. **Importar con informe**: al traer un mundo, un mapa o un libro, terminar con «qué entró, qué no y por qué», y lo
   dudoso desactivado para revisar. Sirve para el importador de libros y para lo que pase la IA por MCP.
2. **Corrección del máster por campaña** (ver la otra nota) y **daño con tarjeta** como opción de la Mesa.
3. **Presets con vista previa del cambio y deshacer** para los ajustes de la campaña.
4. La sincronía con Obsidian confirma que hay público para ella; Crisol nace del Crisol de Obsidian y podría ofrecer lo
   mismo algún día (fuera del alcance actual).
5. Los secretos que el servidor separa al guardar coinciden con lo que ya hace Crisol en el módulo 5: no hay nada
   nuevo que copiar ahí.

## Con cuenta, 2026-11-10

Visto dentro de la app con la cuenta de prueba (marca **[cuenta]**), al crear y configurar la campaña de prueba.

### Ajustes de la campaña

- **Tres niveles de detalle** (Novato, Estándar, Avanzado) que solo cambian **cuántos ajustes se ven**, no sus
  valores; un aviso dice cuántos más hay en el nivel superior («45 más») con «Ver todos» [cuenta].
- **Buscador de ajustes**, interruptor **«Solo lo cambiado»** con el recuento de cambiados, y un desplegable de grupo
  (Contenido, Combate, Avisos, Mapa, Ambiente, Jugadores, Reglas de la casa, Personajes, La mesa, Dados,
  Automatización, Registro y chat, ajustes propios, tokens, condiciones propias, contenido del sistema, módulos de
  Foundry, «Para ti») [cuenta].
- **Presets** (Novato, Estándar, Avanzado) con una frase de lo que suponen, el puesto marcado y «Ver qué cambia» antes
  de aplicar [cuenta].
- Cada ajuste es un interruptor o un grupo de opciones con **una frase debajo** de qué hace; los dependientes avisan
  «depende de X: ajústalo primero» [cuenta].
- **Ajustes propios del máster** («Tus reglas») que las fórmulas de la hoja pueden leer [cuenta].
- Los cambios se guardan solos y se pueden deshacer unos segundos [cuenta].
- La configuración se reparte en secciones (La mesa, Reglas y ajustes, Convivencia, Animaciones, Identidad del máster,
  Co-másters, Mesas paralelas, Emojis, Avanzado), cada una con un «Siguiente: …» al pie para recorrerlas en orden
  [cuenta].

### Detalles sueltos

- La entrada del compendio se abre en una **ventana flotante** que se minimiza o se ancla, y se puede «Mostrar» a la
  mesa [cuenta].
- Distancias siempre en **doble unidad** (pies / metros) en el texto de las entradas [cuenta].
- Avisos con **deshacer** tras acciones como llevar un módulo a una campaña [cuenta].

### Qué nos llevamos (añadido)

1. Niveles de detalle que esconden sin cambiar valores, «solo lo cambiado» y buscador: muy útil para la configuración
   de la campaña de Crisol, que crecerá.
2. Una frase bajo cada ajuste y el aviso de dependencias, en vez de ayudas aparte.
3. Recorrer la configuración con «Siguiente: …» al pie de cada sección.
