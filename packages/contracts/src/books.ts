/**
 * Los libros de un sistema (ADR-0021, docs/specs/libros.md): las fuentes de su contenido, con portada, descripción, de
 * dónde salen y a qué amplían; y lo que propone la IA desde un PDF, pendiente de revisar hasta que se acepta
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { contentItem, systemRef } from './systems.ts'
import { worldCover } from './worlds.ts'

const bookKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'en minúsculas, sin espacios ni tildes (manual_jugador)')
  .max(60)
const bookName = z.string().trim().min(1).max(200)

/** Lo que se dice de un libro al crearlo o cambiarlo */
const bookFields = {
  name: bookName,
  description: z.string().trim().max(600).optional(),
  edition: z.string().trim().min(1).max(40).optional().describe('Su edición («2014», «2024»)'),
  license: z.string().trim().min(1).max(200).optional().describe('Su licencia (por defecto, «Uso privado»)'),
  attribution: z.string().trim().max(4000).optional(),
  publisher: z.string().trim().max(200).optional(),
  origin: z.enum(['pdf', 'file', 'own']).optional().describe('De un PDF (con la IA), de un archivo o hecho a mano'),
  file: z.uuid().optional().describe('El PDF de la biblioteca del que sale (listar con ver_biblioteca)'),
  cover: worldCover.optional().describe('Su portada: una imagen de los archivos comunes, encuadrada'),
  requires: z.array(bookKey).max(20).optional().describe('Las claves de los libros de este sistema a los que amplía')
}

export const book = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  edition: z.string().nullable(),
  license: z.string(),
  attribution: z.string(),
  publisher: z.string().nullable(),
  origin: z.enum(['pdf', 'file', 'own']).nullable(),
  file: z.uuid().nullable(),
  cover: worldCover.nullable(),
  requires: z.array(z.string()),
  version: z.int(),
  count: z.int().describe('Cuántas entradas aceptadas trae'),
  byType: z.array(z.object({ type: z.string(), label: z.string(), count: z.int(), examples: z.array(z.string()) })),
  pending: z.int().describe('Cuántas esperan a que se revisen'),
  campaigns: z.array(z.object({ id: z.uuid(), worldId: z.uuid(), name: z.string() })).describe('Las que lo usan')
})

export type Book = z.infer<typeof book>

export const getSystemBooks = defineAction({
  name: 'getSystemBooks',
  kind: 'read',
  description:
    'Los libros de un sistema (de serie o de la cuenta): de cada uno, su portada, su descripción, de dónde sale, a qué amplía, cuánto trae por tipo (con unos ejemplos), cuánto tiene pendiente de revisar y qué campañas lo usan',
  input: z.object({ systemId: systemRef, organizationId: z.uuid().optional() }),
  output: z.object({
    systemId: z.string(),
    name: z.string(),
    version: z.int().describe('La versión del sistema (para crear, cambiar o borrar libros)'),
    editable: z.boolean().describe('Si quien lo ve puede cambiar sus libros (un sistema de la cuenta, y es suyo)'),
    books: z.array(book)
  })
})

export const createBook = defineAction({
  name: 'createBook',
  kind: 'write',
  description:
    'Añade un libro a un sistema de la cuenta (con la versión del sistema que se leyó). Sin clave, sale de su nombre. Para meterle entradas desde un PDF, proponer_contenido; a mano, guardar_contenido con su clave como source',
  input: z.object({
    systemId: z.uuid(),
    version: z.int().min(1),
    key: bookKey.optional(),
    ...bookFields
  }),
  output: z.object({ version: z.int(), key: z.string() })
})

export const updateBook = defineAction({
  name: 'updateBook',
  kind: 'write',
  description:
    'Cambia un libro de un sistema de la cuenta: solo lo que se pase (null quita la descripción, el PDF o la portada); newVersion sube su versión',
  input: z.object({
    systemId: z.uuid(),
    version: z.int().min(1),
    key: bookKey,
    name: bookName.optional(),
    description: z.string().trim().max(600).nullable().optional(),
    edition: z.string().trim().min(1).max(40).nullable().optional(),
    license: z.string().trim().min(1).max(200).optional(),
    attribution: z.string().trim().max(4000).optional(),
    publisher: z.string().trim().max(200).nullable().optional(),
    file: z.uuid().nullable().optional(),
    cover: worldCover.nullable().optional(),
    requires: z.array(bookKey).max(20).optional(),
    newVersion: z.literal(true).optional().describe('Sube su versión (al traer una nueva)')
  }),
  output: z.object({ version: z.int() })
})

