/**
 * Las notas del jugador (docs/specs/notas-jugador.md): las escribe su autor y las leen él y los másteres de la campaña
 * y del mundo. A otro jugador no le existen (ni su título). Sus enlaces se resuelven con lo que conoce su campaña por
 * los personajes de su autor (docs/specs/conocimiento.md)
 */
import {
  createPlayerNote,
  deletePlayerNote,
  getPlayerNote,
  listPlayerNotes,
  listPlayerNoteVersions,
  type PlayerNote,
  type PlayerNoteItem,
  restorePlayerNote,
  updatePlayerNote
} from '@crisol/contracts'
import { campaignsRepo, knowledgeRepo, membersRepo, notesRepo, pagesRepo } from '@crisol/db'
import { can, ForbiddenError, foldName, type NamedPage, NotFoundError, reservedList, resolveName } from '@crisol/domain'
import { activityChanged } from '../realtime/events.ts'
import { propertiesOf } from '../wiki/properties.ts'
import { viewFor } from '../wiki/reader.ts'
import { authorizedCampaign } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type Campaign = NonNullable<Awaited<ReturnType<typeof campaignsRepo.findCampaign>>>
type Note = notesRepo.NoteRow

/** Las versiones que se enseñan, como mucho */
const VERSIONS = 50

