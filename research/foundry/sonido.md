# Sonido en Foundry VTT: listas, sonidos en el mapa y cómo vienen en un zip

Módulo de Crisol: 7. Sala de jugadores · Fecha: 2026-11-10 · Versión estudiada: 14.369

## Pregunta

5. **Listas de sonido**: modelo de datos (lista, pistas, modos, repetir, volumen, fundidos), cómo se sincroniza la
   reproducción entre clientes (inicio, entrar tarde, pausar), volúmenes por cliente, la política de reproducción
   automática de los navegadores, flujo por URL, YouTube y precarga.
6. **Sonidos en el mapa**: radio, atenuación, muros, oscuridad, efectos, quién los oye.
7. **Zip de Foundry**: cómo vienen listas y sonidos del mapa en un mundo, compendio o aventura exportados, para poder
   importarlos.

## Lo que hacen

Grado de certeza: **[código]** leído en el programa instalado, **[observado]** comprobado contra la instancia de
estudio, **[inferido]** deducido sin comprobarlo.

### Cómo se estudió

- Con craft-anything se abrió el programa y se mapeó el cliente; se leyeron el ayudante de audio, la clase de sonido
  (búfer o flujo, fundidos, efectos), los documentos de lista y pista (común y cliente), el directorio de música, la
  capa de sonidos del mapa, la fuente de sonido y la parte del servidor que reenvía los avisos de audio.
- Por socket (script propio fuera del repo), el máster creó la lista «Sala Música», la puso a sonar, la pausó y cambió
  un volumen con dos jugadores conectados; un tercero entró tarde. Después creó la escena «Sala Sonidos» con dos sonidos
  del mapa y los compendios «Sala Zip Música» y «Sala Zip Aventura», y se leyeron sus bases LevelDB copiadas.
- Se intentó escuchar en dos navegadores sin pantalla (Chromium 153): el desbloqueo del audio se vio, pero esos
  navegadores no recibían las difusiones del socket ni terminaban de cargar el sonido, así que la reproducción real en
  el navegador queda **sin observar** (ver al final).

### 5. Listas de sonido

**Modelo** [código]:

| Lista | Pista |
|---|---|
| nombre, descripción, carpeta, orden, permisos | nombre, descripción, ruta del archivo (o URL) |
| **canal**: música, ambiente o interfaz | canal propio (vacío = el de la lista) |
| **modo**: solo botonera, secuencial, aleatorio, simultáneo | sonando, **segundo en que se pausó** |
| orden de las pistas: alfabético o a mano | **repetir** (bucle) |
| **fundido** (ms) por defecto | **volumen** (0–1), fundido propio |
| sonando (derivado: alguna pista suena), semilla del aleatorio | |

- **Modos**: *botonera* no reproduce sola, cada pista se lanza a mano; *secuencial* y *aleatorio* tocan una pista tras
  otra (al acabar la última vuelve a la primera: la lista entera se repite siempre); *simultáneo* las toca todas a la
  vez. El aleatorio es un orden fijo sacado de una semilla que se cambia al dar a tocar o al cambiar de modo, así todos
  los navegadores calculan el mismo orden [código].
- **Fundidos**: entrada desde silencio al empezar y salida programada antes del final si la pista no se repite; el
  fundido nunca pasa de media pista. Al parar, fundido de salida (sin él si se había pausado) [código].
- **Escena con música**: una escena puede llevar una lista o una pista; al activarla suena y la anterior se para
  [código].
- **Permisos**: crear listas, la capacidad «crear listas» (máster de serie); tocar, parar o cambiar una pista exige ser
  **propietario de la lista**. Un jugador sin permiso que intenta parar una pista es rechazado [observado]. Un jugador
  solo ve en su barra las listas que suenan.
- **Importar en bloque**: elegir una carpeta del servidor y crear una pista por archivo de audio que no esté ya, con el
  nombre sacado del archivo [código].

**Cómo se sincroniza** [código, observado]:
- Tocar, parar, pausar o cambiar el volumen es **cambiar el documento** (pista sonando sí/no, segundo de pausa, volumen),
  que el servidor difunde a todos. Cada navegador, al recibir el cambio, arranca, para o funde su propia copia del
  sonido.
