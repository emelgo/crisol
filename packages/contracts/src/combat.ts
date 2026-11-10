/**
 * El combate de una campaña (docs/specs/combate.md): uno a la vez, en una escena. La iniciativa, los turnos y las
 * rondas los lleva el servidor; al empezar el turno de alguien caducan sus estados y se tiran sus recargas
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { MAX_TOKENS_AT_ONCE, tokenCondition } from './tokens.ts'

/** Lo que el máster ve de un combatiente */
export const combatantView = z.object({
  id: z.uuid(),
  kind: z.enum(['character', 'creature']),
  actorId: z.uuid().describe('Su personaje o su criatura en juego'),
  name: z.string(),
  img: z.string().nullable(),
  tokenId: z.uuid().nullable().describe('Su ficha en la escena del combate, si la tiene'),
  initiative: z.number().nullable().describe('null: aún sin tirar'),
  modifier: z.number().nullable().describe('Lo que suma a su tirada: deshace los empates'),
  group: z.string().nullable().describe('Los de un mismo grupo (las copias de una criatura) tienen un turno'),
  sort: z.int().nullable().describe('Su orden a mano entre los empatados'),
  generic: z.boolean().describe('Una copia de una criatura: se va de juego al acabar'),
  defeated: z.boolean().describe('Fuera de combate (a 0)'),
  hidden: z.boolean().describe('Oculto a los jugadores (él o su ficha)'),
  active: z.boolean().describe('Es su turno (o el de su grupo)'),
  life: z.object({ value: z.number(), max: z.number(), temp: z.number() }).nullable(),
  conditions: z.array(tokenCondition),
  controllers: z.array(z.string()).optional().describe('Las cuentas de los jugadores que lo llevan')
})

export type CombatantView = z.infer<typeof combatantView>

export const combatView = z.object({
  id: z.uuid(),
  campaignId: z.uuid(),
  sceneId: z.uuid().nullable(),
  round: z.int().describe('0: antes de empezar (se tira la iniciativa); el primer «siguiente» empieza la 1'),
  turnId: z.uuid().nullable().describe('El combatiente cuyo turno es (el primero de su grupo)'),
  skipDefeated: z.boolean().describe('Saltar los turnos de quien está fuera de combate'),
  initiativeRoll: z
    .string()
    .nullable()
    .describe('La tirada de iniciativa del sistema de la campaña (su nombre); null: la iniciativa se escribe'),
  combatants: z.array(combatantView).describe('En el orden en que actúan')
})

export type CombatView = z.infer<typeof combatView>

/** Lo que la pantalla de la tele ve de un combatiente: ni su vida, ni la iniciativa de las criaturas */
export const screenCombatant = z.object({
  id: z.uuid(),
  kind: z.enum(['character', 'creature']),
  tokenId: z.uuid().nullable(),
  name: z.string(),
  img: z.string().nullable(),
  initiative: z.number().nullable().describe('La de los personajes; la de las criaturas, nunca'),
  active: z.boolean(),
  defeated: z.boolean(),
  /** Las cuentas de los jugadores que lo llevan: en su turno, pasan turno (docs/specs/mover-jugadores.md) */
  controllers: z.array(z.string()).optional()
})

/** La franja de turnos de la pantalla: la ronda y el orden, sin los ocultos */
export const screenCombat = z.object({
  round: z.int(),
  combatants: z.array(screenCombatant)
})

export type ScreenCombat = z.infer<typeof screenCombat>

/** Lo que pasó al empezar un turno: para avisar al máster */
export const turnStarted = z.object({
  names: z.array(z.string()).describe('De quién es el turno'),
  expired: z.array(z.object({ name: z.string(), condition: z.string() })).describe('Los estados que se fueron'),
  recharged: z.array(z.object({ name: z.string(), action: z.string() })).describe('Las recargas que volvieron'),
  restored: z
    .array(z.object({ name: z.string(), resource: z.string() }))
    .describe('Lo de las acciones legendarias, repuesto')
})

export type TurnStarted = z.infer<typeof turnStarted>

const ids = z.array(z.uuid()).min(1).max(MAX_TOKENS_AT_ONCE)
const combatOnly = z.object({ campaignId: z.uuid() })

export const getCombat = defineAction({
  name: 'getCombat',
  kind: 'read',
  description:
    'El combate de una campaña, si hay uno: la ronda, de quién es el turno y los combatientes en su orden, con su iniciativa, su vida y sus estados',
  input: combatOnly,
  output: z.object({ combat: combatView.nullable() })
})

export const startCombat = defineAction({
  name: 'startCombat',
  kind: 'write',
  description:
    'Empieza un combate en la escena abierta de la campaña (uno a la vez): con unas fichas (tokenIds) o con todas las de la escena. Las copias de una criatura van en grupo (un turno). Empieza en la ronda 0: luego, tirar la iniciativa y pasar al primer turno',
  input: z.object({
    campaignId: z.uuid(),
    tokenIds: ids.optional(),
    skipDefeated: z.boolean().optional().describe('Saltar a quien esté a 0 (por defecto, sí)')
  }),
  output: combatView
})

