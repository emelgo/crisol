# Módulo 7: la sala de jugadores

Mapa de capacidades (2026-11-10), de la entrevista con Enrique (`docs/intent/sala-de-jugadores.md`). Cada capacidad
tiene su spec en `docs/specs/<id>.md` y su ciclo (diseño, plan, construcción y revisión), en este orden. La decisión de
fondo irá en el ADR-0022. Los estudios: `research/foundry/sala-de-jugadores.md`, `research/foundry/sonido.md` y
`research/dndbeyond/registro-de-partida.md`; lo del Crisol antiguo, en § «Del Crisol antiguo».

Se juega en la mesa (la Pantalla en la tele, cada uno con su móvil), pero a distancia (cada uno en su casa, hablando
por Discord) tiene que funcionar igual de bien. Ya hay una parte: quién está en la Mesa (`table/presence.ts`),
«enseñar una página» (`showPage`), cambiar el enlace (`regenerateInvitation`), quitar a un miembro (`removeMember`), las
tiradas con su visibilidad (`rollDice`, evento `rolled`) y la Mesa del jugador (espectador `player`, que ve lo de la
Pantalla).

| Id | Qué hace | Depende de |
|---|---|---|
| `sala` | La presencia (quién está en la campaña y en la Mesa, con su personaje y su color; la escena que mira, solo para el máster) y los controles del máster, **todos en el servidor**: la pausa (guardada; bloquea mover, abrir puertas y poner cosas en la API, y sale «Pausa» en la Pantalla y en los móviles), echar a alguien (le corta las conexiones al momento y no vuelve a entrar en la Mesa hasta que el máster lo deje), cambiar el enlace desde la Mesa y el modo de movimiento (libre, en su turno, bloqueado); la IA | — |
| `registro` | El registro de la partida: un solo hilo por campaña con los mensajes, las tiradas (las de ahora pasan a vivir aquí) y lo enseñado; quién habla (su personaje por defecto, él mismo fuera de personaje); susurros a uno o a varios (el máster a jugadores, ellos al máster y entre ellos; **el máster los ve todos**, marcados como susurro entre jugadores); el modo, por mensaje y a la vista, que vuelve a «todos» tras susurrar; **proyectado en el servidor** (a cada uno le llega solo lo suyo) y por páginas; atajos `/s` (susurrar), `/t` (tirar) y `/yo`; avisos breves y, en la Pantalla, burbujas sobre la ficha de lo dicho en personaje; la IA (escribir, susurrar y leer) | `sala` |
| `ensenar` | Enseñar una página (lo de ahora) o una imagen a todos, a unos jugadores o en la Pantalla, al momento, comprobado en el servidor; una página solo a quien la conoce (o revelándola a la vez, que queda apuntado); queda en el registro; quien la recibe la puede cerrar y volver a abrir desde el registro; la IA | `registro` |
| `mover-jugadores` | Cada jugador mueve en su Mesa su personaje y las fichas que el máster le asigne (familiar, montura, invocación), con arrastre en vivo; el servidor comprueba muros, puertas cerradas, la pausa y el modo (en su turno, solo el dueño del combatiente activo); abre y cierra las puertas que ve (`table/rules.ts`); pasa su turno; el máster ve quién mueve qué; la IA (asignar fichas) | `sala` |
| `notas-jugador` | Las notas de cada jugador en la campaña: páginas suyas (sus sospechas, nombres, lo que piensa de un PNJ), con el mismo editor y el mismo Markdown que la wiki, enlazables a lo que su campaña conoce; las lee el máster y no los demás jugadores; desde el móvil; la IA (el jugador conectado las escribe; el máster las lee) | — |
| `sonido` | Listas en dos clases, **ambiente** y **efectos** (modos secuencial, aleatorio, simultáneo y botonera; repetir, volumen por pista y fundidos), con archivos propios (subidos al mundo, servidos con permiso) y enlaces de YouTube; las lanza el máster desde la Mesa y suenan **sincronizadas** en todos los aparatos: el servidor guarda cuándo empezó cada pista y pasa a la siguiente, cada aparato corrige su desfase de reloj y salta al sitio si entra tarde; «Activar sonido» visible mientras el navegador lo tenga bloqueado (la tele sobre todo); volumen de cada aparato para ambiente y efectos, y silenciar; la IA (poner, parar, cambiar volumen) | `sala` |
| `sonido-mapa` | Sonidos puestos en una escena: radio en casillas, suavizado, volumen; los muros que tapan el sonido (ya los hay, de `vision`) los frenan o amortiguan; en la Pantalla se oyen desde las fichas del grupo y en el móvil desde la de cada jugador; el editor en la Mesa; la IA | `sonido`, `mover-jugadores` |
| `sonido-foundry` | Del zip de Foundry, sus listas con sus pistas y archivos (de un módulo, un mundo o una aventura) y los sonidos de sus escenas; reimportar sin duplicar | `sonido-mapa` |

