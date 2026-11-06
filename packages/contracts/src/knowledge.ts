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
      characters: z.array(characterRef),
      /** Quién de ella puede escribir en la página: nadie, toda la campaña o esos personajes */
      editors: z.union([z.literal('all'), z.literal('none'), z.array(characterRef)])
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

export const setPageEditors = defineAction({
  name: 'setPageEditors',
  kind: 'players',
  description:
    'Deja a los jugadores de una campaña escribir en una página (el diario del grupo, las pistas): toda la campaña ("all"), unos personajes o nadie (null). Quien puede editarla la ve. Solo su texto (ni el título, ni el panel, ni las pestañas) y sin heredar a sus subpáginas. Una página con secretos o notas ocultas no se puede dejar editar hasta quitarlos. Sin campaignId, la única del mundo',
  input: z.object({
    worldId: z.uuid(),
    campaignId: z.uuid().optional(),
    pageId: z.uuid(),
    editors: z.union([z.literal('all'), z.array(z.uuid()).min(1).max(100)]).nullable()
  }),
  output: z.object({ ok: z.literal(true) })
})

export const setKnowledge = defineAction({
  name: 'setKnowledge',
  kind: 'players',
  description:
    'Marca lo que sabe una campaña (o todo el mundo): una página (sus subpáginas la heredan), un secreto (su id de documento), una pestaña, un pin, una región o una entrada del compendio del mundo (su id, el de guardar_contenido). La conocen (toda la campaña o unos personajes), no la conocen, o se quita la marca para que herede',
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

/** A quién: toda la campaña o unos personajes (con su nombre) */
const audienceView = z.union([z.literal('all'), z.array(characterRef)])

export const reveal = defineAction({
  name: 'reveal',
  kind: 'players',
  description:
    'Revela algo a una campaña en partida, con aviso a sus jugadores: un secreto (su id de documento), una página, una pestaña, un pin, una región o una entrada del compendio del mundo (su clave); a toda la campaña o a unos personajes. Solo suma: a quien ya lo ve no se le quita (para eso, ocultar). Con alsoPage, si alguno de ellos no conoce la página donde está, también. Sin campaignId, la única del mundo',
  input: z.object({
    worldId: z.uuid(),
    campaignId: z.uuid().optional(),
    kind: knowledgeKind,
    targetId: z.string().trim().min(1).max(200),
    characters: z
      .array(z.uuid())
      .min(1)
      .max(50)
      .optional()
      .describe('Solo estos personajes; sin ellos, toda la campaña'),
    alsoPage: z.boolean().optional().describe('Si no conocen la página donde está, revelarla también')
  }),
  output: z.object({
    /** A cuántos jugadores les aparece algo nuevo */
    told: z.number().int(),
    /** La página donde está no la conocen (y no se pidió alsoPage): no lo verán hasta que la conozcan */
    pageUnknown: z.boolean()
  })
})

export const hide = defineAction({
  name: 'hide',
  kind: 'players',
  description:
    'Oculta otra vez a una campaña algo que se le reveló (lo que dice lo_que_sabe): deja de verlo al momento; queda en el historial',
  input: z.object({
    campaignId: z.uuid(),
    kind: knowledgeKind,
    targetId: z.string().trim().min(1).max(200)
  }),
  output: z.object({ ok: z.literal(true) })
})

/** Una marca de lo que sabe una campaña (o todo el mundo), lista para enseñarla */
const knownItem = z.object({
  kind: knowledgeKind,
  targetId: z.string(),
  /** Su nombre: el título de la página, de la pestaña, la etiqueta del pin, el título de la sección del secreto… */
  name: z.string(),
  /** La página donde está, para abrirla */
  pageId: z.uuid().nullable(),
  pageTitle: z.string().nullable(),
  known: z.boolean(),
  audience: audienceView,
  at: z.string()
})

export const listCampaignKnowledge = defineAction({
  name: 'listCampaignKnowledge',
  kind: 'read',
  description:
    'Lo que sabe el grupo: lo revelado (y lo ocultado) a una campaña, de lo más reciente a lo más antiguo, con a quién y cuándo; aparte, lo que sabe todo el mundo si la campaña parte de él',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({ campaign: z.array(knownItem), world: z.array(knownItem), knowsWorld: z.boolean() })
})

export const getSecretsKnowledge = defineAction({
  name: 'getSecretsKnowledge',
  kind: 'read',
  description: 'Quién conoce cada secreto de una página, en cada campaña del mundo (para su cabecera)',
  input: z.object({ pageId: z.uuid() }),
  output: z.object({
    secrets: z.array(
      z.object({
        documentId: z.uuid(),
        campaigns: z.array(z.object({ campaignId: z.uuid(), audience: z.union([z.literal('none'), audienceView]) }))
      })
    ),
    campaigns: z.array(
      z.object({
        campaignId: z.uuid(),
        name: z.string(),
        /** Si ve la página (si no, revelar un secreto pide revelarla también) */
        seesPage: z.union([z.literal('none'), audienceView]),
        characters: z.array(characterRef)
      })
    )
  })
})

/** Lo nuevo de un jugador: lo que se le reveló y aún no ha abierto */
export const listNews = defineAction({
  name: 'listNews',
  kind: 'read',
  description: 'Lo nuevo del jugador en su campaña: lo que se le reveló y aún no ha abierto, con la página donde está',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({
    news: z.array(z.object({ kind: knowledgeKind, targetId: z.string(), pageId: z.uuid().nullable(), at: z.string() }))
  })
})

export const seeNews = defineAction({
  name: 'seeNews',
  kind: 'read',
  description:
    'El jugador abrió esa página (pageId) o esa entrada del compendio del mundo (content, su clave): lo nuevo de ella deja de serlo',
  input: z
    .object({
      campaignId: z.uuid(),
      pageId: z.uuid().optional(),
      content: z.string().trim().min(1).max(200).optional()
    })
    .refine((input) => (input.pageId === undefined) !== (input.content === undefined), {
      message: 'pageId o content'
    }),
  output: z.object({ ok: z.literal(true) })
})
