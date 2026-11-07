/**
 * Las herramientas de la mesa (docs/specs/herramientas-mesa.md): lo que se deja en el mapa de una escena de la
 * campaña (plantillas de área, dibujos, textos, sellos, pines e imágenes sueltas, con su historial), medir, los
 * widgets de la campaña (contador, reloj de progreso y temporizador) y las instantáneas. La medida en curso y el láser
 * van en vivo por el canal de la mesa (table.ts)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'

const coordinate = z.number().min(-100_000).max(100_000)
const point = z.object({ x: coordinate, y: coordinate })
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const rotation = z.number().min(-360).max(360)
/** Un icono de Lucide, por su nombre («map-pin») */
const lucide = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

/** Cuántas marcas se ponen, cambian o quitan de una vez, y cuántos puntos lleva un trazo */
export const MAX_MARKS_AT_ONCE = 200
export const MAX_STROKE_POINTS = 4000

export const MARK_KINDS = ['template', 'drawing', 'text', 'stamp', 'pin', 'image'] as const
export type MarkKind = (typeof MARK_KINDS)[number]
export const TEMPLATE_SHAPES = ['line', 'circle', 'cone', 'square'] as const
export const DRAWING_TOOLS = ['pen', 'line', 'rectangle', 'circle', 'polygon'] as const

/** Una plantilla de área: desde `a` hasta `b` (el borde del círculo, el final del cono o de la línea, la otra esquina) */
export const templateMark = z.object({
  shape: z.enum(TEMPLATE_SHAPES),
  a: point,
  b: point,
  angle: z.number().min(1).max(360).optional().describe('Cono: la apertura en grados (por defecto, 53,13)'),
  width: z.number().min(1).max(100_000).optional().describe('Línea: su anchura en píxeles (por defecto, una casilla)'),
  color,
  damageType: z.string().trim().min(1).max(40).nullable().optional().describe('Su tipo de daño, para su trama')
})

/** Un dibujo: sus puntos (las formas, ya convertidas en ellos), su color, su grosor y su relleno */
export const drawingMark = z.object({
  tool: z.enum(DRAWING_TOOLS),
  points: z.array(point).min(1).max(MAX_STROKE_POINTS),
  color,
  width: z.number().min(0.5).max(200),
  opacity: z.number().min(0).max(1),
  fill: color.nullable().optional()
})

export const textMark = z.object({
  x: coordinate,
  y: coordinate,
  text: z.string().trim().min(1).max(500),
  color,
  size: z.number().min(6).max(500).describe('El tamaño de la letra, en píxeles de la imagen'),
  rotation: rotation.optional()
})

/** Un sello: un icono de Lucide o una imagen propia (un archivo del mundo) */
export const stampMark = z.object({
  x: coordinate,
  y: coordinate,
  icon: lucide.nullable().describe('Un icono de Lucide; null con fileId'),
  fileId: z.uuid().nullable().optional().describe('Una imagen del mundo, en vez del icono'),
  size: z.number().min(4).max(5000).describe('Su lado, en píxeles de la imagen'),
  rotation: rotation.optional(),
  color
})

/** Un pin que lleva a una página del mundo */
export const pinMark = z.object({
  x: coordinate,
  y: coordinate,
  pageId: z.uuid().nullable(),
  label: z.string().trim().max(60),
  icon: z.string().max(60).describe('Un id de pin (treasure, npc…), un icono de Lucide, number o letter'),
  color: color.optional(),
  cell: z.boolean().optional().describe('Toda su casilla lleva a la página')
})

/** Una imagen suelta: un archivo del mundo, con su centro, su tamaño y su giro, debajo o encima de las fichas */
export const imageMark = z.object({
  x: coordinate,
  y: coordinate,
  width: z.number().min(8).max(100_000),
  height: z.number().min(8).max(100_000),
  rotation,
  fileId: z.uuid(),
  above: z.boolean().optional()
})

