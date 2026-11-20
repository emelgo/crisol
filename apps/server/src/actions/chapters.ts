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
import { chaptersRepo, systemsRepo } from '@crisol/db'
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
    return { found, master }
  }
  const found = await findReadable(ctx, readableOrganization(ctx, organizationId), systemId)
  return { found, master: true }
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
    const { found, master } = await readingScope(ctx, row.systemId, row.source, campaignId, organizationId)
    if (!master && (row.master || masterBook(found.document, row.source))) throw new NotFoundError('chapter')
    return view(row, master ? row.markdown : markdownWithoutSecrets(row.markdown))
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