Orden: `sala` → `registro` → `ensenar` → `mover-jugadores` → `notas-jugador` → `sonido` → `sonido-mapa` →
`sonido-foundry`. Lo primero es la sala misma y sus controles en el servidor, porque todo lo demás se apoya en ellos
(la pausa para mover, la presencia para el registro). El registro y enseñar, después: son lo que más se usa en la mesa.
Luego, que los jugadores muevan; las notas, que no dependen de la Mesa; el sonido, al final, y lo de Foundry, lo
último, porque se apoya en todo lo anterior.

**Estado (2026-11-10)**: entrevista y estudio hechos; este mapa, por confirmar.

## Lo que se da por hecho (propuesta de Claude, por confirmar al verla)

1. **El servidor manda en todo** (como ADR-0018): la pausa, echar, el modo de movimiento, pasar turno, enseñar, lanzar
   sonido y los muros se comprueban en la API, no en la interfaz. En Foundry casi todo eso lo frena solo el navegador
   del jugador, y el estudio comprobó que una jugadora puede pasar el turno de otro o enseñar imágenes a todos.
2. **El registro es de la campaña y se proyecta**: cada mensaje lleva su visibilidad (todos, el máster, unos
   destinatarios, solo yo, oculto), y a cada uno le llega solo lo suyo, también al pedir páginas antiguas o al
   exportar. Se guarda en la base, sin límite, y se pide por páginas (Foundry lo manda entero a cada navegador).
3. **Las tiradas, dentro del registro**: la tirada sigue siendo la de ahora (con su visibilidad y su tarjeta, con el
   total grande y el detalle plegado, como D&D Beyond), pero sale en el mismo hilo que los mensajes. La ventana de
   historial de los dados pasa a ser el registro.
4. **Los susurros entre jugadores los ve el máster** (Enrique; como el Crisol antiguo, al revés que Foundry), marcados
   «De Ana a Bruno».
5. **La pausa se guarda** (sobrevive a reiniciar el servidor) y la campaña no arranca en pausa. Sale en la Pantalla y
   en los móviles; el máster sigue pudiendo con todo.
6. **Echar** corta al momento sus conexiones a la Mesa y le impide volver a entrar en ella hasta que el máster lo deje
   (sigue siendo miembro de la campaña; quitarlo del todo es `removeMember`, que ya existe).
7. **La Mesa del jugador sigue viendo lo del grupo** (lo de la Pantalla): la visión de cada personaje por separado en
   su aparato no entra en este módulo.
8. **Mover en su turno** significa: con combate, solo el dueño del combatiente activo mueve sus fichas; sin combate, se
   mueve libre. Las fichas asignadas a un jugador se mueven como las suyas.
9. **Enseñar una página que no conoce** no da un permiso a medias (Foundry lo da solo en el navegador): o se revela a
   la vez (queda en lo que sabe) o no le llega.
10. **Las notas del jugador** usan el editor y el formato de la wiki; dónde se guardan (páginas del mundo con dueño o
    una tabla aparte) se decide en su spec.
11. **Sonido**: los archivos propios son el camino principal; **YouTube va como extra con su reproductor pequeño a la
    vista** (de al menos 200×200 px, como piden sus normas; en la Pantalla y donde suene), y si un vídeo no deja
    insertarse se avisa. En el móvil, el sistema lo para al bloquear la pantalla. Spotify, fuera.
12. **La sincronía, por el reloj del servidor**: hora de inicio y segundo de cada pista, desfase medido al conectar,
    corrección si se desvía más de un umbral; el servidor pasa de pista aunque el máster se vaya. Duración del archivo,
    medida al subirlo.
13. **Solo el máster lanza sonido**; en la mesa, sonará donde esté abierta la Mesa o la Pantalla (cada aparato con su
    volumen, guardado en él), así que el máster puede silenciar su PC y dejar que suene la tele.
14. **Iconos y sonidos de serie**, ninguno con licencia que el listón no admita (CC BY-SA, GPL…). Los sonidos de
    ejemplo, si hacen falta, propios o CC0.

## Del Crisol antiguo

Solo de consulta (`~/CrisolVTT/crisol`). Lo que se toma como idea:

- Chat de un tipo con destinatario (`para`), guardado por campaña, en el que el máster ve todos los susurros
  (`apps/core-host/src/game/GameServer.ts`).
- Controles del máster: modo de movimiento libre / en su turno / bloqueado y pausa, comprobados al mover
  (`GameServer.setControl`, `motivoSinMover`); echar cierra el socket; nuevo enlace de la sala.
- Sonido: listas con aleatorio, repetir y volumen; a los jugadores se les manda la hora de inicio y saltan al sitio,
  sin corregir el desfase de reloj (`apps/player-web/src/shell/sonido.ts`); YouTube con su API IFrame, el máster guía
  y los demás siguen si se desvían más de 3 s; sonido posicional por radios, sin muros.
- Notas y diario del jugador por campaña, con visibilidad para el máster (`NotasJugador.tsx`).

## Fuera de este módulo

Voz y vídeo (a largo plazo, con la app madura); Spotify; la visión de cada personaje por separado; el móvil del máster
(trabaja en PC, ADR-0019); macros y tarjetas de acción en el chat más allá de las tiradas; exportar el registro a otro
formato que texto.