/** El esquema de lo propio de cada clase de marca (para cambiar una a trozos) */
export const MARK_SCHEMAS = {
  template: templateMark,
  drawing: drawingMark,
  text: textMark,
  stamp: stampMark,
  pin: pinMark,
  image: imageMark
} as const

const hidden = z.boolean().optional().describe('Solo del máster: no llega a la pantalla')

export const markInput = z.discriminatedUnion('kind', [
  templateMark.extend({ kind: z.literal('template'), hidden }),
  drawingMark.extend({ kind: z.literal('drawing'), hidden }),
  textMark.extend({ kind: z.literal('text'), hidden }),
  stampMark.extend({ kind: z.literal('stamp'), hidden }),
  pinMark.extend({ kind: z.literal('pin'), hidden }),
  imageMark.extend({ kind: z.literal('image'), hidden })
])

export type MarkInput = z.infer<typeof markInput>

const viewed = { id: z.uuid(), sceneId: z.uuid(), hidden: z.boolean(), version: z.int() }

/** Lo que el máster ve de una marca; de una plantilla, también las fichas que quedan dentro */
export const markView = z.discriminatedUnion('kind', [
  templateMark.extend({
    kind: z.literal('template'),
    ...viewed,
    tokenIds: z.array(z.uuid()).optional().describe('Las fichas de la escena que quedan dentro')
  }),
  drawingMark.extend({ kind: z.literal('drawing'), ...viewed }),
  textMark.extend({ kind: z.literal('text'), ...viewed }),
  stampMark.extend({ kind: z.literal('stamp'), ...viewed }),
  pinMark.extend({ kind: z.literal('pin'), ...viewed }),
  imageMark.extend({ kind: z.literal('image'), ...viewed })
])

export type MarkView = z.infer<typeof markView>

/**
 * Lo que la pantalla recibe de una marca: solo las que no son del máster y caen en lo que ve o vio el grupo; de un
 * dibujo, los trozos que caen ahí; de un pin, ni su página
 */
export const screenMark = z.discriminatedUnion('kind', [
  templateMark.extend({ kind: z.literal('template'), id: z.uuid() }),
  drawingMark
    .omit({ points: true })
    .extend({ kind: z.literal('drawing'), id: z.uuid(), strokes: z.array(z.array(point)) }),
  textMark.extend({ kind: z.literal('text'), id: z.uuid() }),
  stampMark.extend({ kind: z.literal('stamp'), id: z.uuid() }),
  pinMark.omit({ pageId: true }).extend({ kind: z.literal('pin'), id: z.uuid() }),
  imageMark.extend({ kind: z.literal('image'), id: z.uuid() })
])

export type ScreenMark = z.infer<typeof screenMark>

const sceneOrOpen = z.uuid().optional().describe('Sin ella, la escena abierta en la mesa de la campaña')

export const listMarks = defineAction({
  name: 'listMarks',
  kind: 'read',
  description:
    'Lo que hay dejado en el mapa de una escena de la campaña: plantillas (con las fichas que quedan dentro), dibujos, textos, sellos, pines e imágenes, en píxeles de su imagen',
  input: z.object({ campaignId: z.uuid(), sceneId: sceneOrOpen }),
  output: z.object({ sceneId: z.uuid(), marks: z.array(markView) })
})

