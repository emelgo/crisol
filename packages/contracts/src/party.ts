/**
 * El inventario del grupo de una campaña (docs/specs/grupo.md): lo que es de todos (el botín, el carro, la bolsa
 * común), con sus contenedores y sus monedas. Lo ven y lo cambian todos los de la campaña; mover con un personaje, su
 * dueño o el máster
 */
import { z } from 'zod'
import { defineAction } from './action.ts'

const coins = z.record(z.string().max(60), z.int().min(0).max(1_000_000_000))

export const partyItem = z.object({
  id: z.string(),
  key: z.string().nullable().describe('Del compendio, su clave; escrito a mano, null (no lo lleva ningún personaje)'),
  name: z.string(),
  note: z.string().nullable(),
  quantity: z.int(),
  container: z.string().describe('El id de su contenedor («grupo», el de serie)')
})

export const party = z.object({
  version: z.int().describe('La que se leyó, para cambiarlo (0: aún vacío)'),
  containers: z
    .array(z.object({ id: z.string(), name: z.string().describe('El de serie, «grupo», sin nombre') }))
    .describe('Sus contenedores, con el de serie delante'),
  items: z.array(partyItem),
  coins: coins.describe('Las monedas del grupo, por su clave (po, pp…)')
})

export type Party = z.infer<typeof party>
export type PartyItem = z.infer<typeof partyItem>

export const getParty = defineAction({
  name: 'getParty',
  kind: 'read',
  description:
    'El inventario del grupo de una campaña: sus contenedores, sus objetos y sus monedas; las clases de monedas de su sistema; y los personajes con los que quien pide puede mover cosas (los suyos; el máster, todos), con sus monedas',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({
    party,
    coins: z
      .array(z.object({ key: z.string(), label: z.string() }))
      .describe('Las monedas del sistema (sin ellas, el grupo no tiene monedas)'),
    types: z.array(z.string()).describe('Los tipos del compendio que caben en el inventario'),
    characters: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        mine: z.boolean(),
        coins: coins
      })
    ),
    master: z.boolean().describe('Si quien pide es el máster: reparte las monedas'),
    moves: z
      .array(
        z.object({
          action: z.string(),
          details: z.record(z.string(), z.unknown()),
          by: z.string().nullable().describe('Quién lo hizo'),
          ai: z.boolean(),
          at: z.string()
        })
      )
      .describe('Lo último que ha cambiado en el grupo, de lo más reciente')
  })
})

export const updateParty = defineAction({
  name: 'updateParty',
  kind: 'players',
  description:
    'Cambia el inventario del grupo, con la versión que se leyó (PARTY_CHANGED si otro lo cambió): añadir algo del compendio (su clave) o escrito a mano (su nombre y una nota), con su cantidad y su contenedor; quitar (todo o parte); cambiar su nota, su nombre (lo escrito a mano) o su contenedor; crear, renombrar o quitar contenedores (lo de dentro pasa al de serie); o poner las monedas del grupo. Una cosa por vez',
  input: z.object({
    campaignId: z.uuid(),
    version: z.int().min(0),
    add: z
      .object({
        key: z.string().max(100).optional().describe('Del compendio de la campaña'),
        name: z.string().trim().min(1).max(200).optional().describe('Escrito a mano (sin key)'),
        note: z.string().max(500).optional(),
        quantity: z.int().min(1).max(100_000).default(1),
        container: z.string().max(60).optional()
      })
      .optional(),
    remove: z.object({ item: z.string().max(60), quantity: z.int().min(1).max(100_000).optional() }).optional(),
    edit: z
      .object({
        item: z.string().max(60),
        name: z.string().trim().min(1).max(200).optional(),
        note: z.string().max(500).optional(),
        container: z.string().max(60).optional()
      })
      .optional(),
    addContainer: z.object({ name: z.string().trim().min(1).max(100) }).optional(),
    renameContainer: z.object({ id: z.string().max(60), name: z.string().trim().min(1).max(100) }).optional(),
    removeContainer: z.object({ id: z.string().max(60) }).optional(),
    coins: coins.optional().describe('Las monedas del grupo, como quedan')
  }),
  output: z.object({ party })
})

const place = z.union([
  z.object({ party: z.string().max(60).describe('El id del objeto en el grupo') }),
  z.object({ character: z.uuid(), item: z.string().max(60).describe('El id de lo que lleva') })
])

export const moveItem = defineAction({
  name: 'moveItem',
  kind: 'players',
  description:
    'Mueve un objeto (todo o parte) entre el grupo y un personaje, entre dos contenedores del grupo o entre dos personajes, sin duplicarlo: sale de un sitio y entra en el otro a la vez. Con un personaje, solo su dueño o el máster. Lo escrito a mano se queda en el grupo',
  input: z.object({
    campaignId: z.uuid(),
    from: place,
    to: z.union([
      z.object({ container: z.string().max(60).describe('Un contenedor del grupo («grupo», el de serie)') }),
      z.object({ character: z.uuid() })
    ]),
    quantity: z.int().min(1).max(100_000).optional().describe('Sin ella, todo')
  }),
  output: z.object({ party })
})

export const moveCoins = defineAction({
  name: 'moveCoins',
  kind: 'players',
  description:
    'Pasa monedas entre el grupo y un personaje (su dueño o el máster): toParty, del personaje al grupo; si no, del grupo al personaje. Sin quedar en negativo',
  input: z.object({ campaignId: z.uuid(), character: z.uuid(), toParty: z.boolean(), coins }),
  output: z.object({ party })
})

export const splitCoins = defineAction({
  name: 'splitCoins',
  kind: 'write',
  description:
    'Reparte las monedas del grupo a partes iguales entre unos personajes de la campaña (solo el máster): las que se digan o, sin decirlas, todas. Lo que sobra se queda en el grupo',
  input: z.object({
    campaignId: z.uuid(),
    characters: z.array(z.uuid()).min(1).max(20),
    coins: z.array(z.string().max(60)).max(20).optional().describe('Qué monedas (po, pp…); sin ellas, todas')
  }),
  output: z.object({ party, each: coins.describe('Lo que recibe cada uno') })
})
