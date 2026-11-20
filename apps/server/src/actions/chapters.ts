/**
 * Los capítulos de los libros de un sistema (ADR-0025): leerlos (desde el sistema, o desde una campaña que tiene su
 * libro: sin sus secretos para quien no la dirige), escribirlos, ordenarlos y borrarlos (el propietario del sistema)
 */
import {
  type Chapter,
  deleteChapter,
  getChapter,
  listBookChapters,
  orderChapters,
  saveChapter
} from '@crisol/contracts'
import { chaptersRepo, systemImagesRepo, systemsRepo } from '@crisol/db'
import { can, NotFoundError } from '@crisol/domain'
import { markdownWithoutSecrets } from '@crisol/editor/markdown'
import { normalizeChoices, type System, textOf } from '@crisol/systems'
import { systemsChanged } from '../realtime/events.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { findReadable, ownWritable, readableOrganization } from './systems.ts'

const view = (row: chaptersRepo.ChapterRow, markdown = row.markdown): Chapter => ({
  id: row.id,
  source: row.source,
  title: row.title,
  position: row.position,
  version: row.version,
  master: row.master,
  markdown
})

/**
 * Dónde se lee: desde el sistema (quien puede leer los de su cuenta) o desde una campaña con ese sistema, solo los
 * libros que eligió; `master`: si ve los secretos y lo que es solo para el máster (ADR-0033)
 */
async function readingScope(
  ctx: ActionContext,
  systemId: string,
  source: string,
  campaignId: string | undefined,
  organizationId: string | undefined
) {
  if (campaignId) {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    if (campaign.system !== systemId) throw new NotFoundError('chapter')
    const found = await findReadable(ctx, campaign.organizationId, systemId)
    const { choices } = normalizeChoices(
      found.document,
      (campaign.systemChoices ?? {}) as Parameters<typeof normalizeChoices>[1]
    )
    if (!choices.sources.includes(source)) throw new NotFoundError('chapter')
    const master = can(ctx.actor, 'worldContent.read', {
      worldId: campaign.worldId,
      organizationId: campaign.organizationId
    })
    return { found, master, books: choices.sources }
  }
  const found = await findReadable(ctx, readableOrganization(ctx, organizationId), systemId)
  return { found, master: true, books: (found.document.sources ?? []).map((s) => s.key) }
}

/** Los `[[…]]` de un texto (no los `![[…]]` ni los `[[@…]]`): lo enlazado, tal como se escribió (Título#Sección) */
export function chapterTargets(markdown: string): string[] {
  const found = new Set<string>()
  for (const m of markdown.matchAll(/(?<!!)\[\[(?!@)([^\]|\n]*)(?:\|[^\]\n]*)?\]\]/g)) {
    const target = (m[1] ?? '').trim()
    if (target) found.add(target)
  }
  return [...found]
}

