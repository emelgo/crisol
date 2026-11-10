# ADR-0022: La sala de jugadores, en el servidor

Estado: propuesta (2026-11-10; mapa de capacidades aprobado por Enrique: «ok»; falta el lienzo «Sala de jugadores»)

## Contexto

El módulo 7 (`docs/specs/modulo-7.md`, intención en `docs/intent/sala-de-jugadores.md`) añade a la partida la
presencia, los controles del máster (pausa, modo de movimiento, echar), un registro con susurros, enseñar páginas e
imágenes, que los jugadores muevan sus fichas, sus notas y el sonido. Se juega sobre todo en persona, pero a distancia
tiene que funcionar igual.

El estudio de Foundry (`research/foundry/sala-de-jugadores.md`, `research/foundry/sonido.md`) comprobó que allí casi
todo lo frena solo el navegador: la pausa, los muros al mover, echar (no corta la conexión), pasar turno (cualquier
jugador puede pasar el de otro), enseñar (cualquiera puede mandar el aviso) y lanzar sonido; los susurros llegan a
todos los navegadores; y el sonido no guarda cuándo empezó cada pista, así que quien entra tarde la oye desde el
principio y una lista se cuelga si el máster se va.

## Decisión

1. **El servidor manda en la sala**, como en la Mesa (ADR-0018). La pausa, el modo de movimiento, echar, pasar turno,
   enseñar, lanzar sonido y los muros al mover se comprueban en la API. La pausa, el modo y la lista de echados son
   estado de la sesión de cada campaña (`campaign_tables`), guardado pero fuera del historial.
2. **Echar es de la Mesa, no de la campaña**: corta al momento las conexiones del canal de la mesa de esa persona y le
   impide volver hasta que el máster la deje; sigue siendo miembro (quitarlo es `removeMember`).
3. **Un registro por campaña, proyectado**: mensajes, tiradas y lo enseñado en un solo hilo; cada entrada con su
   visibilidad, y a cada uno le llega (por tiempo real y por páginas) solo lo que puede ver. **El máster ve todos los
   susurros**, también los de entre jugadores (Enrique). Las tiradas siguen en su tabla y se mezclan al listar.
4. **Enseñar no da permisos a medias**: una página que un jugador no conoce o se revela a la vez (queda en lo que sabe)
   o no le llega; una imagen enseñada se sirve firmada solo a sus destinatarios.
5. **Los jugadores mueven sus fichas y las asignadas** (`controlled_by` en las criaturas en juego), con las reglas de
   `table/rules.ts` y una función de dominio para pausa, modo y turno. Su Mesa sigue viendo lo del grupo (la visión de
   cada personaje por separado queda fuera).
6. **Las notas del jugador, en una tabla propia** (`player_notes`), no como páginas del mundo: así no se mezclan con
   el árbol, la búsqueda ni lo que sabe la campaña; usan el editor y el Markdown de la wiki.
7. **Sonido sincronizado por el reloj del servidor**: las listas son del mundo; lo que suena, de cada campaña, con la
   hora del servidor en que empezó cada pista y su segundo; cada aparato mide su desfase y corrige; el servidor pasa de
   pista aunque el máster se vaya. Solo el máster lanza sonido. Archivos propios como camino principal; **YouTube con
   su reproductor insertado y a la vista** (≥200×200 px, como piden sus normas). Spotify, no (su API solo suena donde
   hay Premium con sesión). La duración de un archivo la mide el navegador del máster al añadirlo (sin programas nuevos
   en el servidor).
8. **Voz y vídeo, fuera** (Discord o una llamada aparte); a largo plazo, cuando la app esté madura.

## Consecuencias

- Una migración con lo nuevo de `campaign_tables` (pausa, modo, echados), `campaign_messages`, `player_notes`,
  `controlled_by` y las tablas de sonido.
- El canal de la mesa gana mensajes (`controls`, `show`, `sound`, `time`) y el cierre «echado»; el canal general, el
  foco de campaña para la presencia.
- La ventana de historial de dados pasa a ser el registro.
- Herramientas MCP para todo (`docs/specs/modulo-7.md`).
- YouTube depende de lo que cada vídeo permita; se avisa al añadirlo.
