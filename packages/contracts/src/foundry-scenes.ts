/**
 * Traer a un mundo las escenas de un zip de Foundry VTT (docs/specs/escenas-foundry.md): las de sus paquetes de escenas
 * y las de sus aventuras (con sus diarios como páginas). La web sube solo esos paquetes; las imágenes las saca ella del
 * zip y las trocea con la escena ya creada
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { FOUNDRY_ZIP_BYTES } from './foundry.ts'
import { SCENE_GRID_TYPES } from './scenes.ts'

const zip = z
  .base64()
  .max(Math.ceil(FOUNDRY_ZIP_BYTES / 3) * 4)
  .describe('El zip con su manifiesto y sus paquetes de escenas o aventuras, en base64 (como mucho, 30 MB)')

/** Lo ya traído antes: dónde está */
const existing = z.object({ sceneId: z.uuid().nullable(), pageId: z.uuid(), pageTitle: z.string() }).nullable()

export const foundrySceneSummary = z.object({
  pack: z.string(),
  /** El id de la escena en Foundry (con varias plantas, «escena.planta») */
  id: z.string(),
  name: z.string(),
  /** La aventura en la que viene, si viene en una */
  adventure: z.string().nullable(),
  thumb: z.string().nullable().describe('La ruta de su miniatura en Foundry'),
  background: z.string().nullable().describe('La ruta de su imagen en Foundry'),
  width: z.int(),
  height: z.int(),
  grid: z.enum(SCENE_GRID_TYPES),
  walls: z.int(),
  doors: z.int(),
  lights: z.int(),
  tokens: z.int(),
  notes: z.int(),
  existing
})

export type FoundrySceneSummary = z.infer<typeof foundrySceneSummary>

export const foundryAdventureSummary = z.object({
  pack: z.string(),
  id: z.string(),
  name: z.string(),
  img: z.string().nullable(),
  scenes: z.int(),
  journals: z.int(),
  actors: z.int(),
  existing
})

export type FoundryAdventureSummary = z.infer<typeof foundryAdventureSummary>

/** Una lista de sonido del zip (docs/specs/sonido-foundry.md): de un paquete de listas o de dentro de una aventura */
export const foundryPlaylistSummary = z.object({
  pack: z.string(),
  id: z.string(),
  name: z.string(),
  adventure: z.string().nullable().describe('La aventura en la que viene (se trae con ella)'),
  kind: z.enum(['ambient', 'effects']),
  mode: z.enum(['sequential', 'random', 'simultaneous', 'soundboard']),
  tracks: z.int(),
  existing: z.object({ playlistId: z.uuid(), name: z.string() }).nullable()
})

export type FoundryPlaylistSummary = z.infer<typeof foundryPlaylistSummary>

/**
 * Un audio que viene (o debería venir) en el zip, por su ruta de Foundry: quién lo usa («paquete/id» de las escenas,
 * aventuras y listas) y, si ya se subió a este mundo, su archivo
 */
export const foundryAudio = z.object({
  path: z.string(),
  usedBy: z.array(z.string()),
  fileId: z.uuid().nullable()
})

/** Un sonido que no se pudo traer, y por qué */
export const foundryMissingAudio = z.object({
  name: z.string().describe('La pista o el sonido (con su lista o su escena)'),
  path: z.string(),
  reason: z
    .enum(['core', 'outside', 'not-in-zip', 'empty', 'youtube'])
    .describe(
      'core: un sonido de serie de Foundry; outside: de una carpeta que no viene en el zip; not-in-zip: debería venir y no está; empty: sin archivo; youtube: un vídeo no suena en el mapa'
    )
})