/** Las rutas de las imágenes que incrusta un texto (`![[ruta]]`, no las entradas `![[@…]]`) */
const imagePaths = (markdown: string) => [
  ...new Set([...markdown.matchAll(/!\[\[(?!@)([^\]|#\n]+)/g)].map((m) => (m[1] ?? '').trim()).filter(Boolean))
]

const fold = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
/** «Capítulo 4» vale por «Capítulo 4: Crear aventuras» (lo de antes de los dos puntos) */
const titleMatches = (title: string, wanted: string) => {
  const t = fold(title)
  const w = fold(wanted)
  return t === w || fold(title.split(':')[0] ?? '') === w
}

/**
 * A dónde lleva cada enlace de un capítulo (ADR-0033), con lo que ve quien lo lee: `[[#Sección]]` (este capítulo),
 * `[[Capítulo]]` (de este libro o, si no, de otro), `[[Libro]]` (su primer capítulo) y `[[Libro#Capítulo o sección]]`
 */
async function chapterLinks(
  ctx: ActionContext,
  document: System,
  systemId: string,
  here: chaptersRepo.ChapterRow,
  scope: { master: boolean; books: readonly string[] }
) {
  const targets = chapterTargets(here.markdown)
  if (targets.length === 0) return []
  const books = (document.sources ?? []).filter((s) => scope.books.includes(s.key) && (scope.master || !s.master))
  const visible = new Set(books.map((b) => b.key))
  const chapters = (await chaptersRepo.listChapters(ctx.db, systemId)).filter(
    (c) => visible.has(c.source) && (scope.master || !c.master)
  )
  const ref = (c: { id: string; source: string }) => ({ id: c.id, source: c.source })
  const bookOf = (name: string) =>
    books.find(
      (b) => fold(textOf(b.name)) === fold(name) || b.key === name.trim() || fold(textOf(b.name, 'en')) === fold(name)
    )
  return targets.map((target) => {
    const at = target.indexOf('#')
    const title = (at < 0 ? target : target.slice(0, at)).trim()
    const anchor = at < 0 ? null : target.slice(at + 1).trim() || null
    const none = { target, chapter: null, section: null }
    if (!title) return { target, chapter: ref(here), section: anchor }
    const sameBook = chapters.filter((c) => c.source === here.source)
    const chapter =
      sameBook.find((c) => titleMatches(c.title, title)) ?? chapters.find((c) => titleMatches(c.title, title))
    if (chapter) return { target, chapter: ref(chapter), section: anchor }
    const book = bookOf(title)
    if (!book) return none
    const own = chapters.filter((c) => c.source === book.key)
    const inBook = anchor ? own.find((c) => titleMatches(c.title, anchor)) : undefined
    if (inBook) return { target, chapter: ref(inBook), section: null }
    const first = own[0]
    return first ? { target, chapter: ref(first), section: anchor } : none
  })
}

const bookExists = (document: System, source: string) => (document.sources ?? []).some((s) => s.key === source)

/** Si un libro es solo para el máster: sus capítulos no los lee quien no dirige */
const masterBook = (document: System, source: string) =>
  Boolean((document.sources ?? []).find((s) => s.key === source)?.master)

export const chapterActions = [
  implement(listBookChapters, async (ctx, { systemId, source, campaignId, organizationId }) => {
    const { found, master } = await readingScope(ctx, systemId, source, campaignId, organizationId)
    if (!found.row) return { chapters: [], editable: false }
    // Lo que es solo para el máster no existe para quien no dirige: ni el libro entero ni esos capítulos
    const rows =
      master || !masterBook(found.document, source)
        ? (await chaptersRepo.listChapters(ctx.db, found.row.id, source)).filter((row) => master || !row.master)
        : []
    return {
      chapters: rows.map(({ id, source: s, title, position, version, master: only }) => ({
        id,
        source: s,
        title,
        position,
        version,
        master: only
      })),
      editable: !campaignId && can(ctx.actor, 'systems.write', { organizationId: found.row.organizationId })
    }
  }),

  implement(getChapter, async (ctx, { chapterId, campaignId }) => {
    const row = await chaptersRepo.findChapter(ctx.db, chapterId)
    if (!row) throw new NotFoundError('chapter')
    // Sin campaña, desde su sistema: con la organización de este (quien tiene varias no tiene que decirla)
    const organizationId = campaignId ? undefined : (await systemsRepo.findSystem(ctx.db, row.systemId))?.organizationId
    const scope = await readingScope(ctx, row.systemId, row.source, campaignId, organizationId)
    const { found, master } = scope
    if (!master && (row.master || masterBook(found.document, row.source))) throw new NotFoundError('chapter')
    const markdown = master ? row.markdown : markdownWithoutSecrets(row.markdown)
    // A dónde lleva cada enlace y el crédito de cada imagen (ADR-0033)
    const links = await chapterLinks(ctx, found.document, row.systemId, { ...row, markdown }, scope)
    const images = await systemImagesRepo.existingPaths(ctx.db, row.systemId, imagePaths(markdown))
    const credits = Object.fromEntries(
      [...images.entries()].flatMap(([path, image]) => (image.credit ? [[path, image.credit]] : []))
    )
    return { ...view(row, markdown), links, credits }
  }),

  implement(saveChapter, async (ctx, { systemId, source, chapterId, version, title, markdown, master }) => {
    const system = await ownWritable(ctx, systemId)
    const document = system.document as unknown as System
    if (!bookExists(document, source)) throw new InvalidRequestError('BAD_BOOK', `no hay un libro «${source}»`)
    const book = textOf(document.sources?.find((s) => s.key === source)?.name)
    const scope = { organizationId: system.organizationId }
    let row: chaptersRepo.ChapterRow
    if (chapterId) {
      const current = await chaptersRepo.findChapter(ctx.db, chapterId)
      if (!current || current.systemId !== systemId || current.source !== source) throw new NotFoundError('chapter')
      if (version === undefined) throw new InvalidRequestError('VERSION_REQUIRED', 'falta la versión que se tenía')
      try {
        row = await chaptersRepo.updateChapter(
          ctx.db,
          historyContext(ctx, 'updateChapter', { title: title ?? current.title, book }, scope),
          chapterId,
          version,
          {
            ...(title !== undefined ? { title } : {}),
            ...(markdown !== undefined ? { markdown } : {}),
            ...(master !== undefined ? { master } : {})
          }
        )
      } catch (error) {
        if (error instanceof chaptersRepo.ChapterChangedError)
          throw new InvalidRequestError('CHAPTER_CHANGED', 'el capítulo cambió mientras tanto: vuelve a leerlo')
        throw error
      }
    } else {
      if (!title) throw new InvalidRequestError('TITLE_REQUIRED', 'un capítulo nuevo necesita su título')
      row = await chaptersRepo.createChapter(ctx.db, historyContext(ctx, 'createChapter', { title, book }, scope), {
        systemId,
        source,
        title,
        markdown: markdown ?? '',
        master: master ?? false
      })
    }
    ctx.realtime.publish(systemsChanged(system.organizationId))
    return view(row)
  }),

  implement(orderChapters, async (ctx, { systemId, source, chapterIds }) => {
    const system = await ownWritable(ctx, systemId)
    const document = system.document as unknown as System
    const book = textOf(document.sources?.find((s) => s.key === source)?.name)
    const order = await chaptersRepo.orderChapters(
      ctx.db,
      historyContext(ctx, 'orderChapters', { book }, { organizationId: system.organizationId }),
      systemId,
      source,
      chapterIds
    )
    ctx.realtime.publish(systemsChanged(system.organizationId))
    return { chapterIds: order }
  }),

  implement(deleteChapter, async (ctx, { chapterId }) => {
    const row = await chaptersRepo.findChapter(ctx.db, chapterId)
    if (!row) throw new NotFoundError('chapter')
    const system = await ownWritable(ctx, row.systemId)
    await chaptersRepo.deleteChapter(
      ctx.db,
      historyContext(ctx, 'deleteChapter', { title: row.title }, { organizationId: system.organizationId }),
      chapterId
    )
    ctx.realtime.publish(systemsChanged(system.organizationId))
    return { ok: true as const }
  })
]
