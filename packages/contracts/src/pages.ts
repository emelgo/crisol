import { z } from 'zod'
import { defineAction } from './action.ts'

const pageTitle = z.string().trim().min(1).max(200)
/** Un emoji (con sus modificadores y uniones), o una bandera */
const pageIcon = z
  .string()
  .max(16)
  .regex(
    /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u200d|\ufe0f)*$/u
  )

const propertyName = z.string().trim().min(1).max(60)
/** Una propiedad con su tipo. alias y etiquetas son listas y resumen es texto (lo comprueba el servidor) */
export const pageProperty = z.discriminatedUnion('type', [
  z.object({ name: propertyName, type: z.literal('text'), value: z.string().max(5000) }),
  z.object({ name: propertyName, type: z.literal('number'), value: z.number().finite() }),
  z.object({ name: propertyName, type: z.literal('boolean'), value: z.boolean() }),
  z.object({ name: propertyName, type: z.literal('list'), value: z.array(z.string().trim().min(1).max(200)).max(200) }),
  z.object({ name: propertyName, type: z.literal('pages'), value: z.array(z.uuid()).max(200) })
])

export type PageProperty = z.infer<typeof pageProperty>

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
  properties: z.array(pageProperty),
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
  description:
    'Cambia el título de una página, su icono (un emoji; null, sin icono) o su candado (locked: el editor, en lectura)',
  input: z
    .object({
      pageId: z.uuid(),
      title: pageTitle.optional(),
      icon: pageIcon.nullable().optional(),
      locked: z.boolean().optional()
    })
    .refine((input) => input.title !== undefined || input.icon !== undefined || input.locked !== undefined, {
      message: 'title, icon o locked'
    }),
  output: page
})

export const setPageProperties = defineAction({
  name: 'setPageProperties',
  kind: 'write',
  description:
    'Deja las propiedades de una página como se dan, en ese orden. Reservadas: alias (lista de otros nombres), etiquetas (lista, con jerarquía por «/») y resumen (texto)',
  input: z.object({ pageId: z.uuid(), properties: z.array(pageProperty).max(100) }),
  output: page
})

export const listTags = defineAction({
  name: 'listTags',
  kind: 'read',
  description:
    'Las etiquetas de la wiki de un mundo con cuántas páginas tiene cada una (la madre cuenta las de sus hijas)',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({
    tags: z.array(z.object({ tag: z.string(), depth: z.number().int(), count: z.number().int() }))
  })
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

/** Lo que la cuenta tiene a mano en la wiki de un mundo: sus pestañas y sus marcadores, con los títulos de ahora */
export const wikiPreferences = z.object({
  tabs: z.array(z.object({ pageId: z.uuid(), title: z.string(), pinned: z.boolean() })),
  bookmarks: z.array(z.object({ name: z.string(), pages: z.array(z.object({ id: z.uuid(), title: z.string() })) }))
})

export type WikiPreferences = z.infer<typeof wikiPreferences>

export const getWikiPreferences = defineAction({
  name: 'getWikiPreferences',
  kind: 'read',
  description: 'Las pestañas abiertas y los marcadores de la cuenta en la wiki de un mundo',
  input: z.object({ worldId: z.uuid() }),
  output: wikiPreferences
})

export const setWikiTabs = defineAction({
  name: 'setWikiTabs',
  kind: 'write',
  description: 'Guarda las pestañas abiertas de la cuenta en la wiki de un mundo (no va al historial)',
  input: z.object({
    worldId: z.uuid(),
    tabs: z.array(z.object({ pageId: z.uuid(), pinned: z.boolean() })).max(20)
  }),
  output: wikiPreferences
})

export const setBookmarks = defineAction({
  name: 'setBookmarks',
  kind: 'write',
  description: 'Guarda los marcadores de la cuenta en la wiki de un mundo, por grupos (no va al historial)',
  input: z.object({
    worldId: z.uuid(),
    bookmarks: z.array(z.object({ name: z.string().trim().min(1).max(60), pages: z.array(z.uuid()).max(200) })).max(20)
  }),
  output: wikiPreferences
})

export const createPageDocument = defineAction({
  name: 'createPageDocument',
  kind: 'write',
  description:
    'Crea el documento de un secreto o una nota oculta de una página (vacío, o copia de otro al pegarlo): su texto va aparte del cuerpo',
  input: z.object({
    pageId: z.uuid(),
    kind: z.enum(['secret', 'note']),
    copyOf: z.uuid().optional().describe('El secreto o la nota de la que se hace una copia')
  }),
  output: z.object({ id: z.uuid() })
})

/** Markdown de una página: el dialecto de Obsidian que entiende Crisol */
const MARKDOWN_HELP =
  'Markdown de Obsidian: propiedades en YAML al principio (alias, etiquetas, resumen y las demás; las de páginas como "[[Título]]"), títulos #, listas, - [ ] casillas, tablas, ``` código, recuadros > [!nota] > [!consejo] > [!aviso] > [!peligro] > [!leer], la caja > [!caja], > [!secreto] para lo que solo ve el máster (se guarda aparte, nunca en el cuerpo) y %%notas ocultas%% en sus líneas'
const markdownText = z.string().max(2_000_000)
const blockId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/)

export const readPage = defineAction({
  name: 'readPage',
  kind: 'read',
  description: `Lee una página de la wiki: sus propiedades y su cuerpo en ${MARKDOWN_HELP}. Con ids, cada bloque de primer nivel lleva al final su ^id (los secretos, ^s-id), para cambiarlo con editPage`,
  input: z.object({
    pageId: z.uuid(),
    ids: z.boolean().optional().describe('Los ^id de los bloques de primer nivel, para cambiar uno con editPage')
  }),
  output: z.object({ page, markdown: z.string() })
})

const newPage = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe('Un nombre para esta página dentro de la llamada, para que otras de la llamada la tengan de madre'),
  parent: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .optional()
    .describe('La key de otra página de esta llamada que será su madre; sin parent, va donde diga parentId'),
  title: pageTitle,
  icon: pageIcon.optional(),
  markdown: markdownText.optional().describe('Sus propiedades (YAML) y su cuerpo')
})

