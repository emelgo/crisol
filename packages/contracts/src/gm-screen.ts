/**
 * La pantalla del máster (docs/specs/modulo-8-10-campana.md, decisiones 24 y 33): el cajón G de la Mesa, en cuatro
 * columnas que se encienden y apagan: los statblocks de las criaturas, los personajes de la escena, una nota fijada y
 * las tablas aleatorias del mundo a mano. Lo elegido se guarda en el servidor por campaña y escena: en otro aparato sale
 * igual. Las tablas se tiran con rollOnTable (con visibility hidden, oculta al registro; o a la vista de todos)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'

/** Las cuatro columnas: si se enseña cada una */
export const gmScreenColumns = z.object({
  statblocks: z.boolean(),
  characters: z.boolean(),
  note: z.boolean(),
  tables: z.boolean()
})

export const gmScreen = z.object({
  columns: gmScreenColumns,
  note: z.uuid().nullable().describe('La página fijada (null: ninguna)'),
  tables: z.array(z.uuid()).max(20).describe('Las tablas aleatorias elegidas, por su pestaña')
})

export type GmScreen = z.infer<typeof gmScreen>

export const setGmScreen = defineAction({
  name: 'setGmScreen',
  kind: 'write',
  description:
    'Cambia la pantalla del máster de una campaña en una escena que ya ha abierto (sin sceneId, la abierta): qué columnas salen (statblocks, characters, note, tables), la página fijada y las tablas aleatorias del mundo elegidas (sus pestañas). Lo que no se pase se queda',
  input: z.object({
    campaignId: z.uuid(),
    sceneId: z.uuid().optional(),
    columns: gmScreenColumns.partial().optional(),
    note: z.uuid().nullable().optional(),
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