export const inspectFoundryScenes = defineAction({
  name: 'inspectFoundryScenes',
  kind: 'read',
  description:
    'Lee las escenas y las aventuras de un zip de Foundry VTT sin guardar nada: cada escena con su miniatura, su imagen, su rejilla y cuánto trae, y si ya se trajo a este mundo',
  input: z.object({ worldId: z.uuid(), zip }),
  output: z.object({
    module: z.object({ id: z.string(), title: z.string(), version: z.string().nullable() }),
    scenes: z.array(foundrySceneSummary),
    adventures: z.array(foundryAdventureSummary),
    playlists: z.array(foundryPlaylistSummary),
    audio: z.array(foundryAudio)
  })
})

/** Una ficha de la escena que no queda preparada, y por qué */
export const foundryMissing = z.object({
  name: z.string(),
  reason: z.enum(['not-found', 'no-actor', 'character'])
})

export const importFoundryScenes = defineAction({
  name: 'importFoundryScenes',
  kind: 'write',
  description:
    'Trae a un mundo escenas de un zip de Foundry VTT: cada una, una página nueva (bajo parentId) con su pestaña «Escena» (su rejilla, sus muros y puertas, sus luces, sus sonidos y su oscuridad); sus fichas, como criaturas preparadas si su criatura está en el compendio (del sistema o del mundo). Una aventura, con su página, sus diarios como subpáginas y sus listas de sonido; también las listas de sus paquetes de listas y las que enlazan sus escenas. Los audios del zip se suben antes al mundo (audio); las direcciones se guardan como tales y lo que no viene en el zip se dice en missingAudio. Lo ya traído se cambia en su sitio. La imagen de cada escena se pone después con setSceneImage',
  input: z
    .object({
      worldId: z.uuid(),
      zip,
      parentId: z.uuid().nullable().describe('Dónde van las páginas nuevas; null, en el primer nivel'),
      scenes: z
        .array(z.object({ pack: z.string().min(1).max(200), id: z.string().min(1).max(100) }))
        .max(200)
        .default([]),
      adventures: z
        .array(z.object({ pack: z.string().min(1).max(200), id: z.string().min(1).max(100) }))
        .max(20)
        .default([]),
      playlists: z
        .array(z.object({ pack: z.string().min(1).max(200), id: z.string().min(1).max(100) }))
        .max(200)
        .default([])
        .describe('Las listas de sus paquetes de listas (las de una aventura vienen con ella)'),
      audio: z
        .array(
          z.object({
            path: z.string().min(1).max(1000).describe('La ruta de Foundry o la dirección'),
            fileId: z.uuid().optional().describe('El audio del zip ya subido al mundo'),
            duration: z
              .number()
              .positive()
              .max(24 * 3600)
              .optional()
              .describe('Lo que dura, en segundos (lo mide el navegador)')
          })
        )
        .max(2000)
        .default([])
        .describe('Los audios del zip ya subidos al mundo y lo que dura cada uno'),
      systemId: z
        .uuid()
        .optional()
        .describe('El sistema en cuyo compendio se buscan antes las criaturas (después, en los de sus campañas)')
    })
    .refine((input) => input.scenes.length + input.adventures.length + input.playlists.length > 0, {
      message: 'scenes, adventures o playlists'
    }),
  output: z.object({
    scenes: z.array(
      z.object({
        id: z.string(),
        sceneId: z.uuid(),
        tabId: z.uuid(),
        pageId: z.uuid(),
        name: z.string(),
        background: z.string().nullable(),
        width: z.int(),
        height: z.int(),
        updated: z.boolean().describe('Ya estaba: se cambió en su sitio'),
        prepared: z.int(),
        missing: z.array(foundryMissing)
      })
    ),
    pages: z.array(
      z.object({ pageId: z.uuid(), title: z.string(), kind: z.enum(['adventure', 'journal']), updated: z.boolean() })
    ),
    playlists: z.array(z.object({ playlistId: z.uuid(), name: z.string(), tracks: z.int(), updated: z.boolean() })),
    /** Los sonidos que no se pudieron traer, y por qué */
    missingAudio: z.array(foundryMissingAudio),
    /** Lo que no se trae (regiones, tiles, sonidos…), en frases */
    notes: z.array(z.string())
  })
})