export const changeMarks = defineAction({
  name: 'changeMarks',
  kind: 'write',
  description:
    'Pone, cambia y quita marcas en el mapa de una escena de la campaña, en una operación: plantillas, dibujos, textos, sellos, pines e imágenes (en píxeles de su imagen). Para cambiar una, set con lo que cambia o move para moverla. Se deshace desde el historial',
  input: z
    .object({
      campaignId: z.uuid(),
      sceneId: sceneOrOpen,
      add: z.array(markInput).max(MAX_MARKS_AT_ONCE).optional(),
      update: z
        .array(
          z.object({
            id: z.uuid(),
            hidden: z.boolean().optional(),
            move: z.object({ dx: coordinate, dy: coordinate }).optional().describe('Moverla tanto, en píxeles'),
            set: z.record(z.string(), z.unknown()).optional().describe('Lo que cambia de lo suyo (color, puntos…)')
          })
        )
        .max(MAX_MARKS_AT_ONCE)
        .optional(),
      remove: z.array(z.uuid()).max(1000).optional()
    })
    .refine((i) => (i.add?.length ?? 0) + (i.update?.length ?? 0) + (i.remove?.length ?? 0) > 0, {
      message: 'algo que poner, cambiar o quitar'
    }),
  output: z.object({ sceneId: z.uuid(), marks: z.array(markView), removed: z.array(z.uuid()) })
})

/** Dónde: en píxeles de la imagen (x, y) o en una casilla (column, row, desde 0; en hexagonales, axiales) */
const where = z
  .object({
    x: coordinate.optional(),
    y: coordinate.optional(),
    column: z.int().min(-1000).max(5000).optional(),
    row: z.int().min(-1000).max(5000).optional()
  })
  .refine((p) => (p.x !== undefined && p.y !== undefined) || (p.column !== undefined && p.row !== undefined), {
    message: 'x e y, o column y row'
  })

/** Una ficha que queda dentro de una plantilla */
export const templateTarget = z.object({
  tokenId: z.uuid(),
  label: z.string(),
  name: z.string(),
  kind: z.enum(['character', 'creature']),
  actorId: z.uuid().describe('Su personaje o su criatura en juego (para hacerle daño)'),
  hidden: z.boolean()
})

export const placeTemplate = defineAction({
  name: 'placeTemplate',
  kind: 'write',
  description:
    'Deja una plantilla de área en el mapa de una escena de la campaña y dice qué fichas quedan dentro: un círculo (size, el radio), un cono (size, su largo; 53° de apertura) o una línea (size, su largo; width, su anchura) desde el centro de una casilla, hacia una dirección (grados: 0 al este, 90 al sur) o hacia otra casilla (toward); o un cuadrado de lado size desde la esquina de arriba a la izquierda de la casilla. Las medidas, en la unidad de la escena (pies)',
  input: z.object({
    campaignId: z.uuid(),
    sceneId: sceneOrOpen,
    shape: z.enum(TEMPLATE_SHAPES),
    from: where.describe('El origen: el centro del círculo, el vértice del cono, el principio de la línea'),
    size: z.number().positive().max(100_000).describe('En la unidad de la escena'),
    direction: z.number().min(-360).max(360).optional().describe('Grados: 0 al este, 90 al sur, 180 al oeste'),
    toward: where.optional().describe('Hacia esta casilla (en vez de direction)'),
    width: z.number().positive().max(100_000).optional().describe('Línea: su anchura (por defecto, una casilla)'),
    angle: z.number().min(1).max(360).optional().describe('Cono: su apertura en grados'),
    color: color.optional(),
    damageType: z.string().trim().min(1).max(40).optional(),
    hidden: z.boolean().optional().describe('Solo del máster: no se ve en la pantalla')
  }),
  output: z.object({ template: markView, tokens: z.array(templateTarget) })
})

export const getTemplateTokens = defineAction({
  name: 'getTemplateTokens',
  kind: 'read',
  description:
    'Las fichas que quedan dentro de una plantilla del mapa (alguna casilla de su huella cuenta), para elegirlas y hacerles daño',
  input: z.object({ campaignId: z.uuid(), templateId: z.uuid() }),
  output: z.object({ tokens: z.array(templateTarget) })
})

