import { z } from 'zod'
import { defineAction } from './action.ts'

/** Qué se marca: una página (con herencia a sus subpáginas), un secreto, una pestaña, un pin, una región o una entrada del mundo */
export const knowledgeKind = z.enum(['page', 'secret', 'tab', 'pin', 'element', 'content'])

/** De dónde viene lo que se ve: la página con la marca que decide y su capa */
const knowledgeSource = z
  .object({ pageId: z.uuid(), title: z.string(), layer: z.enum(['world', 'campaign']) })
  .nullable()

const characterRef = z.object({ id: z.uuid(), name: z.string() })

/** Lo que ve cada campaña de una página y por qué («Quién la conoce»), para el máster */
export const pageKnowledge = z.object({
  pageId: z.uuid(),
  world: z.object({
    /** Su marca en el mundo: la conoce todo el mundo, no la conoce nadie, o null (como su madre) */
    own: z.boolean().nullable(),
    known: z.boolean(),
    from: knowledgeSource
  }),
  campaigns: z.array(
    z.object({
      campaignId: z.uuid(),
      name: z.string(),
      /** Si parte de lo que sabe el mundo */
      knowsWorld: z.boolean(),
      own: z.object({ known: z.boolean(), characters: z.array(z.uuid()).nullable() }).nullable(),
      /** Quién la ve: toda la campaña, nadie o esos personajes */
      audience: z.union([z.literal('all'), z.literal('none'), z.array(characterRef)]),
      from: knowledgeSource,
      /** Sus personajes, para elegir a quién */
      characters: z.array(characterRef)
    })
  )
})

export type PageKnowledge = z.infer<typeof pageKnowledge>

export const getPageKnowledge = defineAction({
  name: 'getPageKnowledge',
  kind: 'read',
  description:
    'Quién conoce una página: lo que sabe el mundo y lo que ve cada campaña (toda, nadie o unos personajes), con su marca propia y de qué página viene lo que hereda',
  input: z.object({ pageId: z.uuid() }),
  output: pageKnowledge
})

export const setKnowledge = defineAction({
  name: 'setKnowledge',
  kind: 'players',
  description:
    'Marca lo que sabe una campaña (o todo el mundo): una página (sus subpáginas la heredan), un secreto (su id de documento), una pestaña, un pin, una región o una entrada del compendio del mundo (su clave). La conocen (toda la campaña o unos personajes), no la conocen, o se quita la marca para que herede',
  input: z.object({
    worldId: z.uuid(),
    campaignId: z
      .uuid()
      .nullable()
      .describe('La campaña; null: todo el mundo (lo saben las campañas que parten de él)'),
    kind: knowledgeKind,
    targetId: z.string().trim().min(1).max(200),
    known: z.boolean().nullable().describe('true: la conocen; false: no la conocen; null: quitar la marca (hereda)'),
    characters: z
      .array(z.uuid())
      .min(1)
      .max(50)
      .nullable()
      .optional()
      .describe('Solo estos personajes de la campaña (sus dueños la ven); sin ellos, toda la campaña')
  }),
  output: z.object({ page: pageKnowledge.nullable() })
})

export const listKnownPages = defineAction({
  name: 'listKnownPages',
  kind: 'read',
  description:
    'Las páginas de un mundo que conoce alguna campaña (toda o alguno de sus personajes) o todo el mundo: la marca del árbol de quien lleva la wiki',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ pageIds: z.array(z.uuid()) })
})