/** `[[Título]]`, `[[Título#Sección]]` o `[[Título|texto]]`; sin `![[` (incrustar) ni `[[@` (el compendio) */
const LINK = /(!?)\[\[(?!@)([^[\]\n|#]+?)(?:#[^[\]\n|]*)?(?:\|[^[\]\n]*)?\]\]/g

/** Los nombres de los enlaces de un texto, una vez cada uno y en el orden en que salen */
export function linkTitles(markdown: string): string[] {
  const seen = new Map<string, string>()
  for (const match of markdown.matchAll(LINK)) {
    if (match[1]) continue
    const title = (match[2] ?? '').trim()
    if (title && !seen.has(foldName(title))) seen.set(foldName(title), title)
  }
  return [...seen.values()]
}

const iso = (date: Date) => date.toISOString()

const item = (note: Note): PlayerNoteItem => ({
  id: note.id,
  parentId: note.parentId,
  title: note.title,
  icon: note.icon,
  version: note.version,
  updatedAt: iso(note.updatedAt),
  deletedAt: note.deletedAt ? iso(note.deletedAt) : null
})

/**
 * Los enlaces de una nota, con la página del mundo a la que llevan si la conoce su campaña por los personajes de su
 * autor. Solo por el título y los alias de las que conoce: nada de rutas, que nombrarían madres que no conoce
 */
async function linksOf(ctx: ActionContext, campaign: Campaign, note: Note): Promise<PlayerNote['links']> {
  const titles = linkTitles(note.markdown)
  if (titles.length === 0) return []
  const [knows, characterIds] = await Promise.all([
    knowledgeRepo.knowsWorld(ctx.db, [campaign.id]),
    knowledgeRepo.characterIdsOf(ctx.db, campaign.id, note.userId)
  ])
  const reader = {
    kind: 'player' as const,
    campaignId: campaign.id,
    characterIds,
    knowsWorld: knows.get(campaign.id) ?? true
  }
  const [view, rows] = await Promise.all([
    viewFor(ctx, campaign.worldId, reader),
    pagesRepo.pageNames(ctx.db, campaign.worldId)
  ])
  const names: NamedPage[] = view.pages(rows).map((row) => ({
    id: row.id,
    title: row.title,
    aliases: reservedList(propertiesOf(row.properties), 'alias'),
    path: [row.title]
  }))
  return titles.map((title) => {
    const found = resolveName(title, names)
    return { title, pageId: found.length === 1 ? (found[0]?.id ?? null) : null }
  })
}

async function present(ctx: ActionContext, campaign: Campaign, note: Note): Promise<PlayerNote> {
  return {
    ...item(note),
    campaignId: note.campaignId,
    userId: note.userId,
    markdown: note.markdown,
    links: await linksOf(ctx, campaign, note),
    editable: owns(ctx, campaign, note),
    createdAt: iso(note.createdAt)
  }
}

const targetOf = (campaign: Campaign) => ({ campaignId: campaign.id, worldId: campaign.worldId })

/** Si es suya y sigue en la campaña: entonces la escribe */
const owns = (ctx: ActionContext, campaign: Campaign, note: Note) =>
  note.userId === ctx.actor.userId && can(ctx.actor, 'notes.write', targetOf(campaign))

/**
 * Una nota que la cuenta puede leer (la suya o, un máster, cualquiera de su campaña) con su campaña y las de su autor
 * allí. Si no, «no existe». Con write, además tiene que ser suya; con trashed, de la papelera (si no, fuera de ella)
 */
async function readableNote(ctx: ActionContext, id: string, options: { write?: boolean; trashed?: boolean } = {}) {
  const note = await notesRepo.findNote(ctx.db, id)
  const campaign = note ? await campaignsRepo.findCampaign(ctx.db, note.campaignId) : null
  if (!note || !campaign) throw new NotFoundError('note')
  const own = owns(ctx, campaign, note)
  if (!own && !can(ctx.actor, 'notes.read', targetOf(campaign))) throw new NotFoundError('note')
  const rows = await notesRepo.notesOf(ctx.db, note.campaignId, note.userId)
  const live = notesRepo.visibleNotes(rows).some((row) => row.id === note.id)
  if (options.trashed ? !note.deletedAt : !live) throw new NotFoundError('note')
  if (options.write && !own) throw new ForbiddenError('note')
  return { note, campaign, rows }
}

/** La madre que se pide: una nota suya de esa campaña, fuera de la papelera */
function checkParent(rows: readonly Note[], parentId: string | null, moving?: Note) {
  if (!parentId) return
  if (!notesRepo.visibleNotes(rows).some((row) => row.id === parentId)) throw new NotFoundError('note')
  if (moving && (parentId === moving.id || notesRepo.below(rows, moving.id).some((row) => row.id === parentId)))
    throw new InvalidRequestError('NOTE_CYCLE', 'no se puede meter una nota dentro de sí misma')
}

const contextOf = (ctx: ActionContext, campaign: Campaign, action: string, title: string) =>
  historyContext(ctx, action, { title, campaign: campaign.name }, campaign)

export const noteActions = [
  implement(listPlayerNotes, async (ctx, { campaignId, userId, trash }) => {
    const campaign = await authorizedCampaign(ctx, 'campaign.read', campaignId)
    const whose = userId ?? ctx.actor.userId
    // Las de otro, solo un máster; a los demás no les existen
    if (whose !== ctx.actor.userId && !can(ctx.actor, 'notes.read', targetOf(campaign)))
      throw new NotFoundError('campaign')
    const rows = await notesRepo.notesOf(ctx.db, campaign.id, whose)
    const notes = trash ? rows.filter((row) => row.deletedAt) : notesRepo.visibleNotes(rows)
    return { notes: notesRepo.inTreeOrder(notes).map(item) }
  }),

  implement(getPlayerNote, async (ctx, { id }) => {
    const { note, campaign } = await readableNote(ctx, id)
    return { note: await present(ctx, campaign, note) }
  }),

  implement(createPlayerNote, async (ctx, input) => {
    const campaign = await authorizedCampaign(ctx, 'notes.write', input.campaignId)
    const rows = await notesRepo.notesOf(ctx.db, campaign.id, ctx.actor.userId)
    checkParent(rows, input.parentId)
    const note = await notesRepo.createNote(ctx.db, contextOf(ctx, campaign, 'createPlayerNote', input.title), {
      campaignId: campaign.id,
      userId: ctx.actor.userId,
      parentId: input.parentId,
      title: input.title,
      icon: input.icon,
      markdown: input.markdown
    })
    // Al máster, en su centro de actividad
    ctx.realtime.publish(activityChanged(targetOf(campaign), true))
    return { note: await present(ctx, campaign, note) }
  }),

  implement(updatePlayerNote, async (ctx, { id, version, ...patch }) => {
    const { note, campaign, rows } = await readableNote(ctx, id, { write: true })
    if (patch.parentId !== undefined) checkParent(rows, patch.parentId, note)
    const title = patch.title ?? note.title
    const details = { title, campaign: campaign.name, ...(patch.title !== undefined ? { from: note.title } : {}) }
    try {
      const updated = await notesRepo.updateNote(
        ctx.db,
        historyContext(ctx, 'updatePlayerNote', details, campaign),
        id,
        version,
        patch
      )
      ctx.realtime.publish(activityChanged(targetOf(campaign), true))
      return { note: await present(ctx, campaign, updated) }
    } catch (error) {
      if (error instanceof notesRepo.NoteChangedError)
        throw new InvalidRequestError('NOTE_CHANGED', 'la nota ha cambiado mientras tanto: vuelve a leerla')
      throw error
    }
  }),

  implement(deletePlayerNote, async (ctx, { id }) => {
    const { note, campaign, rows } = await readableNote(ctx, id, { write: true })
    await notesRepo.deleteNote(ctx.db, contextOf(ctx, campaign, 'deletePlayerNote', note.title), note, rows)
    return { ok: true as const }
  }),

  implement(restorePlayerNote, async (ctx, { id }) => {
    const { note, campaign, rows } = await readableNote(ctx, id, { write: true, trashed: true })
    const parent = note.parentId ? rows.find((row) => row.id === note.parentId) : undefined
    const toTop = Boolean(parent) && !notesRepo.visibleNotes(rows).some((row) => row.id === parent?.id)
    await notesRepo.restoreNote(ctx.db, contextOf(ctx, campaign, 'restorePlayerNote', note.title), note, rows, toTop)
    const restored = await notesRepo.findNote(ctx.db, id)
    if (!restored) throw new NotFoundError('note')
    return { note: await present(ctx, campaign, restored) }
  }),

  implement(listPlayerNoteVersions, async (ctx, { id }) => {
    const { note, campaign } = await readableNote(ctx, id)
    const [versions, members] = await Promise.all([
      notesRepo.noteVersions(ctx.db, note.id, VERSIONS),
      membersRepo.listCampaignMembers(ctx.db, campaign.id)
    ])
    const names = new Map(members.map((m) => [m.userId, m.name]))
    return {
      versions: versions.map((v) => ({
        operationId: v.operationId,
        at: iso(v.at),
        by: v.actorId ? { id: v.actorId, name: names.get(v.actorId) ?? '' } : null,
        title: v.title,
        markdown: v.markdown
      }))
    }
  })
]