export const measureDistance = defineAction({
  name: 'measureDistance',
  kind: 'read',
  description:
    'Mide en una escena de la campaña entre dos casillas (o un camino con puntos intermedios), con la regla de diagonales de su rejilla: casillas y distancia en su unidad',
  input: z.object({
    campaignId: z.uuid(),
    sceneId: sceneOrOpen,
    points: z.array(where).min(2).max(20).describe('Desde, los puntos de paso y hasta')
  }),
  output: z.object({
    sceneId: z.uuid(),
    cells: z.number(),
    distance: z.number(),
    units: z.string(),
    text: z.string(),
    segments: z.array(z.number()).describe('Las casillas de cada tramo')
  })
})

export const WIDGET_KINDS = ['counter', 'clock', 'timer'] as const
/** Cuántos segmentos puede tener un reloj, y lo más que dura un temporizador (en segundos) */
export const MAX_CLOCK_SEGMENTS = 24
export const MAX_TIMER_SECONDS = 24 * 60 * 60

const running = z.object({ since: z.number(), remaining: z.number() })

export const widgetView = z.object({
  id: z.uuid(),
  kind: z.enum(WIDGET_KINDS),
  label: z.string(),
  icon: z.string().nullable(),
  color: z.string(),
  shown: z.boolean().describe('Se ve en la pantalla'),
  sort: z.int(),
  value: z.number().describe('Contador: su valor; reloj: los segmentos llenos; temporizador: los segundos que quedan'),
  min: z.number().nullable(),
  max: z.number().nullable(),
  segments: z.int().nullable(),
  showCount: z.boolean(),
  duration: z.number().nullable().describe('Temporizador: su duración entera, en segundos'),
  running: running.nullable().describe('Temporizador en marcha: desde cuándo (ms) y con cuántos segundos empezó'),
  version: z.int()
})

export type WidgetView = z.infer<typeof widgetView>

/** Lo que la pantalla recibe de un widget: solo de los que tienen el ojo abierto */
export const screenWidget = widgetView.omit({ shown: true, sort: true, version: true })

export type ScreenWidget = z.infer<typeof screenWidget>

const widgetLimit = z.number().min(-1_000_000).max(1_000_000)
const widgetFields = {
  label: z.string().trim().min(1).max(40),
  icon: lucide.nullable().optional(),
  color: color.optional(),
  shown: z.boolean().optional().describe('Verse en la pantalla (por defecto, sí)'),
  value: widgetLimit.optional(),
  min: widgetLimit.nullable().optional().describe('Contador: su mínimo'),
  max: widgetLimit.nullable().optional().describe('Contador: su máximo'),
  segments: z.int().min(1).max(MAX_CLOCK_SEGMENTS).optional().describe('Reloj: sus segmentos (por defecto, 4)'),
  showCount: z.boolean().optional().describe('Reloj: la cuenta «3/6» en el centro'),
  duration: z.int().min(1).max(MAX_TIMER_SECONDS).optional().describe('Temporizador: en segundos (por defecto, 300)')
}

export const listWidgets = defineAction({
  name: 'listWidgets',
  kind: 'read',
  description: 'Los widgets de una campaña (contadores, relojes de progreso y temporizadores), con su valor',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({ widgets: z.array(widgetView) })
})

export const createWidget = defineAction({
  name: 'createWidget',
  kind: 'write',
  description:
    'Crea un widget de la campaña: un contador (con su mínimo y su máximo), un reloj de progreso (con sus segmentos) o un temporizador (con su duración en segundos). Sigue ahí al cambiar de escena',
  input: z.object({ campaignId: z.uuid(), kind: z.enum(WIDGET_KINDS), ...widgetFields }),
  output: widgetView
})