- **No se guarda cuándo empezó**: no hay marca de tiempo de inicio. Cada navegador empieza al recibir el cambio (más lo
  que tarde en cargar) y desde el segundo 0, o desde el segundo de pausa. Los relojes de reproducción van cada uno a su
  aire [código].
- **Entrar tarde**: quien entra recibe la pista como «sonando» y sin tiempo [observado], así que **la oye desde el
  principio**, desfasada de los demás [código].
- **Pausar** guarda el segundo en el que iba **el navegador del máster** [código; observado el campo al pausar]; al
  reanudar, todos empiezan desde ese segundo.
- **Avanzar de pista** lo decide el navegador del **propietario** cuando su copia acaba: pasa a la siguiente cambiando el
  documento. Si no hay ningún propietario conectado, la lista no avanza y sigue marcada como sonando; si hay dos, los
  dos lo intentan [inferido del código].
- **El volumen de una pista es para todos**: se guarda en el documento (con un retardo para no inundar al arrastrar el
  control) [observado].

**Volúmenes por cliente** [código]: tres controles por usuario, guardados en su navegador (música, ambiente e interfaz;
50 % de serie), más silenciar todo. Cada canal es un contexto de audio propio con su ganancia. El control sigue una curva
(potencia 1,5) para que el tramo bajo sea más fino.

**Reproducción automática de los navegadores** [código, observado]:
- El audio arranca **bloqueado**: no se crea ningún contexto de audio hasta el **primer gesto** del usuario (clic,
  clic derecho, tecla). Lo que debía sonar antes se apunta como pendiente y suena al primer gesto [observado: el
  jugador sin tocar nada tenía el audio bloqueado y una tarea pendiente; tras su clic, desbloqueado].
- **No se avisa** al usuario de que hay audio esperando: no hay rótulo de «pulsa para activar el sonido» [código, sin
  textos de ese tipo en el idioma].

**Archivos, flujo y URLs** [código]:
- Un sonido de **hasta 10 minutos** se descarga entero, se decodifica y se guarda en una caché de búferes (1 GB como
  mucho); uno más largo se reproduce **en flujo** con un elemento de audio. Para saber la duración, siempre carga antes
  los metadatos con un elemento de audio.
- La ruta puede ser un archivo del servidor o una **URL externa** (el campo admite cualquier ruta con extensión de
  audio; el elemento pide CORS anónimo, así que el servidor externo tiene que permitirlo para el búfer) [inferido del
  código].
- Los archivos de la carpeta de datos se sirven **sin sesión**: el tono de prueba se descargó sin cookie [observado].
- **Precarga**: 20 s antes de acabar una pista, el navegador carga la siguiente; el máster puede además pedir a todos que
  precarguen un archivo [código].

**YouTube** [código, inferido]: el núcleo **no** reproduce YouTube en las listas; solo lo admite en las páginas de vídeo
de los diarios (inserta su reproductor). No hemos encontrado que lo tuviera y lo quitara: lo de las listas siempre lo
han hecho módulos de la comunidad (uno antiguo, ya abandonado, avisaba de que solo suenan los vídeos cuyo autor permite
insertarlos; los actuales sincronizan un reproductor insertado entre clientes).

**Otros sonidos** [código]: tirar dados, susurros, puertas y avisos de combate suenan en el canal de interfaz. Cualquier
usuario puede mandar a los demás «toca este sonido» por un aviso que el servidor reenvía **sin comprobar quién lo pide**
(una jugadora hizo sonar unos tambores en todos los navegadores) [observado].

### 6. Sonidos en el mapa

**Modelo** [código, observado]: posición y elevación (y niveles en v14), **radio en unidades de la escena** (pies), ruta,
volumen, «repetir», **lo frenan los muros** (sí de serie), **suavizado** (sí de serie), oculto, bloqueado, **franja de
oscuridad** en la que suena (mínimo y máximo, 0–1) y dos **efectos**: el de base y el de **amortiguado**, cada uno un
tipo (paso bajo, paso alto o reverberación) con intensidad 1–10. Solo el máster los ve y los toca.