export const createPages = defineAction({
  name: 'createPages',
  kind: 'write',
  description: `Crea hasta 50 páginas de una vez en la wiki de un mundo, con su cuerpo y sus propiedades en ${MARKDOWN_HELP}. Pueden ir unas dentro de otras (parent, por su key). Es una sola operación del historial`,
  input: z
    .object({
      worldId: z.uuid(),
      parentId: z
        .uuid()
        .nullable()
        .describe('Dónde van las que no tienen parent: dentro de esta página, o en el primer nivel con null'),
      pages: z.array(newPage).min(1).max(50)
    })
    .refine((input) => new Set(input.pages.map((p) => p.key)).size === input.pages.length, {
      message: 'Cada página necesita una key distinta'
    }),
  output: z.object({
    pages: z.array(z.object({ key: z.string(), id: z.uuid(), title: z.string(), parentId: z.uuid().nullable() }))
  })
})

/** Una propiedad que escribe la IA: las de páginas, por su título, un alias o su id */
const propertyInput = z.discriminatedUnion('type', [
  z.object({ name: propertyName, type: z.literal('text'), value: z.string().max(5000) }),
  z.object({ name: propertyName, type: z.literal('number'), value: z.number().finite() }),
  z.object({ name: propertyName, type: z.literal('boolean'), value: z.boolean() }),
  z.object({ name: propertyName, type: z.literal('list'), value: z.array(z.string().trim().min(1).max(200)).max(200) }),
  z.object({
    name: propertyName,
    type: z.literal('pages'),
    value: z.array(z.string().trim().min(1).max(200)).max(200).describe('Títulos, alias o ids de páginas del mundo')
  })
])

export const editPage = defineAction({
  name: 'editPage',
  kind: 'write',
  description: `Cambia una página: su título, su icono, sus propiedades (todas, como se den) o su cuerpo, en ${MARKDOWN_HELP}. El cuerpo: append añade al final; replace lo cambia entero (y su YAML, si lo trae, las propiedades); block cambia el bloque blockId por lo que se dé (lee la página con ids); section cambia lo que hay debajo del título section (por su texto o su id), hasta el siguiente título de su nivel. Si la página está abierta, el cambio se ve al momento`,
  input: z
    .object({
      pageId: z.uuid(),
      title: pageTitle.optional(),
      icon: pageIcon.nullable().optional(),
      properties: z.array(propertyInput).max(100).optional(),
      body: z
        .object({
          mode: z.enum(['append', 'replace', 'block', 'section']),
          markdown: markdownText,
          blockId: blockId.optional().describe('Con mode block: el id del bloque (sin ^ ni s-)'),
          section: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .optional()
            .describe('Con mode section: el texto del título o su id')
        })
        .refine((body) => body.mode !== 'block' || body.blockId, { message: 'block necesita blockId' })
        .refine((body) => body.mode !== 'section' || body.section, { message: 'section necesita section' })
        .optional()
    })
    .refine(
      (input) =>
        input.title !== undefined ||
        input.icon !== undefined ||
        input.properties !== undefined ||
        input.body !== undefined,
      { message: 'Nada que cambiar' }
    ),
  output: z.object({
    page,
    changedBlocks: z.array(z.string()).describe('Los ids de los bloques de primer nivel que se escribieron'),
    changedSinceRequest: z
      .boolean()
      .describe('Si esperó la aprobación del máster y el cuerpo cambió entre medias: se aplicó sobre lo de ahora')
  })
})
