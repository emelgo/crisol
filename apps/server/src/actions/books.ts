/**
 * Los libros de un sistema (ADR-0021, docs/specs/libros.md): las fuentes de su documento, con portada, descripción, de
 * dónde salen y a qué amplían, y lo que la IA propone desde un PDF, pendiente de revisar hasta que el máster lo acepta.
 * Todo lo que escribe pasa por el historial
 */
import {
  createBook,
  deleteBook,
  getBookEntries,
  getSystemBooks,
  importBook,
  listPending,
  type PendingEntry,
  proposeContent,
  settlePending,
  updateBook
} from '@crisol/contracts'
import { campaignsRepo, chaptersRepo, systemsRepo } from '@crisol/db'
import { can } from '@crisol/domain'
import {
  type ContentItem,
  LIMITS,
  normalizeChoices,
  type System,
  summarizeBooks,
  textOf,
  validateContent
} from '@crisol/systems'
import { systemsChanged } from '../realtime/events.ts'
import { contentOf } from './content-of.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { changed, findReadable, invalid, ownWritable, readableOrganization, validated } from './systems.ts'

type Source = NonNullable<System['sources']>[number]
type Campaigns = { id: string; worldId: string; name: string }[]

/** Una clave de libro a partir de su nombre: «Manual del jugador» → manual_del_jugador (sin repetir otra) */
export function bookKeyOf(name: string, taken: ReadonlySet<string>) {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'libro_$1')
      .slice(0, 50) || 'libro'
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const nameOf = (name: unknown) => textOf(name as Parameters<typeof textOf>[0])

/** Los campos del libro que pueden ir en varios idiomas */
const TEXTS = new Set(['name', 'description', 'attribution', 'publisher'])

/** Un texto nuevo en español: si el de antes iba en varios idiomas, solo cambia el suyo */
const withText = (current: unknown, value: string) =>
  current && typeof current === 'object' ? { ...(current as Record<string, string>), es: value } : value

/** Las campañas que usan cada libro del sistema (las que lo eligieron; sin elegir, todos) */
async function usersOf(ctx: ActionContext, document: System, systemId: string, organizationId: string | null) {
  const all = organizationId === null || can(ctx.actor, 'systems.write', { organizationId })
  const byBook = new Map<string, Campaigns>()
  for (const c of await campaignsRepo.campaignsUsingSystems(ctx.db, [systemId])) {
    if (!all && !can(ctx.actor, 'campaign.read', { campaignId: c.id, worldId: c.worldId })) continue
    const { choices } = normalizeChoices(document, (c.systemChoices ?? {}) as Record<string, unknown>)
    for (const key of choices.sources)
      byBook.set(key, [...(byBook.get(key) ?? []), { id: c.id, worldId: c.worldId, name: c.name }])
  }
  return byBook
}

/** Lo que se pide al cambiar los libros, comprobado antes de pedir la aprobación a quien lleva la IA */
export async function bookRequest(ctx: ActionContext, action: string, input: Record<string, unknown>) {
  if (!['createBook', 'updateBook', 'deleteBook', 'proposeContent', 'settlePending'].includes(action)) return {}
  const row = await ownWritable(ctx, String(input.systemId))
  const system = row.document as unknown as System
  const key = String(input.key ?? input.source ?? '')
  const named = system.sources?.find((s) => s.key === key)
  return {
    system: textOf(system.name),
    book: typeof input.name === 'string' ? input.name : named ? nameOf(named.name) : key,
    ...(Array.isArray(input.items) ? { count: input.items.length } : {})
  }
}

