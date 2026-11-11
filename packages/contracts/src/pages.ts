import { z } from 'zod'
import { defineAction } from './action.ts'
import { pagePanel } from './panel.ts'
import { readAs } from './read-as.ts'

const pageTitle = z.string().trim().min(1).max(200)
/** Un emoji (con sus modificadores y uniones), o una bandera: el icono de una página o de una carpeta */
export const pageIcon = z
  .string()
  .max(16)
  .regex(
    /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u200d|\ufe0f)*$/u
  )

const propertyName = z.string().trim().min(1).max(60)
/** El id de un campo de plantilla: legible en las de serie («faccion»), corto y aleatorio en las propias (ADR-0009) */
export const fieldId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)
/** Una plantilla: el id legible de una de serie o el de una propia */
export const templateRef = z.union([z.uuid(), z.string().regex(/^[a-z][a-z0-9-]{0,39}$/)])
// hidden: «Oculto», no les llega a los jugadores aunque vean la página (ADR-0017)
const field = { name: propertyName, field: fieldId.optional(), hidden: z.literal(true).optional() }
const optionText = z.string().trim().max(100)
const choiceOptions = z.array(optionText.min(1)).max(50)
const clockSegments = z.number().int().min(2).max(12)
/** Las plantillas cuyas páginas se buscan primero al elegir un enlace (no encierra: se puede elegir cualquiera) */
const linkTargets = z.array(templateRef).max(10)

/**
 * Una propiedad con su tipo. alias y etiquetas son listas y resumen es texto (lo comprueba el servidor). Las que salen
 * de una plantilla llevan el id de su campo y su forma (ADR-0009)
 */
export const pageProperty = z.discriminatedUnion('type', [
  z.object({ ...field, type: z.literal('text'), value: z.string().max(5000) }),
  z.object({ ...field, type: z.literal('number'), value: z.number().finite().nullable() }),
  z.object({ ...field, type: z.literal('boolean'), value: z.boolean() }),
  z.object({ ...field, type: z.literal('list'), value: z.array(z.string().trim().min(1).max(200)).max(200) }),
  z.object({
    ...field,
    type: z.literal('pages'),
    value: z.array(z.uuid()).max(200),
    single: z.literal(true).optional(),
    targets: linkTargets.optional()
  }),
  z.object({ ...field, type: z.literal('choice'), value: optionText, options: choiceOptions }),
  z.object({ ...field, type: z.literal('clock'), value: z.number().int().min(0).max(12), segments: clockSegments })
])

export type PageProperty = z.infer<typeof pageProperty>

/** Una página tal como sale en el árbol */
export const pageSummary = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  parentId: z.uuid().nullable(),
  title: z.string(),
  icon: z.string().nullable(),
  /** La plantilla de la que salió (ADR-0009), o null */
  template: templateRef.nullable(),
  hasChildren: z.boolean(),
  version: z.number().int()
})

export type PageSummary = z.infer<typeof pageSummary>

/**
 * La portada: una imagen del mundo, su punto de encuadre (en % del ancho y del alto: lo que no se recorta) y cuánto se
 * acerca alrededor de ese punto (1, sin acercar, si no se dice)
 */
export const pageCover = z.object({
  fileId: z.uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3).optional()
})

export type PageCover = z.infer<typeof pageCover>

/**
 * Los ajustes de la hoja de una página (toda página es una hoja): papel, tema para imprimir, numeración (y desde qué
 * número), pie con el título y cuántas columnas lleva al empezar (los bloques «Columnas» lo cambian desde donde están)
 */
export const sheetSettings = z.object({
  paper: z.enum(['a4', 'letter']),
  theme: z
    .enum(['color', 'neutro', 'pergamino'])
    .describe('Al imprimir: con los colores de la app, en blanco y negro (neutro) o en pergamino'),
  numbers: z.boolean(),
  firstNumber: z.number().int().min(1).max(999),
  footer: z.boolean(),
  columns: z.union([z.literal(1), z.literal(2)]).default(1)
})

export type SheetSettings = z.infer<typeof sheetSettings>

/** Una página abierta: lo que no es su cuerpo, con su ruta desde el primer nivel (ella incluida) */
export const page = pageSummary.extend({
  properties: z.array(pageProperty),
  locked: z.boolean(),
  cover: pageCover.nullable(),
  /** La vista de hoja: sus ajustes, o null si la página no se ve como hoja */
  sheet: sheetSettings.nullable(),
  /** El panel a su lado: bloques con datos de toda la página */
  panel: pagePanel,
  path: z.array(z.object({ id: z.uuid(), title: z.string() })),
  updatedAt: z.string(),
  /** Para quien lleva la wiki: la escriben jugadores de alguna campaña (y por eso no lleva secretos) */
  editedByPlayers: z.boolean().optional(),
  /** Para un jugador: puede escribir en ella (docs/specs/pagina-de-jugadores.md) */
  editable: z.boolean().optional()
})

