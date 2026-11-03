import { z } from 'zod'
import { worldColor } from './worlds.ts'

const blockId = z.string().regex(/^[a-z0-9]{6,24}$/)
const label = z.string().trim().max(80)

/**
 * Un bloque del panel de una página: datos de toda la página al lado del texto (ADR-0008). Texto, una imagen del
 * mundo, un medidor (barra o círculo), una valoración con estrellas, fichas que se marcan, las subpáginas o las páginas
 * con una etiqueta
 */
export const panelBlock = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('text'), title: label, text: z.string().max(5000) }),
  z.object({
    id: blockId,
    type: z.literal('image'),
    fileId: z.uuid().nullable(),
    caption: z.string().trim().max(200)
  }),
  z.object({
    id: blockId,
    type: z.literal('meter'),
    title: label,
    style: z.enum(['bar', 'circle']),
    value: z.number().int().min(0).max(9999),
    max: z.number().int().min(1).max(9999),
    color: worldColor
  }),
  z.object({
    id: blockId,
    type: z.literal('rating'),
    title: label,
    value: z.number().min(0).max(10).multipleOf(0.5),
    max: z.number().int().min(1).max(10)
  }),
  z.object({
    id: blockId,
    type: z.literal('tokens'),
    title: label,
    value: z.number().int().min(0).max(30),
    max: z.number().int().min(1).max(30),
    color: worldColor
  }),
  z.object({ id: blockId, type: z.literal('subpages'), title: label }),
  z.object({ id: blockId, type: z.literal('tagged'), title: label, tag: z.string().trim().max(200) })
])

export type PanelBlock = z.infer<typeof panelBlock>
export type PanelBlockType = PanelBlock['type']

export const pagePanel = z.array(panelBlock).max(50)