export const bookActions = [
  implement(getSystemBooks, async (ctx, { systemId, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const found = await findReadable(ctx, target, systemId)
    const id = found.row ? found.row.id : found.document.id
    const index = found.row ? await systemsRepo.contentIndex(ctx.db, found.row.id) : []
    const summaries = new Map(summarizeBooks(found.document, index).map((s) => [s.key, s]))
    const users = found.row
      ? await usersOf(ctx, found.document, found.row.id, found.row.organizationId)
      : new Map<string, Campaigns>()
    const chapters = found.row ? await chaptersRepo.chapterCounts(ctx.db, found.row.id) : new Map<string, number>()
    return {
      systemId: id,
      name: textOf(found.document.name),
      version: found.row ? found.row.version : 1,
      editable: !!found.row && can(ctx.actor, 'systems.write', { organizationId: found.row.organizationId }),
      books: (found.document.sources ?? []).map((source) => {
        const summary = summaries.get(source.key)
        return {
          key: source.key,
          name: nameOf(source.name),
          description: source.description ? textOf(source.description) : null,
          edition: source.edition ?? null,
          license: source.license,
          attribution: textOf(source.attribution),
          publisher: source.publisher ? textOf(source.publisher) : null,
          origin: source.origin ?? null,
          file: source.file ?? null,
          cover: source.cover ?? null,
          color: source.color ?? null,
          requires: source.requires ?? [],
          master: source.master ?? false,
          version: source.version ?? 1,
          count: summary?.count ?? 0,
          byType: summary?.byType ?? [],
          pending: summary?.pending ?? 0,
          chapters: chapters.get(source.key) ?? 0,
          campaigns: users.get(source.key) ?? []
        }
      })
    }
  }),

  implement(getBookEntries, async (ctx, { systemId, source, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const found = await findReadable(ctx, target, systemId)
    const index = found.row ? await systemsRepo.contentIndex(ctx.db, found.row.id) : []
    const mine = index.filter((entry) => entry.source === source && !entry.review)
    return {
      types: Object.keys(found.document.types).flatMap((type) => {
        const entries = mine
          .filter((entry) => entry.type === type)
          .map((entry) => ({ key: entry.key, name: nameOf(entry.name) || entry.key }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        return entries.length > 0 ? [{ type, label: textOf(found.document.types[type]?.label) || type, entries }] : []
      })
    }
  }),

  implement(importBook, async (ctx, { systemId, version, items, ...fields }) => {
    const row = await ownWritable(ctx, systemId)
    const document = row.document as unknown as System
    const key = bookKeyOf(fields.name, new Set((document.sources ?? []).map((s) => s.key)))
    const source = {
      key,
      name: fields.name,
      license: fields.license ?? 'Uso privado',
      attribution: fields.attribution || fields.name,
      ...(fields.edition ? { edition: fields.edition } : {}),
      ...(fields.publisher ? { publisher: fields.publisher } : {}),
      ...(fields.description ? { description: fields.description } : {}),
      origin: fields.origin ?? 'file',
      ...(fields.requires?.length ? { requires: fields.requires } : {}),
      version: 1
    }
    const { system } = validated({ ...structuredClone(document), sources: [...(document.sources ?? []), source] })
    const given = items.map((item) => ({ ...item, source: key }) as unknown as ContentItem)
    const problems = validateContent(system, given)
    if (problems.some((p) => p.severity === 'error')) invalid(problems)
    const counts = await systemsRepo.contentCounts(ctx.db, [row.id])
    if ((counts.get(row.id) ?? 0) + given.length > LIMITS.contentDocuments)
      throw new InvalidRequestError('TOO_MUCH_CONTENT', `como mucho, ${LIMITS.contentDocuments} documentos`)
    let done: Awaited<ReturnType<typeof systemsRepo.createBookWith>>
    try {
      done = await systemsRepo.createBookWith(
        ctx.db,
        historyContext(
          ctx,
          'createBook',
          { name: fields.name, system: textOf(document.name), count: given.length },
          { organizationId: row.organizationId }
        ),
        row.id,
        version,
        system as unknown as Record<string, unknown>,
        key,
        given.map((item) => ({
          type: item.type,
          key: item.key,
          source: key,
          data: item.data,
          concept: item.concept ?? null,
          mechanics: (item.mechanics as Record<string, unknown> | undefined) ?? null,
          ref: (item.ref as Record<string, unknown> | undefined) ?? null,
          img: item.img ?? null,
          table: (item.table as Record<string, unknown> | undefined) ?? null
        }))
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError) throw changed()
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return { version: done.system.version, key, count: done.count, renamed: done.renamed }
  }),

  implement(createBook, async (ctx, { systemId, version, key, ...fields }) => {
    const row = await ownWritable(ctx, systemId)
    const document = row.document as unknown as System
    const taken = new Set((document.sources ?? []).map((s) => s.key))
    if (key && taken.has(key)) throw new InvalidRequestError('BOOK_EXISTS', `ya hay un libro «${key}»`)
    const chosen = key ?? bookKeyOf(fields.name, taken)
    const source = {
      key: chosen,
      name: fields.name,
      license: fields.license ?? 'Uso privado',
      attribution: fields.attribution || fields.name,
      ...(fields.edition ? { edition: fields.edition } : {}),
      ...(fields.publisher ? { publisher: fields.publisher } : {}),
      ...(fields.description ? { description: fields.description } : {}),
      ...(fields.origin ? { origin: fields.origin } : {}),
      ...(fields.file ? { file: fields.file } : {}),
      ...(fields.cover ? { cover: fields.cover } : {}),
      ...(fields.requires?.length ? { requires: fields.requires } : {}),
      version: 1
    }
    const { system } = validated({ ...structuredClone(document), sources: [...(document.sources ?? []), source] })
    const updated = await save(ctx, row, version, system, 'createBook', {
      name: fields.name,
      system: textOf(document.name)
    })
    return { version: updated.version, key: chosen }
  }),

  implement(updateBook, async (ctx, { systemId, version, key, newVersion, ...changes }) => {
    const row = await ownWritable(ctx, systemId)
    const document = row.document as unknown as System
    const at = (document.sources ?? []).findIndex((s) => s.key === key)
    const current = document.sources?.[at]
    if (!current) throw new InvalidRequestError('BAD_BOOK', `no hay un libro «${key}»`)
    const next: Record<string, unknown> = { ...current }
    for (const [field, value] of Object.entries(changes)) {
      if (value === undefined) continue
      if (value === null || (Array.isArray(value) && value.length === 0)) delete next[field]
      // Un texto en varios idiomas cambia el suyo (el español) sin perder los otros
      else if (typeof value === 'string' && TEXTS.has(field)) next[field] = withText(next[field], value)
      else next[field] = value
    }
    if (newVersion) next.version = (current.version ?? 1) + 1
    const sources = [...(document.sources ?? [])]
    sources[at] = next as Source
    const { system } = validated({ ...structuredClone(document), sources })
    const updated = await save(ctx, row, version, system, 'updateBook', {
      name: nameOf(next.name),
      system: textOf(document.name)
    })
    return { version: updated.version }
  }),

  implement(deleteBook, async (ctx, { systemId, version, key }) => {
    const row = await ownWritable(ctx, systemId)
    const document = row.document as unknown as System
    const current = document.sources?.find((s) => s.key === key)
    if (!current) throw new InvalidRequestError('BAD_BOOK', `no hay un libro «${key}»`)
    const using = (await usersOf(ctx, document, row.id, null)).get(key) ?? []
    if (using.length > 0)
      throw new InvalidRequestError(
        'BOOK_IN_USE',
        `lo usa${using.length > 1 ? 'n' : ''} ${using.map((c) => `«${c.name}»`).join(', ')}`
      )
    // Sin él, y sin que otro diga que lo amplía
    const sources = (document.sources ?? [])
      .filter((s) => s.key !== key)
      .map((s) => {
        if (!s.requires?.includes(key)) return s
        const requires = s.requires.filter((k) => k !== key)
        const { requires: _, ...rest } = s
        return requires.length > 0 ? { ...rest, requires } : rest
      })
    const { system } = validated({ ...structuredClone(document), sources })
    let done: Awaited<ReturnType<typeof systemsRepo.deleteBook>>
    try {
      done = await systemsRepo.deleteBook(
        ctx.db,
        historyContext(
          ctx,
          'deleteBook',
          { name: nameOf(current.name), system: textOf(document.name) },
          { organizationId: row.organizationId }
        ),
        row.id,
        version,
        system as unknown as Record<string, unknown>,
        key
      )
    } catch (error) {
      if (error instanceof systemsRepo.SystemChangedError) throw changed()
      throw error
    }
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return { version: done.system.version, deleted: done.deleted }
  }),

  implement(proposeContent, async (ctx, { systemId, source, items }) => {
    const row = await ownWritable(ctx, systemId)
    const system = row.document as unknown as System
    if (!system.sources?.some((s) => s.key === source))
      throw new InvalidRequestError('BAD_BOOK', `no hay un libro «${source}»`)
    const given = items.map(({ review: _, ...item }) => ({ ...item, source }) as unknown as ContentItem)
    const problems = validateContent(system, given)
    if (problems.some((p) => p.severity === 'error')) invalid(problems)
    const index = await systemsRepo.contentIndex(ctx.db, row.id)
    if (index.length + given.length > LIMITS.contentDocuments)
      throw new InvalidRequestError('TOO_MUCH_CONTENT', `como mucho, ${LIMITS.contentDocuments} documentos`)
    // Lo que ya está, aceptado, en otro libro y con el mismo nombre y tipo: repetido
    const accepted = new Map<string, { key: string; source: string | null; name: string }>()
    for (const entry of index) {
      if (entry.review || entry.source === source) continue
      for (const name of Object.values(namesIn(entry.name)))
        accepted.set(`${entry.type}|${fold(name)}`, { key: entry.key, source: entry.source, name })
    }
    const repeated: string[] = []
    const values = items.map((item, i) => {
      const content = given[i] as ContentItem
      const repeats = Object.values(namesIn(item.data.name))
        .map((name) => accepted.get(`${item.type}|${fold(name)}`))
        .find(Boolean)
      if (repeats) repeated.push(item.key)
      return {
        type: content.type,
        key: content.key,
        source,
        data: content.data,
        concept: content.concept ?? null,
        mechanics: (content.mechanics as Record<string, unknown> | undefined) ?? null,
        ref: {
          ...((content.ref as Record<string, unknown> | undefined) ?? {}),
          ...(item.review.page ? { pages: { es: item.review.page } } : {})
        },
        img: content.img ?? null,
        table: (content.table as Record<string, unknown> | undefined) ?? null,
        review: { ...item.review, notes: item.review.notes ?? [], ...(repeats ? { repeats } : {}) }
      }
    })
    const done = await systemsRepo.proposeContent(
      ctx.db,
      historyContext(
        ctx,
        'proposeContent',
        {
          name: nameOf(system.sources.find((s) => s.key === source)?.name),
          system: textOf(system.name),
          count: values.length
        },
        { organizationId: row.organizationId }
      ),
      row.id,
      values
    )
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return {
      proposed: done.proposed,
      taken: done.taken,
      repeated: repeated.filter((k) => done.proposed.includes(k)),
      warnings: problems
        .filter((p) => p.severity === 'warning')
        .map((p) => ({ key: String(p.path.split('.')[0] ?? ''), message: `${p.where}: ${p.message}` }))
    }
  }),

  implement(listPending, async (ctx, { systemId, source, type }) => {
    const row = await ownWritable(ctx, systemId)
    const system = row.document as unknown as System
    const rows = await systemsRepo.listPending(ctx.db, row.id, source)
    const order = Object.keys(system.types)
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    const types = [...counts.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const chosen = type && counts.has(type) ? type : (types[0] ?? null)
    return {
      counts: types.map((t) => ({ type: t, label: textOf(system.types[t]?.label) || t, count: counts.get(t) ?? 0 })),
      type: chosen,
      items: rows
        .filter((r) => r.type === chosen)
        .map((r): PendingEntry => {
          const review = r.review ?? {}
          const { review: _, ...item } = contentOf(r) as ContentItem & { review?: unknown }
          return {
            key: r.key,
            type: r.type,
            name: nameOf(r.data.name) || r.key,
            source: r.source,
            page: review.page ?? null,
            excerpt: review.excerpt ?? null,
            notes: review.notes ?? [],
            repeats: review.repeats ?? null,
            item: item as PendingEntry['item']
          }
        })
    }
  }),

  implement(settlePending, async (ctx, { systemId, accept = [], discard = [], types = {} }) => {
    const row = await ownWritable(ctx, systemId)
    const system = row.document as unknown as System
    for (const [key, type] of Object.entries(types))
      if (!system.types[type]) throw new InvalidRequestError('BAD_TYPE', `«${key}»: no existe el tipo «${type}»`)
    // Lo que cambia de tipo tiene que valer con su tipo nuevo antes de verse
    const retyped = Object.keys(types).filter((key) => accept.includes(key))
    if (retyped.length > 0) {
      const rows = (await systemsRepo.listPending(ctx.db, row.id)).filter((r) => retyped.includes(r.key))
      const items = rows.map((r) => {
        const { review: _, ...item } = contentOf(r) as ContentItem & { review?: unknown }
        return { ...item, type: types[r.key] as string } as ContentItem
      })
      const problems = validateContent(system, items)
      if (problems.some((p) => p.severity === 'error')) invalid(problems)
    }
    const done = await systemsRepo.settlePending(
      ctx.db,
      historyContext(
        ctx,
        'settlePending',
        { system: textOf(system.name), accepted: accept.length, discarded: discard.length },
        { organizationId: row.organizationId }
      ),
      row.id,
      { accept, discard, types }
    )
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return { version: done.system.version, accepted: done.accepted, discarded: done.discarded }
  })
]

/** Los nombres de una entrada, en sus idiomas */
function namesIn(name: unknown): Record<string, string> {
  if (typeof name === 'string') return { es: name }
  if (name && typeof name === 'object')
    return Object.fromEntries(Object.entries(name).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  return {}
}

/** Guarda el documento con sus libros cambiados, con la versión que se tenía */
async function save(
  ctx: ActionContext,
  row: systemsRepo.SystemRow,
  version: number,
  system: System,
  action: string,
  details: Record<string, unknown>
) {
  try {
    const updated = await systemsRepo.updateSystem(
      ctx.db,
      historyContext(ctx, action, details, { organizationId: row.organizationId }),
      row.id,
      version,
      system as unknown as Record<string, unknown>
    )
    ctx.realtime.publish(systemsChanged(row.organizationId))
    return updated
  } catch (error) {
    if (error instanceof systemsRepo.SystemChangedError) throw changed()
    throw error
  }
}
