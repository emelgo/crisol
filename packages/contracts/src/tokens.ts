/**
 * Las fichas de la mesa y los encuentros (docs/specs/fichas.md): la ficha es dónde está un personaje o una criatura en
 * juego en una escena de una campaña; lo vital (PG, estados, hoja) es suyo. Un encuentro, unas criaturas del mundo
 * con su formación
 */
import { z } from 'zod'
import { defineAction } from './action.ts'

export const TOKEN_FACTIONS = ['group', 'hostile', 'neutral'] as const
/** Cuántas fichas se ponen o se mueven de una vez */
export const MAX_TOKENS_AT_ONCE = 100

/** El encuadre redondo de su imagen: un archivo del mundo (o, sin él, la imagen de su criatura) */
export const tokenImage = z.object({
  fileId: z.uuid().nullable(),
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
  zoom: z.number().min(0.2).max(10)
})

export const tokenCondition = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string().optional(),
  rounds: z.int().optional().describe('Las rondas que le quedan')
})

/** Lo que el máster ve de quien está en la ficha: lo suyo, leído de su personaje o de su criatura */
export const tokenActor = z.object({
  kind: z.enum(['character', 'creature']),
  id: z.uuid(),
  name: z.string(),
  img: z.string().nullable(),
  version: z.int().describe('La de su personaje o su criatura, para cambiar lo de su partida'),
  life: z.object({ value: z.number(), max: z.number(), temp: z.number() }).nullable(),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  conditions: z.array(tokenCondition)
})

export const tokenView = z.object({
  id: z.uuid(),
  sceneId: z.uuid(),
  x: z.number(),
  y: z.number(),
  size: z.number().describe('En casillas'),
  label: z.string(),
  faction: z.enum(TOKEN_FACTIONS),
  hidden: z.boolean(),
  image: tokenImage.nullable(),
  actor: tokenActor
})

export type TokenView = z.infer<typeof tokenView>

/** Cómo está, en palabras, lo que ve la pantalla de una criatura (como en el módulo 5) */
export const lifeWord = z.enum(['unhurt', 'hurt', 'bloodied', 'dying', 'down'])

/** Lo que la pantalla de la tele recibe de una ficha: ni PG, ni CA, ni hoja */
export const screenToken = z.object({
  id: z.uuid(),
  x: z.number(),
  y: z.number(),
  size: z.number(),
  label: z.string(),
  name: z.string(),
  faction: z.enum(TOKEN_FACTIONS),
  img: z.string().nullable(),
  image: tokenImage.nullable(),
  /** De las criaturas; null en los personajes (los jugadores ya saben cómo están) */
  state: lifeWord.nullable(),
  conditions: z.array(z.object({ name: z.string() }))
})

export type ScreenToken = z.infer<typeof screenToken>

const at = { x: z.number().min(-100_000).max(100_000), y: z.number().min(-100_000).max(100_000) }
/** Dónde: en píxeles de la imagen (x, y) o en una casilla (column, row, desde 0; en hexagonales, axiales) */
const where = {
  x: at.x.optional(),
  y: at.y.optional(),
  column: z.int().min(-1000).max(5000).optional(),
  row: z.int().min(-1000).max(5000).optional()
}
const placed = (p: {
  x?: number | undefined
  y?: number | undefined
  column?: number | undefined
  row?: number | undefined
}) => (p.x !== undefined && p.y !== undefined) || (p.column !== undefined && p.row !== undefined)
const placedMessage = { message: 'x e y, o column y row' }

export const placeTokens = defineAction({
  name: 'placeTokens',
  kind: 'write',
  description:
    'Pone fichas en una escena de la campaña (en píxeles de su imagen o en una casilla): personajes de la campaña, criaturas en juego o, con content, criaturas del compendio que se ponen en juego (count copias, o la única). Si ya tenía ficha en esa escena, la mueve',
  input: z.object({
    campaignId: z.uuid(),
    sceneId: z.uuid(),
    tokens: z
      .array(
        z.union([
          z.object({ characterId: z.uuid(), ...where }).refine(placed, placedMessage),
          z.object({ creatureId: z.uuid(), ...where }).refine(placed, placedMessage),
          z
            .object({
              content: z.object({
                key: z.string().min(1).max(100),
                count: z.int().min(1).max(20).optional(),
                unique: z.boolean().optional()
              }),
              ...where
            })
            .refine(placed, placedMessage)
        ])
      )
      .min(1)
      .max(MAX_TOKENS_AT_ONCE),
    hidden: z.boolean().optional().describe('Ponerlas ocultas a los jugadores')
  }),
  output: z.object({ tokens: z.array(tokenView) })
})