**Quién oye y desde dónde** (cada navegador lo calcula para sí) [código]:
- Los **oyentes** son las fichas con visión activa de ese usuario. Si no hay, el máster oye desde sus fichas
  seleccionadas; un jugador con visión de fichas activa y sin visión no oye nada; sin visión en la escena, oye desde las
  seleccionadas o, si no tiene ninguna, desde todas las fichas que puede observar.
- Un máster sin fichas seleccionadas **no oye** los sonidos del mapa, salvo con la herramienta de «escuchar desde el
  cursor».
- Para cada archivo cuenta el oyente que lo oye más fuerte; el mismo archivo en dos sitios es un único sonido.

**Atenuación** [código]: a menos de un radio, con suavizado, el volumen baja con una curva coseno de la distancia (1 en el
centro, 0 en el borde, contando también la diferencia de altura); sin suavizado, suena a volumen entero dentro del radio
y nada fuera.

**Muros** [código]:
- Si **lo frenan los muros**, el área del sonido es un polígono recortado por los muros que bloquean el sonido (como
  una luz): detrás del muro no se oye.
- Si no, atraviesa los muros pero, si entre el oyente y el sonido hay un muro de sonido, se aplica el efecto de
  **amortiguado** (por ejemplo un paso bajo: se oye «a través de la pared»).
- Abrir una puerta recalcula los sonidos (ya visto en `vision-muros-y-niebla.md`).

**Oscuridad** [código]: un sonido solo suena si la oscuridad de la escena cae dentro de su franja (grillos de noche).
Cambiar la oscuridad lo enciende o apaga con fundido.

**Reproducción** [código]: siempre en bucle (sea cual sea «repetir»), empezando en un punto que depende del reloj del
contexto de audio, no sincronizado entre navegadores; los cambios de volumen al moverse van con fundidos de 250 ms.
También existe «tocar un sonido en un punto» con radio, una vez, difundido a todos (para efectos sueltos).

### 7. Listas y sonidos en un zip

Ya visto en `escenas-fichas-y-combate.md` § 6 cómo vienen las escenas, las aventuras y las rutas de las imágenes; con el
sonido pasa lo mismo [observado en lo creado]:

- **Listas en un mundo**: la base de listas del mundo (carpeta LevelDB, o un archivo NeDB de una línea JSON por
  documento antes de v11). Cada lista es una entrada con los ids de sus pistas y cada pista, otra, con la lista y la
  pista encadenadas en la clave.
- **Listas en un compendio**: igual, en un paquete de tipo lista. Al guardar en un compendio se quita el estado:
  ninguna suena, sin semilla ni segundo de pausa.
- **En una aventura**: dentro de la única entrada de la aventura, en su lista de listas, cada una con sus pistas
  completas dentro; junto a las escenas, que llevan dentro sus sonidos del mapa y su lista o pista asociada por id.
- **Sonidos del mapa**: dentro de la escena (uno por entrada, encadenado al id de la escena) con todos los campos de
  arriba.
- **Campos útiles para importar**: de la lista, nombre, descripción, canal, modo, fundido, orden; de la pista, nombre,
  ruta, canal, repetir, volumen y fundido; del sonido del mapa, posición, elevación, radio (en unidades de la rejilla
  de la escena), ruta, volumen, muros, suavizado, oculto, franja de oscuridad y efectos.
- **Dónde están los audios**: las rutas son relativas a la carpeta de datos: las del propio módulo (dentro del zip), las
  del mundo, los sonidos de serie de Foundry (que no vienen en el zip) o cualquier carpeta del usuario (tampoco). Una
  ruta puede ser también una URL. Formatos admitidos: los que el navegador sepa reproducir (ogg, mp3, wav, flac, webm,
  m4a…).

## Compromisos y límites

- **Sincronía aproximada**: sin marca de inicio, cada navegador va por su cuenta. Con música de ambiente no se nota;
  con un efecto que debe sonar a la vez, sí, y quien recarga empieza la pista de nuevo.
- **Todo depende del navegador del máster**: él decide cuándo se acaba una pista y en qué segundo se pausa. Sin máster
  conectado, la lista se queda colgada.
- **Desbloqueo silencioso**: el jugador que entra y no toca nada no oye nada y nadie se lo dice; en una tele que nadie
  toca, pasa siempre.
