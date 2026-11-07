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

export const inspectFoundryScenes = defineAction({
  name: 'inspectFoundryScenes',
  kind: 'read',
  description:
    'Lee las escenas y las aventuras de un zip de Foundry VTT sin guardar nada: cada escena con su miniatura, su imagen, su rejilla y cuánto trae, y si ya se trajo a este mundo',
  input: z.object({ worldId: z.uuid(), zip }),
  output: z.object({
    module: z.object({ id: z.string(), title: z.string(), version: z.string().nullable() }),
    scenes: z.array(foundrySceneSummary),
    adventures: z.array(foundryAdventureSummary)
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
    'Trae a un mundo escenas de un zip de Foundry VTT: cada una, una página nueva (bajo parentId) con su pestaña «Escena» (su rejilla, sus muros y puertas, sus luces y su oscuridad); sus fichas, como criaturas preparadas si su criatura está en el compendio (del sistema o del mundo). Una aventura, con su página y sus diarios como subpáginas. Lo ya traído se cambia en su sitio. La imagen de cada escena se pone después con setSceneImage',
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
      systemId: z
        .uuid()
        .optional()
        .describe('El sistema en cuyo compendio se buscan las criaturas (sin él, los de sus campañas)')
    })
    .refine((input) => input.scenes.length + input.adventures.length > 0, { message: 'scenes o adventures' }),
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
    /** Lo que no se trae (regiones, tiles, sonidos…), en frases */
    notes: z.array(z.string())
  })
})
