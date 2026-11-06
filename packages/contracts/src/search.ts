import { z } from 'zod'
import { defineAction } from './action.ts'
import { readAs } from './pages.ts'

export const searchWiki = defineAction({
  name: 'searchWiki',
  kind: 'read',
  description:
    'Busca en la wiki de un mundo (títulos, alias, propiedades y texto, también en los secretos), en español: sin importar tildes ni mayúsculas, por la raíz de las palabras y con erratas. Devuelve las páginas de la que más coincide a la que menos, con las secciones donde sale y un extracto (lo encontrado, entre **). Se puede filtrar por etiqueta (con sus hijas: «lugar» también trae «lugar/ciudad») y por rama del árbol',
  input: z
    .object({
      worldId: z.uuid(),
      ...readAs,
      query: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe('Lo que se busca; sin ello (con template), todas las páginas de la plantilla, por título'),
      tag: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional()
        .describe('Solo las páginas con esta etiqueta (o una hija suya)'),
      branchId: z.uuid().optional().describe('Solo esta página y las que cuelgan de ella'),
      template: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .optional()
        .describe('Solo las páginas de esta plantilla o de sus copias: su id o su nombre (listar_plantillas)'),
      field: z
        .object({
          name: z.string().trim().min(1).max(60).describe('Un campo de enlace de la plantilla, por su nombre o su id'),
          page: z.string().trim().min(1).max(200).describe('La página a la que apunta: su título, un alias o su id')
        })
        .optional()
        .describe('Con template: solo las páginas cuyo campo apunta a esa página («PNJ cuyo Lugar es Ciudad Libre»)'),
      page: z.number().int().min(1).max(500).default(1).describe('De 20 en 20')
    })
    .refine((input) => input.query || input.template, { message: 'Hace falta query o template' })
    .refine((input) => !input.field || input.template, { message: 'field necesita template' }),
  output: z.object({
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    results: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        icon: z.string().nullable(),
        path: z.array(z.object({ id: z.uuid(), title: z.string() })),
        sections: z.array(
          z.object({
            heading: z.string().nullable(),
            headingId: z.string().nullable(),
            secret: z.boolean().describe('Sale de un secreto o de una nota oculta: solo lo ve el máster'),
            excerpt: z.string()
          })
        )
      })
    )
  })
})

export type SearchResult = z.infer<typeof searchWiki.output>['results'][number]
