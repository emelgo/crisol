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
  const noteTitle = (value: unknown) => text(value).trim() || t('notes.untitled')
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
      if (details.from !== undefined) return say('renameCampaign', { from: text(details.from), to: text(details.to) })
      // Su sistema: elegirlo, quitarlo o cambiar lo que elige de él
      if (details.system !== undefined)
        return details.system === null
          ? say('campaignNoSystem', { name: text(details.name) })
          : say('campaignSystem', { name: text(details.name), system: text(details.system) })
      if (details.systemChoices) return say('campaignSystemChoices', { name: text(details.name) })
      return say('updateCampaign', { name: text(details.name) })
    // Los personajes: por su nombre
    case 'createCharacter':
      return say('createCharacter', { name: text(details.name), campaign: text(details.campaign) })
    // Las notas de los jugadores: por su título
    case 'createPlayerNote':
      return say('createPlayerNote', { title: noteTitle(details.title), campaign: text(details.campaign) })
    case 'updatePlayerNote':
      return details.from !== undefined
        ? say('renamePlayerNote', { from: noteTitle(details.from), title: noteTitle(details.title) })
        : say('updatePlayerNote', { title: noteTitle(details.title) })
    case 'deletePlayerNote':
      return say('deletePlayerNote', { title: noteTitle(details.title) })
    case 'restorePlayerNote':
      return say('restorePlayerNote', { title: noteTitle(details.title) })
    case 'updateCharacter':
      if (details.confirm === 'created') return say('characterCreated', { name: text(details.name) })
      if (details.confirm === 'level') return say('characterLevel', { name: text(details.name) })
      if (details.from !== undefined)
        return say('renameCharacter', { from: text(details.from), name: text(details.name) })
      if (details.owner) return say('characterOwner', { name: text(details.name) })
      return say('updateCharacter', { name: text(details.name) })
    case 'deleteCharacter':
    case 'restoreCharacterVersion':
      return say(action, { name: text(details.name) })
    // El inventario del grupo: qué, cuánto, de dónde y a dónde
    case 'updateParty': {
      const values = {
        name: text(details.name),
        quantity: Number(details.quantity ?? 1),
        // El contenedor de serie no tiene nombre propio
        from: text(details.from) || t('party.common')
      }
      switch (details.change) {
        case 'add':
          return say('partyAdd', values)
        case 'remove':
          return say('partyRemove', values)
        case 'addContainer':
          return say('partyAddContainer', values)
        case 'renameContainer':
          return say('partyRenameContainer', values)
        case 'removeContainer':
          return say('partyRemoveContainer', values)
        case 'coins':
          return say('partyCoins')
        default:
          return say('partyEdit', values)
      }
    }
    case 'moveItem': {
      const values = {
        name: text(details.name),
        quantity: Number(details.quantity ?? 1),
        from: text(details.from),
        to: text(details.to),
        container: text(details.container) || t('party.common')
      }
      if (details.from && details.to) return say('partyBetweenCharacters', values)
      if (details.to) return say('partyToCharacter', values)
      if (details.from) return say('partyFromCharacter', values)
      return say('partyToContainer', values)
    }
    case 'moveCoins': {
      const coins = Object.entries((details.coins ?? {}) as Record<string, number>)
        .filter(([, n]) => n > 0)
        .map(([coin, n]) => `${n} ${coin}`)
        .join(', ')
      return say(details.toParty ? 'partyCoinsToParty' : 'partyCoinsToCharacter', {
        coins,
        character: text(details.character)
      })
    }
    case 'splitCoins':
      return say('partySplit', { count: Number(details.count ?? 0) })
    case 'createSystem':
    case 'importSystem':
      return say(action, { name: systemName(details) })
    // Lo que se cambia o se borra se dice por el nombre que tiene ahora (aunque el cambio sea renombrarlo)
    case 'updateSystem':
    case 'deleteSystem':
      return say(action, { name: typeof details.system === 'string' ? details.system : systemName(details) })
    // Los libros de un sistema (ADR-0021): cuál y de qué sistema
    case 'createBook':
    case 'updateBook':
    case 'deleteBook':
    case 'proposeContent':
      return say(action, {
        book: text(details.book ?? details.name),
        system: text(details.system),
        count: typeof details.count === 'number' ? details.count : 0
      })
    case 'settlePending':
      return say(action, {
        system: text(details.system),
        accepted: Number(details.accepted ?? 0),
        discarded: Number(details.discarded ?? 0)
      })
    // El contenido de un sistema: cuántos documentos y de cuál
    case 'putSystemContent':
    case 'deleteSystemContent': {
      const keys = Array.isArray(details.keys)
        ? details.keys.length
        : Array.isArray(details.items)
          ? details.items.length
          : 0
      const count = typeof details.count === 'number' ? details.count : keys
      return say(action, { name: typeof details.system === 'string' ? details.system : systemName(details), count })
    }
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
    // Lo que sabe una campaña (ADR-0017): qué, a quién, en qué campaña (o todo el mundo)
    case 'reveal':
    case 'hideKnowledge':
    case 'hide':
    case 'setKnowledge': {
      const kind = text(details.kind)
      const what = t(
        `knowledgeTargets.${['page', 'secret', 'tab', 'pin', 'element', 'content'].includes(kind) ? kind : 'page'}` as 'knowledgeTargets.page',
        {
          name: text(details.name)
        }
      )
      const who =
        Array.isArray(details.characters) && details.characters.length > 0
          ? (details.characters as unknown[]).map(text).join(', ')
          : details.campaign
            ? text(details.campaign)
            : null
      if (action === 'reveal') return say('knowledgeRevealed', { what, who: who ?? '' })
      if (action === 'hideKnowledge' || action === 'hide')
        return say('knowledgeHidden', { what, who: text(details.campaign) })
      if (details.known === true) return who ? say('knowledgeKnown', { what, who }) : say('knowledgeWorld', { what })
      if (details.known === false)
        return details.campaign
          ? say('knowledgeHidden', { what, who: text(details.campaign) })
          : say('knowledgeNobody', { what })
      return details.campaign
        ? say('knowledgeCleared', { what, where: text(details.campaign) })
        : say('knowledgeClearedWorld', { what })
    }
    // Quién de una campaña escribe en una página (docs/specs/pagina-de-jugadores.md)
    case 'setPageEditors': {
      const title = text(details.title ?? details.page)
      if (details.editors === null || details.editors === 'none')
        return say('pageEditorsNone', { title, campaign: text(details.campaign) })
      const who =
        Array.isArray(details.characters) && details.characters.length > 0
          ? (details.characters as unknown[]).map(text).join(', ')
          : text(details.campaign)
      return say('pageEditors', { title, who })
    }
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
    case 'sortPageChildren':
      return details.title ? say('sortPageChildren', { title: text(details.title) }) : say('sortRootPages')
    case 'setPageProperties':
    case 'setPagePanel':
      return say(action, { title: text(details.title ?? details.page) })
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
      if (details.kind === 'table')
        return say('createTableTab', { name: text(details.name), title: text(details.title) })
      if (details.kind === 'scene')
        return say('createSceneTab', { name: text(details.name), title: text(details.title) })
      return say(action, { name: text(details.name), title: text(details.title ?? details.page) })
    case 'updateRandomTable':
      return say('updateRandomTable', { name: text(details.name), title: text(details.title) })
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
    // Las escenas de la mesa y la mesa de cada campaña (docs/specs/escenas.md)
    case 'updateScene':
      return say(details.view && !details.grid ? 'sceneView' : 'sceneGrid', sceneOf(details))
    case 'setSceneImage':
    case 'drawScene':
      return say(action, sceneOf(details))
    // Las escenas sueltas de la Mesa (ADR-0020)
    case 'createScene':
    case 'deleteScene':
      return say(action, { name: text(details.name) })
    case 'renameScene':
      return say(action, { name: text(details.name), to: text(details.to) })
    case 'openScene':
    case 'presentScene':
      return details.name
        ? say(action, { name: text(details.name), campaign: text(details.campaign) })
        : say(action === 'openScene' ? 'openSomeScene' : 'presentSomeScene', { campaign: text(details.campaign) })
    case 'hideScreen':
      return say(details.hidden === false ? 'showScreen' : 'hideScreen', { campaign: text(details.campaign) })
    case 'setScreenCamera':
      return say(action, { campaign: text(details.campaign) })
    // Las fichas de la mesa y los encuentros del mundo (docs/specs/fichas.md)
    case 'placeTokens':
    case 'moveTokens':
    case 'removeTokens':
      return say(action, { count: Number(details.count ?? 1), campaign: text(details.campaign) })
    case 'updateToken':
      return say(action, { label: text(details.label), campaign: text(details.campaign) })
    case 'saveEncounter':
    case 'deleteEncounter':
    case 'placeEncounter':
      return say(action, { name: text(details.name), campaign: text(details.campaign) })
    // Lo traído de un zip (docs/specs/escenas-foundry.md)
    case 'importFoundryScene':
      return say(action, { name: text(details.name), title: text(details.title) })
    case 'placeScenePins':
      return say(action, { campaign: text(details.campaign) })
    // La visión de la mesa (docs/specs/vision.md): lo del mundo, con su escena; lo de la campaña, con ella
    case 'changeWalls':
      return say(Number(details.walls ?? 1) === 0 && details.lights ? 'changeLights' : 'changeWalls', {
        name: text(details.name),
        title: text(details.title)
      })
    case 'placeImportedWalls':
      return say(action, { name: text(details.name), title: text(details.title) })
    case 'updateSceneVision': {
      const key =
        details.automaticVision === undefined
          ? 'sceneDarkness'
          : details.automaticVision
            ? 'sceneAutoVisionOn'
            : 'sceneAutoVisionOff'
      return say(key, { name: text(details.name), title: text(details.title) })
    }
    case 'openDoor':
    case 'closeDoor':
    case 'setDoor':
      return say(action === 'setDoor' ? (details.open ? 'openDoor' : 'closeDoor') : action, {
        name: text(details.name),
        campaign: text(details.campaign)
      })
    case 'revealFog':
    case 'coverFog':
    case 'changeFog':
      return say(action === 'changeFog' ? (details.mode === 'cover' ? 'coverFog' : 'revealFog') : action, {
        campaign: text(details.campaign)
      })
    case 'resetFog':
      return say(action, { name: text(details.name), campaign: text(details.campaign) })
    case 'setTileFit':
      return say(action, { campaign: text(details.campaign) })
    // Las herramientas de la mesa (docs/specs/herramientas-mesa.md)
    case 'changeMarks':
    case 'placeTemplate':
      return say(action, { name: text(details.name), campaign: text(details.campaign) })
    case 'createWidget':
    case 'updateWidget':
    case 'deleteWidget':
      return say(action, { label: text(details.label), campaign: text(details.campaign) })
    case 'saveSnapshot':
    case 'restoreSnapshot':
    case 'deleteSnapshot':
      return say(action, { name: text(details.name), scene: text(details.scene), campaign: text(details.campaign) })
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
    // El combate y lo que está en juego (docs/specs/combate.md)
    case 'startCombat':
    case 'endCombat':
    case 'updateCombat':
    case 'addCombatants':
    case 'rollInitiative':
    case 'setInitiative':
    case 'orderCombatants':
    case 'groupCombatants':
    case 'nextTurn':
    case 'previousTurn':
      return say(action, {
        campaign: text(details.campaign),
        count: Number(details.count ?? 1),
        round: text(details.round)
      })
    case 'removeCombatants':
      return say(action, {
        campaign: text(details.campaign),
        names: listOf(Array.isArray(details.names) ? details.names.map(String) : [])
      })
    case 'putInPlay':
    case 'playCreature':
    case 'setCreatureHidden':
    case 'assignToken':
    case 'spendRecharge':
    case 'removeFromPlay':
      return say(action, {
        name: text(details.name),
        action: text(details.action),
        count: Number(details.count ?? 1),
        campaign: text(details.campaign)
      })
    case 'createTemplate':
    case 'updateTemplate':
    case 'deleteTemplate':
    case 'copyContent':
    case 'pullContentOrigin':
      return say(action, { name: textIn(details.name) })
    case 'deleteFiles':
    case 'deleteWorldContent':
      return say(action, { count: Number(details.count ?? 1) })
    default:
      return say('unknown')
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

/** Un texto de un sistema, en un idioma o en varios */
const textIn = (value: unknown) =>
  typeof value === 'string' ? value : String(asRecord(value).es ?? asRecord(value).en ?? '')

/**
 * El nombre del sistema de una entrada del historial o de lo que pide la IA: el suyo, el del sistema que toca, o el
 * de su documento (al crearlo con él o al subir su archivo)
 */
function systemName(details: Record<string, unknown>) {
  if (details.name !== undefined && details.name !== null) return textIn(details.name)
  if (typeof details.system === 'string') return details.system
  const document = asRecord(details.document).name ?? asRecord(asRecord(details.file).system).name
  return textIn(document)
}

/** La escena y su página («de «Cripta»»), sin repetir el nombre cuando la página se llama igual */
function sceneOf(details: Record<string, unknown>) {
  const name = String(details.name ?? '')
  const title = String(details.title ?? '')
  return { name, title, of: title && title !== name ? ` de «${title}»` : '' }
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
