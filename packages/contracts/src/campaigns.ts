import { z } from 'zod'
import { defineAction } from './action.ts'
import { member } from './members.ts'
import { world, worldColor, worldCover } from './worlds.ts'

const campaignName = z.string().trim().min(1).max(120)
const campaignDescription = z.string().trim().max(280)

/** Lo que una campaña elige de su sistema: sus fuentes, qué se ve de lo repetido, el idioma del contenido y sus ajustes */
export const systemChoices = z.object({
  sources: z.array(z.string().max(60)).max(50),
  // De lo que está en las dos ediciones: solo lo más nuevo o las dos versiones (sin decirlo, solo lo más nuevo)
  duplicates: z.enum(['newest', 'both']).optional(),
  language: z.enum(['es', 'en']),
  settings: z.record(z.string().max(60), z.unknown())
})

/** Al elegirlas, lo que falta toma su valor inicial (todas las fuentes, el primer idioma, el de cada ajuste) */
const choicesInput = systemChoices.partial()
const systemInput = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .nullable()
  .describe('Su sistema de reglas: el id de uno de serie (blank) o el de uno de la cuenta (listSystems); null, ninguno')

/** Una campaña tal como la ve la cuenta que lo pide. Se ve como un mundo: descripción, color y portada */
export const campaign = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string(),
  description: z.string(),
  color: worldColor.nullable(),
  cover: worldCover.nullable(),
  role: z.enum(['master', 'player']),
  version: z.number().int(),
  /** Su sistema de reglas (ADR-0011), con su tirada por defecto y su regla de críticos; sin él, null */
  system: z
    .object({
      id: z.string(),
      name: z.string(),
      defaultRoll: z.string().nullable(),
      critical: z.enum(['none', 'd20', 'doubles', 'under'])
    })
    .nullable()
    .optional(),
  systemChoices: systemChoices.nullable().optional(),
  /** Si parte de lo que sabe el mundo (ADR-0017); si no, empezó de cero */
  knowsWorld: z.boolean().optional(),
  /** Los tipos del compendio que no ven sus jugadores (solo para el máster) */
  hiddenTypes: z.array(z.string()).optional()
})

export type Campaign = z.infer<typeof campaign>

export const listCampaigns = defineAction({
  name: 'listCampaigns',
  kind: 'read',
  description: 'Campañas de un mundo que ve la cuenta, con su rol en cada una',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ campaigns: z.array(campaign) })
})

export const createCampaign = defineAction({
  name: 'createCampaign',
  kind: 'write',
  description: 'Crea una campaña en un mundo; quien la crea queda de máster. Con su sistema de reglas, si se da',
  input: z.object({
    worldId: z.uuid(),
    name: campaignName,
    system: systemInput.optional(),
    systemChoices: choicesInput.optional(),
    knowledge: z
      .discriminatedUnion('start', [
        z.object({ start: z.literal('world') }),
        z.object({ start: z.literal('none') }),
        z.object({ start: z.literal('campaign'), campaignId: z.uuid() })
      ])
      .optional()
      .describe(
        'Lo que saben los jugadores al empezar: lo que sabe el mundo (world, por defecto), nada (none) o lo mismo que otra campaña del mundo (campaign, una copia)'
      )
  }),
  output: campaign
})

export const renameCampaign = defineAction({
  name: 'renameCampaign',
  kind: 'write',
  description: 'Cambia el nombre de una campaña',
  input: z.object({ campaignId: z.uuid(), name: campaignName }),
  output: campaign
})

export const updateCampaign = defineAction({
  name: 'updateCampaign',
  kind: 'write',
  description:
    'Cambia una campaña: cómo se ve en su tarjeta (nombre, descripción de una línea, color de los fijos o #rrggbb, que tiñe sutil el contorno, o portada: una imagen de su mundo o común), su sistema de reglas (system) y lo que elige de él (systemChoices: fuentes, idioma del contenido y ajustes). Solo lo que se pase; null quita el color, la portada o el sistema',
  input: z
    .object({
      campaignId: z.uuid(),
      name: campaignName.optional(),
      description: campaignDescription.optional(),
      color: worldColor.nullable().optional(),
      cover: worldCover.nullable().optional(),
      system: systemInput.optional(),
      systemChoices: choicesInput.optional().describe('Lo que se elige de su sistema; lo que no se dé, como estaba'),
      knowsWorld: z.boolean().optional().describe('Si parte de lo que sabe el mundo (ADR-0017)'),
      hiddenTypes: z
        .array(z.string().trim().min(1).max(100))
        .max(200)
        .optional()
        .describe('Los tipos del compendio del sistema que no ven sus jugadores (sus claves); [] los enseña todos')
    })
    .refine(
      (input) =>
        input.name !== undefined ||
        input.description !== undefined ||
        input.color !== undefined ||
        input.cover !== undefined ||
        input.system !== undefined ||
        input.systemChoices !== undefined ||
        input.knowsWorld !== undefined ||
        input.hiddenTypes !== undefined,
      { message: 'name, description, color, cover, system, systemChoices, knowsWorld o hiddenTypes' }
    ),
  output: campaign
})

export const listWorldsWithCampaigns = defineAction({
  name: 'listWorldsWithCampaigns',
  kind: 'read',
  description:
    'Mundos de la cuenta, cada uno con las campañas que ve (el máster, todas; un jugador, las suyas) y su rol en cada uno',
  input: z.object({}),
  output: z.object({ worlds: z.array(world.extend({ campaigns: z.array(campaign) })) })
})

export const getCampaign = defineAction({
  name: 'getCampaign',
  kind: 'read',
  description: 'Una campaña con su mundo, el rol de la cuenta en ella y quiénes están (el máster primero)',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({
    campaign,
    world: z.object({ id: z.uuid(), name: z.string() }),
    members: z.array(member)
  })
})
