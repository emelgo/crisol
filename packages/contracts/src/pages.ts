import { z } from 'zod'
import { defineAction } from './action.ts'

const pageTitle = z.string().trim().min(1).max(200)

/** Una página tal como sale en el árbol */
export const pageSummary = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  parentId: z.uuid().nullable(),
  title: z.string(),
  icon: z.string().nullable(),
  hasChildren: z.boolean(),
  version: z.number().int()
})

export type PageSummary = z.infer<typeof pageSummary>

/** Una página abierta: lo que no es su cuerpo, con su ruta desde el primer nivel (ella incluida) */
export const page = pageSummary.extend({
  locked: z.boolean(),
  path: z.array(z.object({ id: z.uuid(), title: z.string() })),
  updatedAt: z.string()
})

export type Page = z.infer<typeof page>

/** Dónde va entre sus hermanas: delante o detrás de una, o al final si no se dice */
const placement = {
  before: z.uuid().optional().describe('Ponerla delante de esta página hermana'),
  after: z.uuid().optional().describe('Ponerla detrás de esta página hermana')
}
const onlyOneNeighbour = (input: { before?: string | undefined; after?: string | undefined }) =>
  !(input.before && input.after)

export const createPage = defineAction({
  name: 'createPage',
  kind: 'write',
  description: 'Crea una página en la wiki de un mundo, en el primer nivel o como subpágina de otra',
  input: z
    .object({
      worldId: z.uuid(),
      title: pageTitle,
      parentId: z.uuid().nullable().default(null).describe('La página madre; sin ella, en el primer nivel'),
      ...placement
    })
    .refine(onlyOneNeighbour, { message: 'before o after, no los dos' }),
  output: page
})

export const updatePage = defineAction({
  name: 'updatePage',
  kind: 'write',
  description: 'Cambia el título de una página',
  input: z.object({ pageId: z.uuid(), title: pageTitle }),
  output: page
})

export const movePage = defineAction({
  name: 'movePage',
  kind: 'write',
  description:
    'Mueve una página con sus subpáginas: bajo otra página (parentId) o al primer nivel (parentId null), delante o detrás de una hermana o al final',
  input: z
    .object({
      pageId: z.uuid(),
      parentId: z.uuid().nullable().describe('La nueva página madre; null, al primer nivel'),
      ...placement
    })
    .refine(onlyOneNeighbour, { message: 'before o after, no los dos' }),
  output: page
})

export const getPage = defineAction({
  name: 'getPage',
  kind: 'read',
  description: 'Una página de la wiki con su ruta en el árbol',
  input: z.object({ pageId: z.uuid() }),
  output: page
})

export const listPageChildren = defineAction({
  name: 'listPageChildren',
  kind: 'read',
  description: 'Las subpáginas de una página, o el primer nivel de la wiki de un mundo, en su orden',
  input: z.object({ worldId: z.uuid(), parentId: z.uuid().nullable().default(null) }),
  output: z.object({ pages: z.array(pageSummary) })
})

export const listPageTree = defineAction({
  name: 'listPageTree',
  kind: 'read',
  description:
    'El árbol de la wiki de un mundo, o de una rama, hasta los niveles que se pidan: las páginas en orden de lectura, cada una con su nivel y su madre',
  input: z.object({
    worldId: z.uuid(),
    parentId: z.uuid().nullable().default(null).describe('La rama; sin ella, desde el primer nivel'),
    levels: z.number().int().min(1).max(6).default(2).describe('Cuántos niveles por debajo')
  }),
  output: z.object({
    pages: z.array(
      z.object({
        id: z.uuid(),
        parentId: z.uuid().nullable(),
        title: z.string(),
        icon: z.string().nullable(),
        level: z.number().int(),
        hasChildren: z.boolean()
      })
    )
  })
})