export const addCombatants = defineAction({
  name: 'addCombatants',
  kind: 'write',
  description:
    'Mete en el combate unas fichas de su escena o personajes y criaturas en juego de la campaña (sin ficha). Los que ya están no se repiten',
  input: z
    .object({
      campaignId: z.uuid(),
      tokenIds: ids.optional(),
      characterIds: ids.optional(),
      creatureIds: ids.optional()
    })
    .refine((i) => i.tokenIds || i.characterIds || i.creatureIds, { message: 'a quién meter' }),
  output: combatView
})

export const removeCombatants = defineAction({
  name: 'removeCombatants',
  kind: 'write',
  description:
    'Saca del combate a unos combatientes (siguen en juego y en el mapa). Si tenían el turno, pasa al siguiente',
  input: z.object({ campaignId: z.uuid(), combatantIds: ids }),
  output: combatView
})

export const rollInitiative = defineAction({
  name: 'rollInitiative',
  kind: 'write',
  description:
    'Tira la iniciativa con la tirada del sistema de la campaña, al registro (las de las criaturas, ocultas): de todos, de las criaturas, de los que aún no la tienen (unrolled) o de unos (combatantIds). Un grupo tira una vez para todos. Sin tirada de iniciativa en el sistema, NO_INITIATIVE_ROLL: se escribe con setInitiative',
  input: z.object({
    campaignId: z.uuid(),
    who: z.enum(['all', 'creatures', 'unrolled']).optional().describe('Por defecto, todos'),
    combatantIds: ids.optional()
  }),
  output: z.object({
    combat: combatView,
    rolls: z.array(
      z.object({ combatantIds: z.array(z.uuid()), name: z.string(), total: z.number(), rollId: z.uuid() })
    ),
    failed: z.array(z.object({ combatantId: z.uuid(), name: z.string(), reason: z.string() }))
  })
})

export const setInitiative = defineAction({
  name: 'setInitiative',
  kind: 'write',
  description:
    'Escribe la iniciativa de unos combatientes (la que dice un jugador, o sin tirada en el sistema); null la borra. En un grupo, la de todos',
  input: z.object({
    campaignId: z.uuid(),
    values: z
      .array(
        z.object({
          combatantId: z.uuid(),
          initiative: z.number().min(-1000).max(1000).nullable(),
          modifier: z.number().min(-1000).max(1000).nullable().optional()
        })
      )
      .min(1)
      .max(MAX_TOKENS_AT_ONCE)
  }),
  output: combatView
})

export const orderCombatants = defineAction({
  name: 'orderCombatants',
  kind: 'write',
  description:
    'El orden a mano de los combatientes (los ids, del primero al último): deshace los empates que quedan tras la iniciativa y el modificador',
  input: z.object({ campaignId: z.uuid(), combatantIds: ids }),
  output: combatView
})

export const groupCombatants = defineAction({
  name: 'groupCombatants',
  kind: 'write',
  description:
    'Junta unos combatientes en un grupo (un turno y una iniciativa para todos) o los separa (together false: cada uno, el suyo)',
  input: z.object({ campaignId: z.uuid(), combatantIds: ids, together: z.boolean() }),
  output: combatView
})

export const updateCombat = defineAction({
  name: 'updateCombat',
  kind: 'write',
  description: 'Cambia cómo va el combate: si salta los turnos de quien está a 0',
  input: z.object({ campaignId: z.uuid(), skipDefeated: z.boolean() }),
  output: combatView
})

export const nextTurn = defineAction({
  name: 'nextTurn',
  kind: 'write',
  description:
    'Pasa al turno siguiente (desde la ronda 0, empieza la 1; al dar la vuelta, otra ronda). Al empezar el turno de alguien, sus estados con rondas pierden una y se van los que llegan a cero, se tiran sus recargas y se reponen sus legendarias: lo dice started',
  input: combatOnly,
  output: z.object({ combat: combatView, started: turnStarted.nullable() })
})

export const previousTurn = defineAction({
  name: 'previousTurn',
  kind: 'write',
  description: 'Vuelve al turno anterior (sin caducar nada: para deshacer lo que pasó al empezarlo, el historial)',
  input: combatOnly,
  output: combatView
})

export const endCombat = defineAction({
  name: 'endCombat',
  kind: 'delete',
  description:
    'Acaba el combate y quita de juego, con sus fichas, las copias a 0 (remove defeated, por defecto), todas las copias (generic) o ninguna (none). Las únicas siguen. Una operación que se deshace desde el historial',
  input: z.object({ campaignId: z.uuid(), remove: z.enum(['defeated', 'generic', 'none']).optional() }),
  output: z.object({ removed: z.array(z.uuid()).describe('Las criaturas que se quitaron de juego') })
})
