import { z } from 'zod'
import { defineAction } from './action.ts'

/** Lo que se ve de un personaje en su tarjeta: su línea («Enano · Guerrero 4»), su nivel y unos valores de su hoja */
export const characterSummary = z.object({
  line: z.string().optional(),
  level: z.int().optional(),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })).optional()
})

/** Un personaje de una campaña, sin sus elecciones: lo que sale en la lista */
export const characterCard = z.object({
  id: z.uuid(),
  campaignId: z.uuid(),
  owner: z.object({ id: z.string(), name: z.string() }).nullable().describe('Quién lo juega'),
  name: z.string(),
  system: z.string().describe('El sistema con el que se hizo'),
  status: z.enum(['creating', 'ready']).describe('creating: en creación, le falta algo de lo que pide su sistema'),
  summary: characterSummary,
  version: z.int(),
  updatedAt: z.iso.datetime()
})

/** Uno entero: con sus elecciones (la verdad: la hoja se calcula de ellas) y lo de la partida */
export const character = characterCard.extend({
  build: z.record(z.string(), z.unknown()).describe('Sus elecciones: lo elegido en cada paso y en cada decisión'),
  play: z.record(z.string(), z.unknown()).describe('Lo de la partida: PG gastados, recursos usados, notas')
})

export type CharacterCard = z.infer<typeof characterCard>
export type Character = z.infer<typeof character>

const name = z.string().trim().min(1).max(120)
/** Las elecciones y lo de la partida: un JSON de hasta 256 KB cada uno */
const blob = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 256 * 1024, 'Demasiado grande: como mucho, 256 KB')

export const listCharacters = defineAction({
  name: 'listCharacters',
  kind: 'read',
  description:
    'Los personajes de una campaña: el máster ve todos; un jugador, los suyos. Con su dueño, su estado (en creación o listo) y su resumen',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({ characters: z.array(characterCard) })
})

export const getCharacter = defineAction({
  name: 'getCharacter',
  kind: 'read',
  description: 'Un personaje entero: sus elecciones y lo de la partida. Lo ve su dueño y el máster de su campaña',
  input: z.object({ characterId: z.uuid() }),
  output: z.object({ character })
})

export const createCharacter = defineAction({
  name: 'createCharacter',
  kind: 'players',
  description:
    'Crea un personaje en una campaña (con su sistema), en creación. Su dueño es quien lo crea; el máster puede hacerlo para otro miembro de la campaña (ownerId)',
  input: z.object({
    campaignId: z.uuid(),
    name: name.optional().describe('Sin nombre, «Sin nombre»'),
    ownerId: z.string().min(1).max(100).optional().describe('Solo el máster: el miembro que lo juega')
  }),
  output: z.object({ character })
})

export const updateCharacter = defineAction({
  name: 'updateCharacter',
  kind: 'players',
  description:
    'Cambia un personaje con la versión que se leyó: su nombre, sus elecciones, lo de la partida o (el máster) su dueño',
  input: z.object({
    characterId: z.uuid(),
    version: z.int().min(1),
    name: name.optional(),
    build: blob.optional(),
    play: blob.optional(),
    ownerId: z.string().min(1).max(100).nullable().optional().describe('Solo el máster: quién lo juega'),
    confirm: z
      .enum(['created', 'level'])
      .optional()
      .describe('created: termina de crearlo; level: confirma su nivel. Los dos dejan una versión suya')
  }),
  output: z.object({ character })
})

export const deleteCharacter = defineAction({
  name: 'deleteCharacter',
  kind: 'delete',
  description: 'Borra un personaje con sus versiones (se deshace desde el historial)',
  input: z.object({ characterId: z.uuid() }),
  output: z.object({ ok: z.literal(true) })
})

/** Una versión de un personaje: al terminar de crearlo («Creado · Nivel 1») o al confirmar un nivel («Nivel 5») */
export const characterVersion = z.object({
  id: z.uuid(),
  kind: z.enum(['created', 'level']),
  level: z.int(),
  name: z.string(),
  summary: characterSummary,
  createdAt: z.iso.datetime()
})

export const listCharacterVersions = defineAction({
  name: 'listCharacterVersions',
  kind: 'read',
  description: 'Las versiones de un personaje, de la más nueva a la más vieja',
  input: z.object({ characterId: z.uuid() }),
  output: z.object({ versions: z.array(characterVersion) })
})

export const restoreCharacterVersion = defineAction({
  name: 'restoreCharacterVersion',
  kind: 'players',
  description:
    'Vuelve un personaje a como era en una de sus versiones (con la versión del personaje que se leyó). Se deshace desde el historial',
  input: z.object({ characterId: z.uuid(), versionId: z.uuid(), version: z.int().min(1) }),
  output: z.object({ character })
})
