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
    case 'updateWorld':
      // Si cambió el nombre, se dice como un renombrar
      return details.from !== undefined
        ? say('renameWorld', { from: text(details.from), to: text(details.to) })
        : say('updateWorld', { name: text(details.name) })
    case 'createCampaign':
      return say('createCampaign', { name: text(details.name), world: text(details.world) })
    case 'renameCampaign':
      return say('renameCampaign', { from: text(details.from), to: text(details.to) })
    case 'updateCampaign':
      return details.from !== undefined
        ? say('renameCampaign', { from: text(details.from), to: text(details.to) })
        : say('updateCampaign', { name: text(details.name) })
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
    case 'updatePage': {
      // Renombrar (hecho: from y to; pedido: el título nuevo y el de ahora) o, si no, cambiar el icono
      const renames = details.to !== undefined || (details.page !== undefined && details.title !== undefined)
      if (!renames && 'locked' in details) {
        return say(details.locked ? 'lockPage' : 'unlockPage', { title: text(details.page ?? details.title) })
      }
      if (!renames && 'sheet' in details) {
        const sheet =
          details.sheet === 'off' ? 'removePageSheet' : details.sheet === 'on' ? 'setPageSheet' : 'changePageSheet'
        return say(sheet, { title: text(details.page ?? details.title) })
      }
      if (!renames && 'cover' in details) {
        return say(details.cover ? 'setPageCover' : 'removePageCover', { title: text(details.page ?? details.title) })
      }
      if (!renames && 'icon' in details) {
        return say(details.icon ? 'setPageIcon' : 'removePageIcon', { title: text(details.page ?? details.title) })
      }
      return say('updatePage', { from: text(details.from ?? details.page), to: text(details.to ?? details.title) })
    }
    case 'setPageProperties':
      return say('setPageProperties', { title: text(details.title ?? details.page) })
    case 'deletePage':
      return say('deletePage', { title: text(details.title ?? details.page) })
    case 'restorePage':
      return say('restorePage', { title: text(details.title ?? details.page) })
    case 'uploadFile':
    case 'replaceFile':
    case 'deleteFile':
    case 'restoreFile':
      return say(action, { name: text(details.name ?? details.file) })
    case 'createFolder':
    case 'deleteFolder':
      return say(action, { name: text(details.name) })
    case 'updateFolder':
      return details.from !== undefined
        ? say('renameFolder', { from: text(details.from), to: text(details.to) })
        : say('moveFolder', { name: text(details.name) })
    case 'moveFile':
      return details.folder
        ? say('moveFile', { name: text(details.name), folder: text(details.folder) })
        : say('moveFileTop', { name: text(details.name) })
    case 'renameFile':
      return say('renameFile', { from: text(details.from ?? details.file), to: text(details.to ?? details.name) })
    case 'movePage': {
      const title = text(details.page ?? details.title)
      return details.parent ? say('movePage', { title, parent: text(details.parent) }) : say('movePageToTop', { title })
    }
    // Lo que escribe Claude: varias páginas de una vez, o el cambio de una
    case 'createPages': {
      const titles = Array.isArray(details.titles) ? details.titles.map(String) : []
      if (titles.length === 1) return say('createPage', { title: titles[0] })
      const shown = titles.slice(0, 3).map((title) => `«${title}»`)
      const more = titles.length - shown.length
      const list = more > 0 ? t('summaries.andMore', { list: shown.join(', '), count: more }) : listOf(shown)
      return say('createPages', { count: titles.length, titles: list })
    }
    case 'editPage':
      return say('editPage', { title: text(details.page ?? details.title) })
    case 'restoreVersion':
      return say('restoreVersion', { title: text(details.page ?? details.title) })
    case 'createWorldHome':
      return say('createWorldHome', { title: text(details.title) })
    // Las pestañas de una página y sus mapas (ADR-0007)
    case 'createPageTab':
    case 'deletePageTab':
      return say(action, { name: text(details.name), title: text(details.title ?? details.page) })
    case 'updatePageTab':
      return details.from !== undefined
        ? say('renamePageTab', { from: text(details.from), to: text(details.to), title: text(details.title) })
        : say('updatePageTab', { name: text(details.name), title: text(details.title) })
    case 'updateMap':
      return say(details.image ? 'setMapImage' : 'updateMap', { name: text(details.name), title: text(details.title) })
    case 'createMapPin':
    case 'updateMapPin':
    case 'deleteMapPin': {
      const pin = text(details.pin ?? details.label) || t('map.untitledPin')
      const key = action === 'updateMapPin' && details.moved ? 'moveMapPin' : action
      return say(key, { pin, map: text(details.map), title: text(details.title) })
    }
    // Las etiquetas de la cuenta (ADR-0006)
    case 'createTag':
    case 'colorTag':
    case 'deleteTag':
    case 'setFileTags':
      return say(action, { name: text(details.name ?? details.tag), tag: text(details.tag ?? details.name) })
    case 'renameTag':
    case 'updateTag':
      return say('renameTag', {
        from: text(details.from ?? details.tag),
        to: text(details.to ?? details.name),
        tag: text(details.tag)
      })
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

/** «a», «b» y «c» */
const listOf = (items: readonly string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(items)

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
