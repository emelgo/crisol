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

/** Una opción de un paso o de una decisión: si vale y, si no, por qué */
const buildOption = z.object({
  value: z.string(),
  label: z.string(),
  available: z.boolean(),
  reason: z.string().optional()
})
const stepBase = {
  key: z.string(),
  label: z.string(),
  help: z.string().nullable(),
  creation: z.boolean().describe('Solo al crearlo'),
  pending: z.int().describe('Cuántas cosas le faltan (lo marcado con (!))')
}

/** Un paso del creador con lo suyo: lo elegido y lo que se puede elegir, los métodos de las puntuaciones o los campos */
export const characterStep = z.discriminatedUnion('kind', [
  z.object({
    ...stepBase,
    kind: z.literal('content'),
    type: z.string(),
    min: z.int(),
    max: z.int(),
    levels: z.boolean().describe('Cada uno lleva su nivel (las clases)'),
    picks: z.array(
      z.object({ id: z.string(), key: z.string(), level: z.int().nullable(), name: z.string(), missing: z.boolean() })
    ),
    options: z.array(buildOption)
  }),
  z.object({
    ...stepBase,
    kind: z.literal('scores'),
    set: z.string(),
    field: z.string(),
    elements: z.array(z.object({ key: z.string(), label: z.string() })),
    methods: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        kind: z.enum(['array', 'pointbuy', 'roll', 'manual']),
        values: z.array(z.int()).optional(),
        budget: z.int().optional(),
        costs: z.record(z.string(), z.int()).optional(),
        formula: z.string().optional(),
        min: z.int().optional(),
        max: z.int().optional()
      })
    )
  }),
  z.object({
    ...stepBase,
    kind: z.literal('fields'),
    fields: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        kind: z.string(),
        options: z.array(z.object({ value: z.string(), label: z.string() })).optional()
      })
    )
  }),
  z.object({ ...stepBase, kind: z.literal('summary') })
])

/** Algo que decidir de lo concedido: cuántos, de qué opciones, lo elegido y si falta */
export const characterDecision = z.object({
  id: z.string(),
  step: z.string(),
  label: z.string(),
  from: z.object({ id: z.string(), name: z.string() }),
  level: z.int().nullable(),
  count: z.int(),
  repeat: z.boolean(),
  options: z.array(buildOption),
  chosen: z.array(z.string()),
  pending: z.boolean()
})

/** El personaje montado de sus elecciones: sus pasos, lo que hay que decidir, su resumen y su hoja calculada */
export const characterState = z.object({
  steps: z.array(characterStep),
  decisions: z.array(characterDecision),
  level: z.int(),
  complete: z.boolean().describe('Tiene lo que su sistema pide para terminar de crearlo'),
  missing: z.array(z.string()).describe('Lo elegido que ya no está en el contenido de la campaña'),
  summary: z.object({
    line: z.string(),
    level: z.int(),
    stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() }))
  }),
  sheet: z.record(z.string(), z.unknown()).describe('Su hoja calculada'),
  fields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        kind: z.string(),
        elements: z.array(z.object({ key: z.string(), label: z.string(), abbr: z.string().optional() })).optional(),
        columns: z.array(z.object({ key: z.string(), label: z.string(), kind: z.string() })).optional(),
        of: z.array(z.string()).optional().describe('Los tipos que lleva (un campo de objetos)')
      })
    )
    .describe('Los campos del personaje con sus nombres, para pintar su ficha'),
  items: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      from: z.string().nullable(),
      level: z.int().nullable().describe('El nivel en que entra (lo concedido)'),
      key: z.string().nullable().describe('Su clave en el contenido')
    })
  )
})

export type CharacterState = z.infer<typeof characterState>

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
  description:
    'Un personaje entero: sus elecciones, lo de la partida y su estado (sus pasos con lo que se puede elegir, lo que falta por decidir con sus opciones, su resumen y su hoja calculada). Lo ve su dueño y el máster de su campaña',
  input: z.object({ characterId: z.uuid() }),
  output: z.object({ character, state: characterState })
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
  output: z.object({ character, state: characterState })
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
  output: z.object({ character, state: characterState })
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
  output: z.object({ character, state: characterState })
})