export const deleteBook = defineAction({
  name: 'deleteBook',
  kind: 'delete',
  description:
    'Quita un libro de un sistema de la cuenta con todo su contenido, si no lo usa ninguna campaña (BOOK_IN_USE, con cuáles). Se deshace desde el historial',
  input: z.object({ systemId: z.uuid(), version: z.int().min(1), key: bookKey }),
  output: z.object({ version: z.int(), deleted: z.int().describe('Cuántas entradas se fueron con él') })
})

/** Lo de una entrada propuesta: de qué página sale, el trozo del PDF y lo que falta o no está claro */
export const contentReview = z.object({
  page: z.int().min(1).max(10_000).optional().describe('Su página en el PDF'),
  excerpt: z.string().max(6000).optional().describe('El texto del PDF del que sale, tal cual (para revisarlo al lado)'),
  notes: z
    .array(z.string().max(300))
    .max(10)
    .optional()
    .describe('Lo que falta o no está claro («sin tiempo de lanzamiento: queda en 1 acción»)')
})

export const proposeContent = defineAction({
  name: 'proposeContent',
  kind: 'write',
  description:
    'Propone entradas para un libro de un sistema de la cuenta, sacadas de su PDF: quedan pendientes de revisar (el máster las acepta o las descarta) y no se ven hasta entonces. Por tandas de hasta 100; con su página, el texto del PDF y sus avisos. Una pendiente con la misma clave se sustituye; una ya aceptada no se toca (taken). Lo que ya existe con el mismo nombre en otro libro se marca repetido',
  input: z.object({
    systemId: z.uuid(),
    source: bookKey.describe('La clave del libro'),
    items: z
      .array(contentItem.omit({ source: true }).extend({ review: contentReview }))
      .min(1)
      .max(100)
  }),
  output: z.object({
    proposed: z.array(z.string()),
    taken: z.array(z.string()).describe('Claves que ya son de entradas aceptadas: no se tocaron'),
    repeated: z.array(z.string()).describe('Las que se llaman como una que ya hay en otro libro'),
    warnings: z.array(z.object({ key: z.string(), message: z.string() }))
  })
})

export const pendingEntry = z.object({
  key: z.string(),
  type: z.string(),
  name: z.string(),
  source: z.string().nullable(),
  page: z.int().nullable(),
  excerpt: z.string().nullable(),
  notes: z.array(z.string()),
  repeats: z.object({ key: z.string(), source: z.string().nullable(), name: z.string() }).nullable(),
  item: contentItem.describe('La entrada entera, como quedaría')
})

export type PendingEntry = z.infer<typeof pendingEntry>

export const listPending = defineAction({
  name: 'listPending',
  kind: 'read',
  description:
    'Lo pendiente de revisar de un libro de un sistema de la cuenta: cuántas hay de cada tipo y las de un tipo (sin tipo, las del primero)',
  input: z.object({ systemId: z.uuid(), source: bookKey, type: z.string().max(60).optional() }),
  output: z.object({
    counts: z.array(z.object({ type: z.string(), label: z.string(), count: z.int() })),
    type: z.string().nullable(),
    items: z.array(pendingEntry)
  })
})

export const settlePending = defineAction({
  name: 'settlePending',
  kind: 'write',
  description:
    'Acepta (con su tipo cambiado, si hace falta) o descarta entradas pendientes de revisar de un sistema de la cuenta. Lo aceptado ya se ve en el compendio de las campañas que usan su libro',
  input: z
    .object({
      systemId: z.uuid(),
      accept: z.array(z.string().max(100)).max(2000).optional(),
      discard: z.array(z.string().max(100)).max(2000).optional(),
      types: z
        .record(z.string().max(100), z.string().max(60))
        .optional()
        .describe('El tipo nuevo de alguna, por su clave')
    })
    .refine((v) => (v.accept?.length ?? 0) + (v.discard?.length ?? 0) > 0, { message: 'accept o discard' }),
  output: z.object({ version: z.int(), accepted: z.array(z.string()), discarded: z.array(z.string()) })
})

export const getBookEntries = defineAction({
  name: 'getBookEntries',
  kind: 'read',
  description:
    'Las entradas aceptadas de un libro de un sistema (su clave, su tipo y su nombre), por tipo y en el orden del sistema: para elegir cuáles deja fuera una campaña',
  input: z.object({ systemId: systemRef, source: z.string().max(60), organizationId: z.uuid().optional() }),
  output: z.object({
    types: z.array(
      z.object({
        type: z.string(),
        label: z.string(),
        entries: z.array(z.object({ key: z.string(), name: z.string() }))
      })
    )
  })
})
