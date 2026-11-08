/**
 * La barra de la derecha de la Mesa del máster, con sus siete pestañas: Tiradas, Combate, Escenas, Personajes,
 * Compendio, Páginas y Ajustes (lienzo «Campaña en la Mesa»). Al empezar un combate se abre la suya
 */
import type { Campaign, CampaignTableView, TokenView } from '@crisol/contracts'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Swords } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { CampaignSettings } from '../campaign/settings.tsx'
import { RollLog } from '../dice/log.tsx'
import { CombatPanel } from './combat-panel.tsx'
import styles from './mesa.module.css'
import { PagesTab } from './pages-tab.tsx'
import { CharactersList, CreaturesList, EncountersList, FactionLegend, ImagesList, type Placing } from './panel.tsx'
import { RollToasts } from './roll-toasts.tsx'
import { InScene, ScenesGrid } from './scenes-tab.tsx'
import {
  PANEL_SLUGS,
  type SidebarItem,
  type SidebarTab,
  TableSidebar,
  tabOfSlug,
  useSidebarFolded,
  useSidebarTab
} from './sidebar.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId')

const MASTER_TABS: readonly SidebarTab[] = [
  'rolls',
  'combat',
  'scenes',
  'characters',
  'compendium',
  'pages',
  'settings'
]

export function MasterSidebar({
  worldId,
  worldName,
  campaign,
  systemId,
  table,
  tokens,
  selected,
  busy,
  onAct,
  onOpen,
  onPlace,
  onImage,
  onPickCombatant,
  onPickToken
}: {
  worldId: string
  worldName: string
  campaign: Campaign
  systemId: string | null
  table: CampaignTableView | null
  /** Las fichas de la escena abierta */
  tokens: TokenView[]
  /** Las elegidas en el mapa (ids) */
  selected: string[]
  busy: boolean
  onAct: (run: () => Promise<CampaignTableView>) => void
  onOpen: (sceneId: string) => void
  onPlace: (placing: Placing) => void
  onImage: (fileId: string) => void
  onPickCombatant: (tokenId: string) => void
  /** Una ficha de «En esta escena»: elegida, con su tarjeta, y la mesa se centra en ella */
  onPickToken: (tokenId: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const search = route.useSearch()
  const [tab, setTab] = useSidebarTab(MASTER_TABS, tabOfSlug(search.panel))
  const [folded, setFolded] = useSidebarFolded()
  const campaignId = campaign.id
  const combat = table?.combat ?? null
  const canPlace = Boolean(table?.open?.image?.tiles)
  const chosen = tokens.filter((token) => selected.includes(token.id))
  const pick = (next: SidebarTab) => {
    setTab(next)
    // En la dirección, para recargar en la misma pestaña (sin llenar el historial)
    void navigate({ to: '.', search: (prev) => ({ ...prev, panel: PANEL_SLUGS[next] }), replace: true })
  }
  // Un combate nuevo: su pestaña, desplegada (el que ya estaba al entrar, no: manda la pestaña de la dirección o la última)
  const combatId = combat?.id ?? null
  const loaded = table !== null
  const shownCombat = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!loaded) return
    const before = shownCombat.current
    shownCombat.current = combatId
    if (before === undefined || combatId === before || !combatId) return
    setTab('combat')
    setFolded(false)
  }, [loaded, combatId, setTab, setFolded])
  const startCombat = () =>
    onAct(() =>
      api
        .call('startCombat', { campaignId, ...(selected.length > 0 ? { tokenIds: selected } : {}) })
        .then(() => api.call('getCampaignTable', { campaignId }))
    )
  const items: SidebarItem[] = [
    { key: 'rolls', content: () => <RollLog campaign={campaign} /> },
    {
      key: 'combat',
      dot: Boolean(combat) && tab !== 'combat',
      content: () =>
        combat ? (
          <CombatPanel
            campaignId={campaignId}
            combat={combat}
            tokens={tokens}
            selected={selected}
            onPick={onPickCombatant}
          />
        ) : (
          <div className={styles.emptyTab}>
            <p>{t('combat.none')}</p>
            {table?.open && tokens.length > 0 && (
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                data-tour="mesa-combate"
                onClick={startCombat}
              >
                <Swords aria-hidden="true" size={15} />
                {selected.length > 0 ? t('combat.startChosen', { count: selected.length }) : t('combat.start')}
              </button>
            )}
          </div>
        )
    },
    {
      key: 'scenes',
      content: () => (
        <>
          <ScenesGrid worldId={worldId} table={table} onOpen={onOpen} />
          <InScene campaignId={campaignId} table={table} tokens={tokens} onPick={onPickToken} />
          <h3 className={styles.tabSection}>{t('tabletop.tabs.encounters')}</h3>
          <EncountersList
            worldId={worldId}
            campaignId={campaignId}
            systemId={systemId}
            table={table}
            selected={chosen}
            canPlace={canPlace}
            onPlace={onPlace}
          />
        </>
      )
    },
    {
      key: 'characters',
      content: () => (
        <>
          <CharactersList campaignId={campaignId} table={table} canPlace={canPlace} onPlace={onPlace} />
          <FactionLegend />
        </>
      )
    },
    {
      key: 'compendium',
      content: () => (
        <>
          <CreaturesList campaignId={campaignId} table={table} canPlace={canPlace} onPlace={onPlace} />
          {chosen.length > 0 && (
            <>
              <h3 className={styles.tabSection}>{t('tabletop.tabs.images')}</h3>
              <ImagesList worldId={worldId} selected={chosen} onImage={onImage} />
            </>
          )}
        </>
      )
    },
    {
      key: 'pages',
      content: () => (
        <PagesTab
          worldId={worldId}
          onOpen={(pageId) => void navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId } })}
        />
      )
    },
    { key: 'settings', content: () => <CampaignSettings campaign={campaign} worldName={worldName} /> }
  ]
  return (
    <>
      <TableSidebar items={items} tab={tab} onTab={pick} folded={folded} onFold={setFolded} />
      <RollToasts campaignId={campaignId} enabled={folded || tab !== 'rolls'} />
    </>
  )
}