- **Sin YouTube** en el núcleo; los módulos que lo hacen viven de que el autor permita insertar el vídeo.
- **Sonidos del mapa por navegador**: cada uno calcula qué oye según sus fichas, lo que es justo pero raro en una tele
  (el máster sin fichas seleccionadas no oye nada).
- **Avisos sin control**: cualquier usuario puede hacer sonar algo en todos los navegadores.
- **Audio público**: los archivos se descargan sin sesión.

## Qué nos llevamos a Crisol

- **Modelo de listas parecido**, en dos clases como pidió Enrique (**ambiente** y **efectos**), con modos secuencial,
  aleatorio, simultáneo y botonera, repetir por pista, volumen por pista y fundidos.
- **Sincronía por reloj del servidor**: guardar cuándo empezó cada pista (hora del servidor) y en qué segundo; cada
  aparato calcula dónde debería ir con su desfase de reloj medido al conectar, salta ahí al entrar tarde y corrige si se
  desvía más de un umbral. Pausar guarda el segundo calculado por el servidor, no el del máster.
- **El servidor avanza las listas**: la duración se mide al subir el archivo; el siguiente tema lo decide el servidor (o
  el aparato que haga de «guía»), y la lista no se cuelga si el máster se va.
- **Desbloqueo con aviso**: un botón «Activar sonido» visible mientras haya audio pendiente, imprescindible en la tele y
  en los móviles; recordar el desbloqueo por pestaña.
- **Volumen por aparato** para ambiente, efectos e interfaz, más silenciar, guardado en ese aparato; la tele con el suyo.
- **Solo el máster lanza sonido**, comprobado en el servidor; los archivos de audio, servidos con permiso (enlaces
  firmados), no públicos.
- **YouTube**: posible con el reproductor insertado (su API IFrame) y sincronizado como arriba (el «guía» marca el
  tiempo y los demás saltan si se desvían), pero con límites que no controlamos, según su documentación pública:
  - solo suenan los vídeos cuyo autor permite insertarlos (si no, el reproductor da el error 101 o 150), y algunos
    tienen restricciones de edad o región;
  - el navegador puede bloquear la reproducción automática con sonido (el reproductor avisa con un evento propio), así
    que el desbloqueo hace falta igual;
  - sus políticas piden un reproductor visible de al menos 200×200 px y prohíben separar el audio del vídeo y sonar en
    segundo plano (con la ventana minimizada o cerrada): un reproductor escondido solo para música queda, como poco, en
    zona gris, y en móviles el sistema lo para al bloquear la pantalla;
  - los anuncios los pone YouTube y desfasarán a quien los reciba [inferido].
  Los archivos propios no tienen ninguno de estos límites.
  Fuentes: https://developers.google.com/youtube/iframe_api_reference ,
  https://developers.google.com/youtube/terms/developer-policies-guide y
  https://developers.google.com/youtube/terms/required-minimum-functionality .
- **Sonidos del mapa** al final, como pidió Enrique: radio en unidades de la rejilla, suavizado coseno, frenados o
  amortiguados por muros y franja de oscuridad. En la tele, oír desde todas las fichas del grupo; en el móvil, desde la
  ficha de cada jugador.
- **Importar de un zip de Foundry**: leer las listas (del mundo, de un compendio o de una aventura) y los sonidos de las
  escenas con los campos de arriba, y traer los audios que estén dentro del zip; las rutas a sonidos de serie o a
  carpetas ajenas, avisar de que faltan.

## Sin comprobar

- La reproducción real en un navegador (desfase medido entre dos aparatos, el fundido, el flujo de un archivo largo):
  los navegadores sin pantalla de la prueba se quedaban cargando y no recibían difusiones.
- Una URL externa de audio con y sin CORS.
- Si alguna versión antigua del núcleo tocó YouTube en las listas (no lo hemos encontrado).

## Datos de prueba creados

Ver `entorno.md`: la lista «Sala Música» (pistas «Tambores», «Dados» y «Tono», este con el archivo
`worlds/crisol-rea/audio/sala-tono.wav`, un tono de 90 s generado), la escena «Sala Sonidos» y los compendios «Sala Zip
Música» y «Sala Zip Aventura».