export const updateWidget = defineAction({
  name: 'updateWidget',
  kind: 'write',
  description:
    'Cambia un widget: lo suyo, su valor (value, o step para sumar o restar: llenar o vaciar segmentos de un reloj), su ojo en la pantalla (shown) o, un temporizador, ponerlo en marcha, pararlo o reiniciarlo (timer)',
  input: z
    .object({
      widgetId: z.uuid(),
      ...widgetFields,
      label: widgetFields.label.optional(),
      sort: z.int().min(0).max(10_000).optional(),
      step: z.number().min(-1_000_000).max(1_000_000).optional().describe('Sumar (o restar) al valor'),
      timer: z
        .enum(['start', 'pause', 'reset'])
        .optional()
        .describe('Temporizador: ponerlo en marcha, pararlo o reiniciarlo')
    })
    .refine((i) => Object.keys(i).length > 1, { message: 'algo que cambiar' }),
  output: widgetView
})

export const deleteWidget = defineAction({
  name: 'deleteWidget',
  kind: 'delete',
  description: 'Borra un widget de la campaña. Se deshace desde el historial',
  input: z.object({ widgetId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const snapshotView = z.object({
  id: z.uuid(),
  sceneId: z.uuid(),
  name: z.string(),
  thumbnail: z.string().nullable().describe('Su miniatura, en data URL'),
  createdAt: z.string(),
  tokens: z.int().describe('Cuántas fichas guarda'),
  marks: z.int().describe('Cuántas marcas guarda')
})

export type SnapshotView = z.infer<typeof snapshotView>

export const listSnapshots = defineAction({
  name: 'listSnapshots',
  kind: 'read',
  description: 'Las instantáneas de una escena de la campaña, de la más nueva a la más vieja',
  input: z.object({ campaignId: z.uuid(), sceneId: sceneOrOpen }),
  output: z.object({ sceneId: z.uuid(), snapshots: z.array(snapshotView) })
})

export const saveSnapshot = defineAction({
  name: 'saveSnapshot',
  kind: 'write',
  description:
    'Guarda una instantánea de la escena en la campaña: sus fichas, sus puertas, su niebla a mano y lo dejado en el mapa (no la escena del mundo ni las criaturas en juego)',
  input: z.object({
    campaignId: z.uuid(),
    sceneId: sceneOrOpen,
    name: z.string().trim().min(1).max(80),
    thumbnail: z
      .string()
      .max(200_000)
      .regex(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/)
      .optional()
      .describe('Su miniatura, en data URL')
  }),
  output: snapshotView
})

export const restoreSnapshot = defineAction({
  name: 'restoreSnapshot',
  kind: 'players',
  description:
    'Vuelve a una instantánea: las fichas, las puertas, la niebla a mano y lo dejado en el mapa de su escena quedan como estaban (lo explorado se queda). Las fichas de quien ya no está en juego se saltan. Se deshace desde el historial',
  input: z.object({ campaignId: z.uuid(), snapshotId: z.uuid() }),
  output: z.object({
    sceneId: z.uuid(),
    tokens: z.int(),
    marks: z.int(),
    fog: z.int(),
    skipped: z.array(z.string()).describe('Los rótulos de las fichas que no se pudieron poner')
  })
})

export const deleteSnapshot = defineAction({
  name: 'deleteSnapshot',
  kind: 'delete',
  description: 'Borra una instantánea. Se deshace desde el historial',
  input: z.object({ snapshotId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const setMeasureOnScreen = defineAction({
  name: 'setMeasureOnScreen',
  kind: 'write',
  description: '«La tele ve lo que mides»: la medida en curso del máster va en vivo a la pantalla (o deja de ir)',
  input: z.object({ campaignId: z.uuid(), on: z.boolean() }),
  output: z.object({ measureOnScreen: z.boolean() })
})

/** La medida en curso, en vivo: un camino (line, con sus puntos de paso) o una forma de `a` a `b` */
export const liveMeasure = z.object({
  shape: z.enum(TEMPLATE_SHAPES),
  points: z.array(point).min(1).max(50),
  width: z.number().min(1).max(100_000).optional(),
  angle: z.number().min(1).max(360).optional()
})

export type LiveMeasure = z.infer<typeof liveMeasure>

/** La estela del láser: sus últimos puntos */
export const laserPoints = z.array(point).min(1).max(30)