export type Page = z.infer<typeof page>

/** Dónde va entre sus hermanas: delante o detrás de una, o al final si no se dice */
const placement = {
  before: z.uuid().optional().describe('Ponerla delante de esta página hermana'),
  after: z.uuid().optional().describe('Ponerla detrás de esta página hermana')
}
const onlyOneNeighbour = (input: { before?: string | undefined; after?: string | undefined }) =>
  !(input.before && input.after)

export const copyPage = defineAction({
  name: 'copyPage',
  kind: 'write',
  description:
    'Duplica una página con todo lo suyo, justo detrás de ella: portada, hoja, propiedades, panel, su texto con sus secretos y notas, y sus pestañas (mapas con sus pines, tablas, escenas con sus muros, luces y sonidos). Sus subpáginas no, ni lo que sabe cada campaña. Una sola operación, que se deshace de una vez desde el historial. Sin título, «<título> (copia)»',
  input: z.object({ pageId: z.uuid(), title: pageTitle.optional() }),
  output: page
})

export const createPage = defineAction({
  name: 'createPage',
  kind: 'write',
  description: 'Crea una página en la wiki de un mundo, en el primer nivel o como subpágina de otra',
  input: z
    .object({
      worldId: z.uuid(),
      title: pageTitle,
      parentId: z.uuid().nullable().default(null).describe('La página madre; sin ella, en el primer nivel'),
      template: templateRef.optional().describe('La plantilla con la que nace: sus campos, su panel y su texto'),
      ...placement
    })
    .refine(onlyOneNeighbour, { message: 'before o after, no los dos' }),
  output: page
})

export const updatePage = defineAction({
  name: 'updatePage',
  kind: 'write',
  description:
    'Cambia el título de una página, su icono (un emoji; null, sin icono), su candado (locked: el editor, en lectura) o su portada (una imagen del mundo con su encuadre; null, sin portada)',
  input: z
    .object({
      pageId: z.uuid(),
      title: pageTitle.optional(),
      icon: pageIcon.nullable().optional(),
      locked: z.boolean().optional(),
      cover: pageCover.nullable().optional(),
      sheet: sheetSettings.nullable().optional().describe('La vista de hoja (null: sin hoja)')
    })
    .refine(
      (input) =>
        input.title !== undefined ||
        input.icon !== undefined ||
        input.locked !== undefined ||
        input.cover !== undefined ||
        input.sheet !== undefined,
      { message: 'title, icon, locked, cover o sheet' }
    ),
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

export const sortPageChildren = defineAction({
  name: 'sortPageChildren',
  kind: 'write',
  description:
    'Ordena por título las subpáginas de una página (parentId) o el primer nivel del mundo (parentId null), de la A a la Z (asc) o al revés (desc)',
  input: z.object({
    worldId: z.uuid(),
    parentId: z.uuid().nullable(),
    order: z.enum(['asc', 'desc']).default('asc')
  }),
  output: z.object({ sorted: z.number().int() })
})

export const getPage = defineAction({
  name: 'getPage',
  kind: 'read',
  description: 'Una página de la wiki con su ruta en el árbol',
  input: z.object({ pageId: z.uuid(), ...readAs }),
  output: page
})

export const listPageChildren = defineAction({
  name: 'listPageChildren',
  kind: 'read',
  description: 'Las subpáginas de una página, o el primer nivel de la wiki de un mundo, en su orden',
  input: z.object({ worldId: z.uuid(), parentId: z.uuid().nullable().default(null), ...readAs }),
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
    levels: z.number().int().min(1).max(32).default(2).describe('Cuántos niveles por debajo'),
    ...readAs
  }),
  output: z.object({
    pages: z.array(
      z.object({
        id: z.uuid(),
        parentId: z.uuid().nullable(),
        title: z.string(),
        icon: z.string().nullable(),
        template: templateRef.nullable().describe('La plantilla de la que salió'),
        level: z.number().int(),
        hasChildren: z.boolean()
      })
    )
  })
})

export const listRecentPages = defineAction({
  name: 'listRecentPages',
  kind: 'read',
  description:
    'Las páginas de la wiki de un mundo cambiadas hace poco (su texto o lo demás), de la última a la primera, con las páginas de encima',
  input: z.object({ worldId: z.uuid(), limit: z.number().int().min(1).max(50).default(6), ...readAs }),
  output: z.object({
    pages: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        icon: z.string().nullable(),
        cover: pageCover.nullable(),
        /** Las de encima, del primer nivel a su madre */
        path: z.array(z.object({ id: z.uuid(), title: z.string() })),
        editedAt: z.string()
      })
    )
  })
})

