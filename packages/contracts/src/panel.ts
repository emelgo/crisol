import { z } from 'zod'
import { worldColor } from './worlds.ts'

const blockId = z.string().regex(/^[a-z0-9]{6,24}$/)
/** Una plantilla y un campo, como en las propiedades (pages.ts no se importa aquí: lo importa él a este) */
const tableTemplate = z.union([z.uuid(), z.string().regex(/^[a-z][a-z0-9-]{0,39}$/)])
const tableField = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)
const label = z.string().trim().max(80)
// hidden: «Oculto», no les llega a los jugadores aunque vean la página (ADR-0017)
const base = { id: blockId, hidden: z.literal(true).optional() }

/**
 * Un bloque del panel de una página: datos de toda la página al lado del texto (ADR-0008). Texto, una imagen del
 * mundo, un medidor (barra o círculo), una valoración con estrellas, fichas que se marcan, las subpáginas, las páginas
 * con una etiqueta o una tabla que se llena sola (ADR-0009)
 */
export const panelBlock = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), title: label, text: z.string().max(5000) }),
  z.object({
    ...base,
    type: z.literal('image'),
    fileId: z.uuid().nullable(),
    caption: z.string().trim().max(200)
  }),
  z.object({
    ...base,
    type: z.literal('meter'),
    title: label,
    style: z.enum(['bar', 'circle']),
    value: z.number().int().min(0).max(9999),
    max: z.number().int().min(1).max(9999),
    color: worldColor
  }),
  z.object({
    ...base,
    type: z.literal('rating'),
    title: label,
    value: z.number().min(0).max(10).multipleOf(0.5),
    max: z.number().int().min(1).max(10)
  }),
  z.object({
    ...base,
    type: z.literal('tokens'),
    title: label,
    value: z.number().int().min(0).max(30),
    max: z.number().int().min(1).max(30),
    color: worldColor
  }),
  z.object({ ...base, type: z.literal('subpages'), title: label }),
  z.object({ ...base, type: z.literal('tagged'), title: label, tag: z.string().trim().max(200) }),
  // Una tabla que se llena sola (ADR-0009): las páginas de una plantilla (y de sus copias) cuyo campo de enlace apunta a
  // esta página, con hasta tres columnas más de sus campos y su orden (por título o por una columna)
  z.object({
    ...base,
    type: z.literal('related'),
    title: label,
    // Vacíos, sin configurar aún (así nace: se eligen de las plantillas que haya)
    template: z.union([tableTemplate, z.literal('')]).describe('La plantilla; vacía, sin configurar'),
    field: z.union([tableField, z.literal('')]).describe('Su campo de enlace a páginas; vacío, sin configurar'),
    columns: z.array(tableField).max(3),
    sort: z.union([z.literal('title'), tableField])
  })
])

export type PanelBlock = z.infer<typeof panelBlock>
export type PanelBlockType = PanelBlock['type']

export const pagePanel = z.array(panelBlock).max(50)
