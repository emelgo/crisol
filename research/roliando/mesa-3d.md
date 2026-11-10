# Los mapas en 3D de Roliando

Módulo de Crisol: 6 (mesa) · Fecha: 2026-11-10 · Versión estudiada: roliando.com, mesa de la demo pública sin cuenta
(`/demo`, interfaz «Tinta»)

## Pregunta

A Enrique le gustan los mapas en 3D de Roliando. Cómo se pasa del 2D al 3D, la cámara, de dónde sale el relieve, cómo
quedan fichas, niebla y luces, cuánto cuesta dibujarlo y qué ven los jugadores. Y qué costaría algo parecido en la Mesa de
Crisol, que hoy es PixiJS en 2D.

**Límites.** El 3D es de pago: en la demo, «Ver la mesa en 3D» lleva un candado y avisa de que es del plan Máster
Leyenda («lo enciende el plan del máster y todos sus jugadores lo tienen») [visto]. No se pudo entrar con la cuenta de
prueba (ver `dados.md`), y aunque se hubiera podido, la cuenta no tiene ese plan. Además el VPS dibuja WebGL por software,
así que tampoco se habría podido medir su fluidez. **No se vio la vista 3D.** Lo de abajo sale de la vista 2D, de las
herramientas de «Construir» (que son las que alimentan el 3D) y de lo que ya se sabía por la web (`otras-ideas.md`).
Marcas: **[visto]**, **[medido]**, **[deducido]**, **[web]**.

## Lo que hacen

### Cómo se entra

- En el menú «Vista» de la mesa, junto a «Ver como jugador», cámara que sigue el turno o a tu personaje, mover con WASD,
  encajar el mapa, «traer la vista de todos aquí» y modo cine: **«Ver la mesa en 3D»** es un conmutador de la vista, no
  otro mapa [visto].
- Es una vista del **mismo** mapa: no hay un editor 3D aparte [deducido de que todas las piezas se crean en el modo
  «Construir» del 2D].

### De dónde sale el relieve: el modo «Construir»

La mesa tiene cuatro modos en su barra (Jugar, Dirigir, Construir y Mano). En «Construir» aparecen [visto]:

- **Estructura**: muros, puertas, muros por forma, **alturas**, portales, agujeros, zonas de evento y caminos.
- **Ambiente**: luces (con su radio pintado como círculo en el mapa), sonido y efectos.
- **Plantas**: varias plantas por mapa y «borrar todas».
- **Objetos**: objetos, sembrar objetos al azar y formas con textura.
- **Mapa**: importar, **detectar muros** solos, plantas y capas.

La herramienta **Alturas** [visto]:

- Dibujar o editar, con la lista de trazos de esta planta.
- Preajustes: plataforma, foso, colina y rampa.
- Pinceles: pincel, rectángulo, elipse, polígono y rampa; modos subir, bajar, fijar y suavizar.
- Altura en pies (10 por defecto), radio y **borde suave** en casillas.
- «Escaleras a la planta de arriba».
- Bajo el cursor se lee la altura del punto («0 ft»).

Así que el relieve es un **mapa de alturas pintado a trazos** por planta, más muros que suben, agujeros que bajan y plantas
apiladas unidas por escaleras [deducido]. Con eso la vista 3D puede levantar el terreno con la imagen del mapa encima,
extruir los muros y poner cada planta a su cota [deducido]. Las fichas pueden llevar una **miniatura `.glb`** (se sube en
el creador de tokens, ver `crear-y-compatibilidad.md`) [web]; sin ella, lo lógico es una ficha plana de pie [deducido].

### Cómo está hecho el 2D (sobre lo que monta el 3D)

- El mapa no es PixiJS ni un único lienzo: hay **capas** de lienzo 2D (la imagen y lo pintado, 1584 × 1224), **WebGL2**
  para luz y niebla (con el búfer conservado) y otro **WebGL** a pantalla completa para un efecto de paralaje; las fichas,
  sus barras de vida y etiquetas son **SVG** encima [medido].
- La página ya trae **three.js r184** para los dados [medido]: el 3D puede reutilizarlo.
- En reposo la mesa no dibuja nada WebGL (cero llamadas por fotograma) y va a 60 fps; con el modo Construir abierto (los
  círculos de todas las luces) y un efecto de clima, en esta máquina sin GPU cayó a 12 fps en reposo y a 1 fps al
  arrastrar el mapa [medido; por software, no representativo].

### Qué ven los jugadores y la tele

No se pudo ver. Por la frase del aviso, si el máster tiene el plan, «todos sus jugadores lo tienen» [visto]; no se sabe si
cada uno elige 2D o 3D o si lo impone el máster.

## Compromisos y límites

- Un solo modelo de datos para 2D y 3D: lo que se pinta para el táctico (alturas, plantas, muros) sirve para las dos
  vistas, y el 3D no exige otra preparación [deducido].
- Las alturas también tienen sentido en 2D (línea de visión, caídas, cobertura), así que no son trabajo perdido para
  quien no use el 3D [deducido].
- Es de pago y pesado; en máquinas flojas no habrá 3D fluido (sus propios dados ya caen a 2D sin GPU) [deducido].

## Qué nos llevamos a Crisol

La Mesa de Crisol (`apps/web/src/tabletop/`) es PixiJS 2D con visión, niebla, luces, muros, escenas, combate y tele.
**No tiene alturas, plantas ni clima.** three.js ya está en el proyecto (dados), lo que abarata un visor 3D.

Lo que costaría algo parecido, por piezas (estimaciones gruesas, a confirmar en el plan):

| Pieza | Qué es | Coste |
|---|---|---|
| **Alturas en los datos** | Una rejilla de alturas por escena (o trazos que se rasterizan), con pincel subir, bajar, fijar y suavizar, y preajustes; se guarda en el servidor como el resto de la escena (ADR-0018) | Medio: 1–2 semanas. Útil ya en 2D (sombreado, cotas en la regla) |
| **Visor 3D de solo mirar** | Otra vista con three.js que lee la misma escena: terreno desplazado con la imagen del mapa, muros extruidos desde los segmentos que ya existen, fichas como tarjetas de pie, cámara orbital con límites | Medio-alto: 2–3 semanas para un visor sin editar |
| **Niebla y visión en 3D** | Reusar el cálculo de visión actual: pintar lo visible a una textura y usarla como máscara en el material del terreno y los muros | Medio: 1–2 semanas; la visión ya está hecha |
| **Luces en 3D** | Luces puntuales de three.js para las luces de la escena (pocas con sombra; el resto sin) | Medio; caro en GPU si hay muchas |
| **Plantas** | Varias capas por escena con su cota y escaleras entre ellas, en 2D y 3D | Alto: toca datos, visión y herramientas |
| **Miniaturas `.glb`** | Cargar un modelo por ficha | Bajo-medio, pero pesa en red y GPU |

Propuesta: empezar por **alturas en 2D** (sirven solas) y un **visor 3D de solo mirar para la tele**, donde más luce y donde
no hay que editar; dejar plantas y modelos para después. Con detección de GPU y vuelta al 2D, como hacen con los dados.
Y antes de nada, que Enrique vea la vista 3D de Roliando con una cuenta Leyenda o un vídeo suyo, porque aquí no se pudo.
