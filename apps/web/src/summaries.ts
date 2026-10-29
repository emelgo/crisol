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
      // Lo deshecho se dice como quedó en el historial
      const original = { action: text(details.action), details: (details.details ?? {}) as Record<string, unknown> }
      return say('undoOperation', { what: summaryOf(t, original) })
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
    default:
      return say('unknown', { action })
  }
}

/**
 * Lo que pide la IA, en una frase. Sus datos salen de su entrada y de los nombres de lo que toca (al deshacer, la
 * operación que deshace)
 */
export function requestSummary(t: TFunction, approval: Pick<Approval, 'action' | 'input' | 'details'>): string {
  const { operation, ...names } = approval.details
  const details = { ...approval.input, ...names, ...(operation && typeof operation === 'object' ? operation : {}) }
  return summaryOf(t, { action: approval.action, details }, 'requested')
}