/** Lo que la cuenta tiene a mano en la wiki de un mundo: sus pestañas y sus marcadores, con los títulos de ahora */
export const wikiPreferences = z.object({
  tabs: z.array(z.object({ pageId: z.uuid(), title: z.string(), pinned: z.boolean() })),
  bookmarks: z.array(z.object({ name: z.string(), pages: z.array(z.object({ id: z.uuid(), title: z.string() })) })),
  /** Las páginas con hoja que la cuenta lee en la vista sencilla */
  simplePages: z.array(z.uuid())
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

export const setPageView = defineAction({
  name: 'setPageView',
  kind: 'write',
  description: 'Recuerda en qué vista lee la cuenta una página con hoja: la de hoja o la sencilla (no va al historial)',
  input: z.object({ worldId: z.uuid(), pageId: z.uuid(), view: z.enum(['sheet', 'simple']) }),
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
  'Markdown de Obsidian: propiedades en YAML al principio (alias, etiquetas, resumen y las demás; las de páginas como "[[Título]]"), títulos #, listas, - [ ] casillas, tablas, ``` código, recuadros > [!nota] > [!consejo] > [!aviso] > [!peligro] > [!leer], la caja > [!caja], > [!secreto] para lo que solo ve el máster (se guarda aparte, nunca en el cuerpo), %%notas ocultas%% en sus líneas, archivos del mundo con ![[mapa.png|300]] o ![[libro.pdf#page=12]], y para la vista de hoja: > [!statblock], > [!lateral] (o > [!lateral|izquierda]), > [!ancho] para varios bloques (o |ancho en un recuadro), > [!indice], y los saltos <div class="salto-pagina"></div> y <div class="salto-columna"></div> en su línea'
const markdownText = z.string().max(2_000_000)
const blockId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/)

/**
 * Las tablas que se llenan solas de una página (ADR-0009), ya calculadas: por cada bloque «Tabla de páginas» de su
 * panel, sus columnas y sus filas (las páginas cuyo campo apunta a ella), con los títulos de las páginas de sus celdas
 */
export const pageTables = z.object({
  tables: z.array(
    z.object({
      blockId: z.string(),
      title: z.string(),
      /** field: el campo ya no está en la plantilla (la tabla no vale hasta cambiarla) */
      problem: z.enum(['field']).nullable(),
      columns: z.array(z.object({ field: fieldId, name: z.string() })),
      rows: z.array(
        z.object({
          id: z.uuid(),
          title: z.string(),
          icon: z.string().nullable(),
          cells: z.array(pageProperty.nullable())
        })
      ),
      /** Si hay más filas de las que caben */
      more: z.boolean()
    })
  ),
  /** Los títulos de las páginas que salen en las celdas */
  linked: z.array(z.object({ id: z.uuid(), title: z.string() }))
})

export type PageTables = z.infer<typeof pageTables>

export const getPageTables = defineAction({
  name: 'getPageTables',
  kind: 'read',
  description:
    'Las tablas que se llenan solas de una página, ya calculadas: las páginas de una plantilla (y sus copias) cuyo campo de enlace apunta a ella, con sus columnas',
  input: z.object({ pageId: z.uuid(), ...readAs }),
  output: pageTables
})

export const readPage = defineAction({
  name: 'readPage',
  kind: 'read',
  description: `Lee una página de la wiki: sus propiedades y su cuerpo en ${MARKDOWN_HELP}. Con ids, cada bloque de primer nivel lleva al final su ^id (los secretos, ^s-id), para cambiarlo con editPage`,
  input: z.object({
    pageId: z.uuid(),
    ids: z.boolean().optional().describe('Los ^id de los bloques de primer nivel, para cambiar uno con editPage'),
    ...readAs
  }),
  output: z.object({ page, markdown: z.string(), tables: pageTables.shape.tables })
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
  markdown: markdownText.optional().describe('Sus propiedades (YAML) y su cuerpo'),
  template: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .optional()
    .describe(
      'La plantilla (su id o su nombre, de listar_plantillas): nace con sus campos, su panel y, si no se da cuerpo, su texto. Las propiedades del YAML que se llamen como un campo (sin mirar mayúsculas ni tildes) van a ese campo con su forma'
    )
})

export const createPages = defineAction({
  name: 'createPages',
  kind: 'write',
  description: `Crea hasta 50 páginas de una vez en la wiki de un mundo, con su cuerpo y sus propiedades en ${MARKDOWN_HELP}. Pueden ir unas dentro de otras (parent, por su key). Es una sola operación del historial. Un [[enlace]] a una página que aún no existe queda sin resolver y se resuelve solo al crearla: una wiki entera se puede pasar de 50 en 50 en cualquier orden. Los archivos (![[mapa.png]]) los sube el máster: se nombran por su nombre y se resuelven al subirlos`,
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

/**
 * Una propiedad que escribe la IA: las de páginas, por su título, un alias o su id. Si la página ya tiene una que se
 * llama igual y salió de una plantilla, se queda con su campo y su forma
 */
const propertyInput = z.discriminatedUnion('type', [
  z.object({ name: propertyName, type: z.literal('text'), value: z.string().max(5000) }),
  z.object({ name: propertyName, type: z.literal('number'), value: z.number().finite().nullable() }),
  z.object({ name: propertyName, type: z.literal('boolean'), value: z.boolean() }),
  z.object({ name: propertyName, type: z.literal('list'), value: z.array(z.string().trim().min(1).max(200)).max(200) }),
  z.object({
    name: propertyName,
    type: z.literal('pages'),
    value: z.array(z.string().trim().min(1).max(200)).max(200).describe('Títulos, alias o ids de páginas del mundo'),
    single: z.literal(true).optional().describe('Si es un enlace a una sola página')
  }),
  z.object({
    name: propertyName,
    type: z.literal('choice'),
    value: optionText,
    options: choiceOptions.optional().describe('Las opciones; sin ellas, las que ya tenga')
  }),
  z.object({
    name: propertyName,
    type: z.literal('clock'),
    value: z.number().int().min(0).max(12).describe('Segmentos llenos'),
    segments: clockSegments.optional().describe('De 2 a 12; sin ellos, los que ya tenga (4 si es nuevo)')
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
        .optional(),
      template: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .optional()
        .describe(
          'Aplica una plantilla (su id o su nombre): añade los campos, los bloques del panel y, al final del texto, los apartados que le falten, sin borrar nada; la página pasa a ser de ella'
        )
    })
    .refine(
      (input) =>
        input.title !== undefined ||
        input.icon !== undefined ||
        input.properties !== undefined ||
        input.body !== undefined ||
        input.template !== undefined,
      { message: 'Nada que cambiar' }
    )
    .refine((input) => !(input.template && input.body), { message: 'template no va con body' }),
  output: z.object({
    page,
    changedBlocks: z.array(z.string()).describe('Los ids de los bloques de primer nivel que se escribieron'),
    changedSinceRequest: z
      .boolean()
      .describe('Si esperó la aprobación del máster y el cuerpo cambió entre medias: se aplicó sobre lo de ahora')
  })
})

/**
 * Qué exportar en Markdown: la wiki entera de un mundo, o una página (con sus subpáginas, si se pide). No es una acción:
 * va por POST /api/export, que contesta con el .zip
 */
export const exportInput = z.object({
  worldId: z.uuid(),
  pageId: z.uuid().nullable().optional(),
  children: z.boolean().optional()
})

export type ExportInput = z.infer<typeof exportInput>

export const setPagePanel = defineAction({
  name: 'setPagePanel',
  kind: 'write',
  description:
    'Deja el panel de una página (los bloques a su lado: texto, imagen, medidor en barra o círculo, estrellas, fichas, subpáginas, páginas con una etiqueta o una tabla de páginas) como se da, en ese orden. Cada bloque lleva un id corto propio (letras minúsculas y números); el valor de un medidor o unas fichas no pasa de su máximo. Una tabla de páginas (related) lista las páginas de una plantilla (template, de listar_plantillas) cuyo campo de enlace (field, su id) apunta a esta página, con hasta tres columnas (ids de campos de esa plantilla) y su orden (title o una columna); leer_pagina la da ya calculada',
  input: z.object({ pageId: z.uuid(), blocks: pagePanel }),
  output: page
})

export const listPageNames = defineAction({
  name: 'listPageNames',
  kind: 'read',
  description:
    'Los nombres de todas las páginas de la wiki de un mundo (título, alias y ruta), para enlazarlas: un [[Título]] lleva a la página que se llama así',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({
    pages: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        aliases: z.array(z.string()),
        path: z.array(z.string()),
        tags: z.array(z.string()).describe('Sus etiquetas, para filtrar por #etiqueta')
      })
    )
  })
})

/** Una página que enlaza o nombra a otra, con el trozo donde lo hace */
const linkingPage = z.object({
  pageId: z.uuid(),
  title: z.string(),
  path: z.array(z.string()),
  fragment: z.string(),
  inSecret: z.boolean().describe('Si el enlace o la mención está dentro de un secreto o una nota oculta')
})

export const getPageLinks = defineAction({
  name: 'getPageLinks',
  kind: 'read',
  description:
    'Los enlaces de una página: las páginas que la enlazan (con el trozo donde lo hacen), adónde enlaza ella (y si esos enlaces están bien, sin resolver o rotos), dónde se la nombra sin enlazarla y las páginas que la apuntan desde un campo',
  input: z.object({ pageId: z.uuid(), ...readAs }),
  output: z.object({
    incoming: z.array(linkingPage),
    outgoing: z.array(
      z.object({
        pageId: z.uuid().nullable(),
        title: z.string(),
        anchor: z.string().nullable(),
        state: z.enum(['ok', 'missing', 'broken'])
      })
    ),
    mentions: z.array(linkingPage),
    /** Las que la apuntan desde un campo de enlace (como la Facción de un PNJ), con el nombre de esos campos */
    fields: z.array(
      z.object({ pageId: z.uuid(), title: z.string(), path: z.array(z.string()), fields: z.array(z.string()) })
    )
  })
})

export const listUnresolvedLinks = defineAction({
  name: 'listUnresolvedLinks',
  kind: 'read',
  description:
    'Los enlaces sin resolver de la wiki de un mundo: a páginas que aún no existen, con cuántas veces se enlazan y desde qué páginas. Al crear una página con ese título (o darle ese alias), se resuelven solos',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({
    links: z.array(
      z.object({
        title: z.string(),
        count: z.number().int(),
        pages: z.array(z.object({ id: z.uuid(), title: z.string() }))
      })
    )
  })
})

export const linkMention = defineAction({
  name: 'linkMention',
  kind: 'write',
  description: 'Convierte en enlace la primera vez que una página nombra a otra sin enlazarla',
  input: z.object({ sourcePageId: z.uuid(), targetPageId: z.uuid() }),
  output: z.object({ linked: z.boolean() })
})

export const getPageContent = defineAction({
  name: 'getPageContent',
  kind: 'read',
  description:
    'Lo de dentro de una página para enseñarlo en otra (vista previa o incrustado): su título, su ruta, su resumen y sus bloques en JSON del editor, o los de una sección (anchor: su título) o un bloque (anchor: ^id). Los incrustados de dentro llegan hasta 3 niveles',
  input: z.object({
    pageId: z.uuid(),
    anchor: z.string().trim().min(1).max(200).nullable().optional(),
    preview: z.boolean().optional().describe('Solo el principio, sin abrir lo incrustado dentro'),
    tabId: z.uuid().optional().describe('Lo de una pestaña de texto de la página, en lugar de su texto principal'),
    ...readAs
  }),
  output: z.object({
    page: z.object({
      id: z.uuid(),
      title: z.string(),
      icon: z.string().nullable(),
      path: z.array(z.object({ id: z.uuid(), title: z.string() })),
      summary: z.string().nullable(),
      cover: pageCover.nullable().describe('La portada: un archivo del mundo y su encuadre')
    }),
    blocks: z.array(z.record(z.string(), z.unknown())),
    truncated: z.boolean()
  })
})

const versionView = z.object({
  id: z.uuid(),
  at: z.string(),
  by: z.object({ id: z.string(), name: z.string() }).nullable(),
  via: z.enum(['ui', 'ai', 'system']),
  current: z.boolean().describe('Si es la versión en la que está ahora')
})

export const listPageVersions = defineAction({
  name: 'listPageVersions',
  kind: 'read',
  description:
    'Las versiones del texto de una página, de la más reciente a la más antigua: quién (una persona o Claude) y cuándo. Cada sesión de edición y cada cambio de Claude deja una',
  input: z.object({ pageId: z.uuid() }),
  output: z.object({ versions: z.array(versionView) })
})

export const getPageVersion = defineAction({
  name: 'getPageVersion',
  kind: 'read',
  description: 'Una versión del texto de una página, en solo lectura, con sus secretos',
  input: z.object({ pageId: z.uuid(), versionId: z.uuid() }),
  output: z.object({ version: versionView, blocks: z.array(z.record(z.string(), z.unknown())) })
})

export const restorePageVersion = defineAction({
  name: 'restorePageVersion',
  kind: 'write',
  description:
    'Deja el texto de una página como estaba en una versión. Es un cambio nuevo, que queda en el historial y se puede deshacer',
  input: z.object({ pageId: z.uuid(), versionId: z.uuid() }),
  output: z.object({ restored: z.boolean() })
})
