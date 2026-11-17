/**
 * La pantalla del máster (docs/specs/modulo-8-10-campana.md, decisión 24): el cajón G de la Mesa, con los statblocks de
 * las criaturas, los personajes de la escena, una nota fijada y las tablas aleatorias del mundo a mano. Lo elegido se
 * guarda en el servidor por campaña y escena: en otro aparato sale igual. Las tablas se tiran con rollOnTable (con
 * visibility hidden, el resultado va oculto al registro)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'

export const gmScreen = z.object({
  note: z.uuid().nullable().describe('La página fijada (null: ninguna)'),
  statblocks: z.boolean(),
  characters: z.boolean(),
  tables: z.array(z.uuid()).max(20).describe('Las tablas aleatorias elegidas, por su pestaña')
})

export type GmScreen = z.infer<typeof gmScreen>

export const setGmScreen = defineAction({
  name: 'setGmScreen',
  kind: 'write',
  description:
    'Cambia la pantalla del máster de una campaña en una escena que ya ha abierto (sin sceneId, la abierta): la página fijada, si salen los statblocks y los personajes, y las tablas aleatorias del mundo elegidas (sus pestañas). Lo que no se pase se queda',
  input: z.object({
    campaignId: z.uuid(),
    sceneId: z.uuid().optional(),
    note: z.uuid().nullable().optional(),
    statblocks: z.boolean().optional(),
    characters: z.boolean().optional(),
    tables: z.array(z.uuid()).max(20).optional()
  }),
  output: z.object({ sceneId: z.uuid(), gmScreen })
})

export const listRandomTables = defineAction({
  name: 'listRandomTables',
  kind: 'read',
  description:
    'Las tablas aleatorias de un mundo (las pestañas «Tabla» de sus páginas), con su página: para elegirlas en la pantalla del máster',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({
    tables: z.array(z.object({ tabId: z.uuid(), name: z.string(), pageId: z.uuid(), pageTitle: z.string() }))
  })
})
