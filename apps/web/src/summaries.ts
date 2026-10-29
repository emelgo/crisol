import type { Approval, HistoryEntry } from '@crisol/contracts'
import type { TFunction } from 'i18next'
import type { es } from './i18n.ts'

type ActionKey = keyof typeof es.history.actions

/**
 * La frase de cada acción, con sus datos: en pasado para el historial («creó la campaña…») o por hacer para lo que pide
 * la IA («crear la campaña…»). Una que la web aún no conoce se dice tal cual
 */
export function summaryOf(
  t: TFunction,
  { action, details }: Pick<HistoryEntry, 'action' | 'details'>,
  tense: 'done' | 'requested' = 'done'
): string {
  const say = (key: ActionKey, values: Record<string, unknown> = {}) =>
    tense === 'done' ? t(`history.actions.${key}`, values) : t(`approvals.actions.${key}`, values)
  const text = (value: unknown) => String(value ?? '')
  switch (action) {
    case 'undoOperation': {
      // Deshacer un deshacer es rehacer: se cuenta lo de debajo de todo, como quedó en el historial
      const { depth, root } = undoLayers(details)
      return say(depth % 2 === 1 ? 'undoOperation' : 'redoOperation', { what: summaryOf(t, root) })
    }
    case 'createOrganization':
      return say('createOrganization', { name: text(details.name) })
    case 'bootstrapOwner':
      return say('bootstrapOwner')
    case 'createWorld':
      return say('createWorld', { name: text(details.name) })
    case 'renameWorld':
      return say('renameWorld', { from: text(details.from), to: text(details.to) })
    case 'createCampaign':
      return say('createCampaign', { name: text(details.name), world: text(details.world) })
    case 'renameCampaign':
      return say('renameCampaign', { from: text(details.from), to: text(details.to) })
    case 'regenerateInvitation':
      return say('regenerateInvitation', { campaign: text(details.campaign) })
    case 'setInvitationsOpen':
      return say(details.open ? 'openInvitations' : 'closeInvitations', { campaign: text(details.campaign) })
    case 'joinCampaign':
      return say('joinCampaign', { campaign: text(details.campaign) })
    case 'removeMember':
      return say('removeMember', { member: text(details.member), campaign: text(details.campaign) })
    case 'leaveCampaign':
      return say('leaveCampaign', { campaign: text(details.campaign) })
    case 'deleteWorld':
      return say('deleteWorld', { name: text(details.name) })
    case 'deleteCampaign':
      return say('deleteCampaign', { name: text(details.name), world: text(details.world) })
    case 'restoreWorld':
      return say('restoreWorld', { name: text(details.name) })
    case 'restoreCampaign':
      return say('restoreCampaign', { name: text(details.name), world: text(details.world) })
    // De la wiki: lo hecho guarda los títulos; lo que pide la IA trae su entrada y los nombres (page, parent)
    case 'createPage':
      return details.parent
        ? say('createSubpage', { title: text(details.title), parent: text(details.parent) })
        : say('createPage', { title: text(details.title) })
    case 'updatePage':
      return say('updatePage', { from: text(details.from ?? details.page), to: text(details.to ?? details.title) })
    case 'movePage': {
      const title = text(details.page ?? details.title)
      return details.parent ? say('movePage', { title, parent: text(details.parent) }) : say('movePageToTop', { title })
    }
    default:
      return say('unknown', { action })
  }
}

type Operation = Pick<HistoryEntry, 'action' | 'details'>

/**
 * Lo que hay dentro de un deshacer (sus datos guardan la operación que deshace, que a su vez puede ser otro deshacer):
 * cuántas capas y la operación de debajo de todo. Impar, deshace esa operación; par, la rehace
 */
export function undoLayers(details: Record<string, unknown>): { depth: number; root: Operation } {
  let depth = 1
  let inner: Operation = { action: String(details.action ?? ''), details: asRecord(details.details) }
  while (inner.action === 'undoOperation') {
    depth++
    inner = { action: String(inner.details.action ?? ''), details: asRecord(inner.details.details) }
  }
  return { depth, root: inner }
}

const asRecord = (value: unknown) => (value && typeof value === 'object' ? value : {}) as Record<string, unknown>

/**
 * Lo que pide la IA, en una frase. Sus datos salen de su entrada y de los nombres de lo que toca (al deshacer, la
 * operación que deshace)
 */
export function requestSummary(t: TFunction, approval: Pick<Approval, 'action' | 'input' | 'details'>): string {
  const { operation, ...names } = approval.details
  const details = { ...approval.input, ...names, ...(operation && typeof operation === 'object' ? operation : {}) }
  return summaryOf(t, { action: approval.action, details }, 'requested')
}
