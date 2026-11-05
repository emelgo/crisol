import { z } from 'zod'
import { defineAction } from './action.ts'
import { diceRoll, rollVisibility } from './dice.ts'

/** Una fila: su rango, su texto (puede llevar tiradas, «2d6 po») y, si se dice, una página u otra tabla anidada */
export const tableRow = z.object({
  id: z.string().min(1).max(40),
  from: z.int().min(-1000).max(100_000),
  to: z.int().min(-1000).max(100_000),
  text: z.string().max(2000),
  page: z.uuid().nullable().optional().describe('Una página del mundo a la que lleva'),
  table: z
    .uuid()
    .nullable()
    .optional()
    .describe('Otra tabla (la pestaña «Tabla» de una página) en la que se tira también')
})

/** Una tabla aleatoria del máster: la pestaña «Tabla» de una página del mundo */
export const randomTable = z.object({
  tabId: z.uuid(),
  name: z.string(),
  pageId: z.uuid(),
  formula: z.string().nullable().describe('Sin ella, 1dN por la última fila'),
  replacement: z.boolean().describe('Con reemplazo (lo de siempre): lo sacado puede volver a salir'),
  rows: z.array(tableRow),
  version: z.int()
})

export type RandomTable = z.infer<typeof randomTable>
export type TableRow = z.infer<typeof tableRow>

export const getRandomTable = defineAction({
  name: 'getRandomTable',
  kind: 'read',
  description:
    'Una tabla aleatoria del máster (la pestaña «Tabla» de una página): su fórmula, sus filas y, con una campaña, lo que ya salió en ella (si va sin reemplazo)',
  input: z.object({ tabId: z.uuid(), campaignId: z.uuid().optional() }),
  output: z.object({ table: randomTable, drawn: z.array(z.string()).describe('Las filas ya sacadas en esa campaña') })
})

export const updateRandomTable = defineAction({
  name: 'updateRandomTable',
  kind: 'write',
  description:
    'Cambia una tabla aleatoria con la versión que se leyó: su fórmula, si va sin reemplazo y sus filas (sus rangos cubren la fórmula sin huecos ni solapes; si no, dice qué falla y no se guarda)',
  input: z.object({
    tabId: z.uuid(),
    version: z.int().min(1),
    formula: z.string().trim().max(200).nullable().optional(),
    replacement: z.boolean().optional(),
    rows: z.array(tableRow).max(500).optional()
  }),
  output: z.object({ table: randomTable })
})

export const rollOnTable = defineAction({
  name: 'rollOnTable',
  kind: 'write',
  description:
    'Tira en una tabla aleatoria en una campaña de su mundo: el servidor tira su fórmula, toma su fila (y tira en sus tablas anidadas) y lo deja en el registro de la campaña, con su visibilidad. Sin reemplazo, lo sacado no vuelve a salir hasta reiniciarla',
  input: z.object({ tabId: z.uuid(), campaignId: z.uuid(), visibility: rollVisibility.default('all') }),
  output: z.object({ roll: diceRoll, drawn: z.array(z.string()) })
})

export const resetTableDraws = defineAction({
  name: 'resetTableDraws',
  kind: 'write',
  description: 'Vuelve a empezar una tabla sin reemplazo en una campaña: todo puede salir otra vez',
  input: z.object({ tabId: z.uuid(), campaignId: z.uuid() }),
  output: z.object({ ok: z.literal(true) })
})
