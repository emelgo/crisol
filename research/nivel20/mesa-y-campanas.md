# Mesa virtual y campañas en Nivel20

Módulo de Crisol: 6. La mesa, y la campaña (ADR-0018 y ADR-0019) · Fecha: 2026-11-10 · Versión estudiada: web pública
de nivel20.com, v2.20.9: la página y el manual del tablero 2D, y sus novedades de 2018 a 2026

## Pregunta

Nota complementaria a `sistemas-y-libros.md`: qué hacen la campaña, el registro de combate y el tablero virtual de
Nivel20 que pueda servir a la Mesa y a la campaña de Crisol. Mismo método (sin cuenta) y mismas marcas de certeza:
**[visto]**, **[novedades]**, **[manual]** (el manual público del tablero 2D) y **[deducido]**.

## Lo que hacen

### Campaña

- Se invita con enlace o con un **código QR** [novedades]. Diario de campaña con texto enriquecido, imágenes y fecha
  editable para reordenar; los jugadores pueden escribir en él si el máster lo permite [novedades].
- Lista de personajes de la campaña con buscador y filtros, y una casilla para marcar quién está **activo en la
  sesión** [novedades]. Las campañas acabadas se **archivan** y salen con «ver inactivas» [novedades]. El máster puede
  poner un logotipo propio en las hojas en PDF de todos los personajes de su campaña [novedades].
- **Equipos para la visibilidad**: personajes y criaturas pertenecen a equipos; el equipo de los personajes lo ve todo
  el mundo y el de los rivales solo quien esté en él (el máster). Para mostrar un PNJ aliado se le pasa al equipo de
  los personajes [novedades]. La misma idea decide la niebla de guerra del tablero 2D [manual].
- **Compañeros**: el personaje tiene una sección con sus criaturas (familiar, montura, invocación…), importadas del
  bestiario o creadas, que se añaden al combate y tiran desde su ventana [novedades].
- El filtro de libros de la campaña está explicado en la otra nota.

### Registro de combate y tiradas

- Nació en 2020 como resumen sincronizado de los personajes con sus puntos de golpe, y fue sumando iniciativa,
  permiso para que el jugador lleve sus propios puntos de golpe, estados, recursos (como espacios de conjuro), chat y
  registro de tiradas [novedades]. Se puede usar sin el tablero o dentro de él, en un panel lateral [novedades].
- Las criaturas pueden entrar con **puntos de golpe tirados** para que un grupo de monstruos no sea idéntico (con un
  valor por defecto en los ajustes) [novedades].
- **Visibilidad de cada tirada o mensaje**: todos, máster y quien tira, solo quien tira, o nadie (no queda en el
  registro y quien tira lo ve unos segundos) [novedades]. Se puede hablar y tirar **como** un personaje o una criatura
  [novedades].
- Botones de acción personalizados por personaje, con fórmulas que se procesan tras la tirada (ventaja como máximo de
  dos, multiplicar el crítico…); se exportan con un código y se importan en otro personaje [novedades].
- Para quien retransmite partidas, el registro admite una hoja de estilo propia por parámetro en la dirección
  [novedades].

### Tablero virtual

- Dos versiones: la clásica en **3D con miniaturas animadas**, que desaparecerá, y la nueva en 2D (2025), más ligera y
  pensada también para móvil [visto]. Salas efímeras: se comparten por su dirección y se borran cinco minutos después
  de que salga el último [manual]. Si la sala se asocia a una campaña, trae su registro de combate y una carpeta con los
  tokens por defecto de sus personajes activos [manual, novedades].
- Recursos: personajes (tokens), mapas y escenas, en listas con filtros, etiquetas y **carpetas**, donde un recurso
  puede estar en varias carpetas y la raíz los busca todos [manual]. Hay una galería de tokens y mapas de serie para
  empezar sin preparar nada [novedades].
- Token: nombre oculto a los jugadores, visible solo para el máster, bloqueado, tamaño en casillas, equipo y si
  despeja niebla [manual]. Los tokens que pone alguien que no es el máster **nunca despejan niebla**, para que no
  revelen zonas por accidente [manual].
- **Escenas** como foto del tablero (mapa, muros, niebla, tokens, cámara) que se guardan y se cargan para todos al
  momento; el manual aconseja guardar una base al empezar [manual].
- Medir y áreas de efecto (resaltan las casillas con más de la mitad dentro), cuatro fórmulas de diagonales elegibles
  en la campaña, escala de casilla por mapa, selección múltiple y un **puntero para señalar** visible a todos [manual,
  novedades]. El máster puede llevar la cámara de los demás [manual].
- Niebla por equipos con muros de visión; si se activa sin tokens que despejen, todo sale negro [manual].

## Compromisos y límites

- Todo gira alrededor del personaje y del combate: la campaña es diario, lista de personajes y registro; no hay wiki ni
  conocimiento revelado por partes.
- El tablero 2D es joven: sin capas, escenografía ni 3D todavía (lo anuncian) [novedades]. Las salas efímeras evitan
  guardar estado, pero obligan a usar escenas para no perder la preparación [deducido].
- Los equipos resuelven a la vez quién ve qué en el combate y en la niebla con un solo concepto, a costa de que el
  máster tenga que mover cosas de equipo para revelarlas.

## Qué nos llevamos a Crisol

1. **Visibilidad por tirada** con las cuatro opciones, incluida «nadie» (solo un vistazo a quien tira). Comparar con lo
   que ya hace el módulo de dados.
2. **Puntos de golpe tirados** al meter varias criaturas iguales en el combate, con ajuste por defecto.
3. **Los tokens de un jugador no despejan niebla** por defecto: una salvaguarda sencilla para nuestra visión.
4. **Activo en la sesión** como casilla en la lista de personajes de la campaña, que decide qué tokens salen a mano en
   la Mesa (ya apuntamos «la escena en marcha»; esto lo complementa).
5. **Archivar campañas** (ya pendiente en `docs/modulos.md`) con un filtro de inactivas.
6. **Compañeros del personaje** como criaturas ligadas a su ficha, que entran al combate con él.
7. Invitar con **QR** además del enlace, útil en mesa presencial.
8. **Distinto**: nuestra Mesa guarda su estado en el servidor (ADR-0018) en vez de salas efímeras, y la campaña tiene
   mundo y conocimiento, no solo diario.