export const moveTokens = defineAction({
  name: 'moveTokens',
  kind: 'write',
  description:
    'Mueve unas fichas de la campaña (en píxeles de la imagen de su escena o a una casilla), en una sola operación',
  input: z.object({
    campaignId: z.uuid(),
    moves: z
      .array(z.object({ tokenId: z.uuid(), ...where }).refine(placed, placedMessage))
      .min(1)
      .max(MAX_TOKENS_AT_ONCE)
  }),
  output: z.object({ tokens: z.array(tokenView) })
})

export const updateToken = defineAction({
  name: 'updateToken',
  kind: 'write',
  description: 'Cambia cómo se ve una ficha: su rótulo, su bando, su tamaño en casillas, si está oculta o su imagen',
  input: z
    .object({
      tokenId: z.uuid(),
      label: z.string().trim().min(1).max(16).optional(),
      faction: z.enum(TOKEN_FACTIONS).optional(),
      size: z.number().min(0.25).max(10).optional(),
      hidden: z.boolean().optional(),
      image: tokenImage.nullable().optional()
    })
    .refine((i) => Object.keys(i).length > 1, { message: 'algo que cambiar' }),
  output: tokenView
})

export const removeTokens = defineAction({
  name: 'removeTokens',
  kind: 'write',
  description: 'Quita unas fichas del mapa (sus personajes y criaturas siguen en juego). Se deshace desde el historial',
  input: z.object({ campaignId: z.uuid(), tokenIds: z.array(z.uuid()).min(1).max(MAX_TOKENS_AT_ONCE) }),
  output: z.object({ removed: z.array(z.uuid()) })
})

export const encounterMember = z.object({
  key: z.string().min(1).max(100).describe('Su entrada del compendio'),
  unique: z.boolean(),
  at: z
    .array(z.object({ dx: z.number().min(-100).max(100), dy: z.number().min(-100).max(100) }))
    .min(1)
    .max(30)
    .describe('Dónde va cada copia, en casillas desde el punto donde se suelta')
})

export const encounterView = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  systemId: z.uuid().nullable(),
  name: z.string(),
  members: z.array(encounterMember)
})

export type EncounterView = z.infer<typeof encounterView>

export const listEncounters = defineAction({
  name: 'listEncounters',
  kind: 'read',
  description: 'Los encuentros de un mundo: sus criaturas (por su clave) con su formación',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ encounters: z.array(encounterView) })
})

export const saveEncounter = defineAction({
  name: 'saveEncounter',
  kind: 'write',
  description: 'Guarda un encuentro del mundo para un sistema (con encounterId, lo cambia): su nombre y sus criaturas',
  input: z.object({
    worldId: z.uuid(),
    encounterId: z.uuid().optional(),
    systemId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(80),
    members: z.array(encounterMember).min(1).max(30)
  }),
  output: encounterView
})

export const deleteEncounter = defineAction({
  name: 'deleteEncounter',
  kind: 'delete',
  description: 'Borra un encuentro del mundo. Se deshace desde el historial',
  input: z.object({ encounterId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const placeEncounter = defineAction({
  name: 'placeEncounter',
  kind: 'write',
  description:
    'Pone un encuentro en una escena de la campaña: sus criaturas entran en juego y se colocan en su formación desde ese punto. Lo que la campaña no tiene en su compendio se salta y se dice',
  input: z
    .object({ campaignId: z.uuid(), sceneId: z.uuid(), encounterId: z.uuid(), ...where })
    .refine(placed, placedMessage),
  output: z.object({ tokens: z.array(tokenView), skipped: z.array(z.string()) })
})
