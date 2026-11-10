/**
 * La barra de la derecha de la Mesa del máster, con sus siete pestañas: Tiradas, Combate, Escenas, Personajes,
 * Compendio, Páginas y Ajustes (lienzo «Campaña en la Mesa»). Al empezar un combate se abre la suya
 */
import type { Campaign, CampaignTableView, SceneView, TokenView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Eye, Swords } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { GroupKnowledge } from '../campaign/group-knowledge.tsx'
import { SoundTab } from '../sound/sound-tab.tsx'
import { ActorsTab } from './actor-folders.tsx'
import { CombatPanel } from './combat-panel.tsx'
import { CompendiumTab } from './compendium-tab.tsx'
import { compendiumWindow } from './compendium-window.tsx'
import styles from './mesa.module.css'
import { pageWindow } from './page-window.tsx'
import pagesStyles from './pages-tab.module.css'
import { PagesTab } from './pages-tab.tsx'
import { CharactersList, EncountersList, FactionLegend, ImagesList, type Placing, SearchBox } from './panel.tsx'
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
import { sheetWindow } from './token-sheet.tsx'
import type { SceneChoice } from './use-preparation.ts'
import { useWindows } from './windows.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/mesa')

const MASTER_TABS: readonly SidebarTab[] = ['scenes', 'combat', 'characters', 'compendium', 'pages', 'sound']

export type MasterSidebarState = ReturnType<typeof useMasterSidebar>

/**
 * La pestaña de la barra del máster y si está plegada. Vive en la Mesa, no en la barra: una herramienta que la tapa no
 * la olvida, y un combate nuevo abre la suya aunque esté tapada (el que ya estaba al entrar, no: manda la dirección o la
 * última)
 */
export function useMasterSidebar(table: CampaignTableView | null) {
  const navigate = useNavigate()
  const search = route.useSearch()
  const [tab, setTab] = useSidebarTab(MASTER_TABS, tabOfSlug(search.panel))
  const [folded, setFolded] = useSidebarFolded()
  const pick = useCallback(
    (next: SidebarTab) => {
      setTab(next)
      // En la dirección, para recargar en la misma pestaña (sin llenar el historial)
      void navigate({ to: '.', search: (prev) => ({ ...prev, panel: PANEL_SLUGS[next] }), replace: true })
    },
    [setTab, navigate]
  )
  const combatId = table?.combat?.id ?? null
  const loaded = table !== null
  const shownCombat = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!loaded) return
    const before = shownCombat.current
    shownCombat.current = combatId
    if (before === undefined || combatId === before || !combatId) return
    pick('combat')
    setFolded(false)
  }, [loaded, combatId, pick, setFolded])
  return { tab, pick, folded, setFolded }
}

export function MasterSidebar({
  worldId,
  campaign,
  systemId,
  table,
  tokens,
  selected,
  busy,
  onAct,
  onOpen,
  onCreateScene,
  onPlace,
  onImage,
  onPickCombatant,
  onPickToken,
  sidebar
}: {
  worldId: string
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
  /** Una escena recién creada desde Escenas: abrirla y preparar su mapa */
  onCreateScene?: (scene: SceneView, choice: SceneChoice | null) => void
  onPlace: (placing: Placing) => void
  onImage: (fileId: string) => void
  onPickCombatant: (tokenId: string) => void
  /** Una ficha de «En esta escena»: elegida, con su tarjeta, y la mesa se centra en ella */
  onPickToken: (tokenId: string) => void
  /** La pestaña abierta y si está plegada: los guarda la Mesa (sigue al combate aunque la tape una herramienta) */
  sidebar: MasterSidebarState
}) {
  const { t } = useTranslation()
  const api = useApi()
  const windows = useWindows()
  const { tab, pick, folded, setFolded } = sidebar
  const campaignId = campaign.id
  // ?pagina=: una página que se abre en su ventana al entrar (y se quita de la dirección)
  const navigate = useNavigate()
  const { pagina: asked, entrada } = route.useSearch()
  useEffect(() => {
    if (!asked || !windows) return
    windows.open(pageWindow(worldId, asked, '…'))
    void navigate({ to: '.', search: ({ pagina: _, ...rest }) => rest, replace: true })
  }, [asked, windows, worldId, navigate])
  // ?entrada=: una entrada del compendio (los enlaces de antes a /compendio?ver=), en su ventana
  useEffect(() => {
    if (!entrada || !windows) return
    windows.open(compendiumWindow(worldId, campaignId, t('tabletop.sidebar.compendium'), entrada))
    void navigate({ to: '.', search: ({ entrada: _, ...rest }) => rest, replace: true })
  }, [entrada, windows, worldId, campaignId, navigate, t])
  // Las páginas que conoce el grupo (su ojo en Páginas): las marcadas para la campaña y, si parte de él, las del mundo
  const knowledge = useQuery({
    queryKey: ['pages', worldId, 'group', campaignId],
    queryFn: () => api.call('listCampaignKnowledge', { campaignId }),
    enabled: tab === 'pages'
  })
  const knownPages = new Set(
    [...(knowledge.data?.campaign ?? []), ...(knowledge.data?.knowsWorld ? (knowledge.data?.world ?? []) : [])]
      .filter((item) => item.kind === 'page' && item.known)
      .map((item) => item.targetId)
  )
  const combat = table?.combat ?? null
  const canPlace = Boolean(table?.open?.image?.tiles)
  const chosen = tokens.filter((token) => selected.includes(token.id))
  const startCombat = () =>
    onAct(() =>
      api
        .call('startCombat', { campaignId, ...(selected.length > 0 ? { tokenIds: selected } : {}) })
        .then(() => api.call('getCampaignTable', { campaignId }))
    )
  const items: SidebarItem[] = [
    {
      key: 'scenes',
      content: () => (
        <>
          <ScenesGrid worldId={worldId} table={table} onOpen={onOpen} onCreate={onCreateScene} />
          <InScene campaignId={campaignId} table={table} tokens={tokens} onPick={onPickToken} />
        </>
      )
    },
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
      key: 'characters',
      content: () => (
        <>
          <ActorsTab
            campaignId={campaignId}
            systemId={systemId}
            table={table}
            canPlace={canPlace}
            onPlace={onPlace}
            onOpenCharacter={(character) =>
              windows?.open(sheetWindow({ kind: 'character', ...character }, campaignId, systemId))
            }
          />
          {/* Los encuentros son grupos de criaturas con su formación: van con ellas, no con las escenas (Enrique) */}
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
          {chosen.length > 0 && (
            <>
              <h3 className={styles.tabSection}>{t('tabletop.tabs.images')}</h3>
              <ImagesList worldId={worldId} selected={chosen} onImage={onImage} />
            </>
          )}
          <FactionLegend />
        </>
      )
    },
    {
      key: 'compendium',
      content: () => <CompendiumTab worldId={worldId} campaignId={campaignId} />
    },
    {
      key: 'pages',
      content: () => (
        <PagesTab
          worldId={worldId}
          onOpen={(pageId, title) => windows?.open(pageWindow(worldId, pageId, title))}
          known={knownPages}
          extra={
            <button
              type="button"
              className={pagesStyles.group}
              onClick={() =>
                windows?.open({
                  id: 'group-knowledge',
                  title: t('tabletop.pages.group'),
                  width: 720,
                  height: 620,
                  render: () => (
                    <div className={styles.windowPad}>
                      <GroupKnowledge worldId={worldId} campaignId={campaignId} />
                    </div>
                  )
                })
              }
            >
              <Eye aria-hidden="true" size={15} />
              {t('tabletop.pages.group')}
            </button>
          }
        />
      )
    },
    {
      key: 'sound',
      content: () => <SoundTab worldId={worldId} campaignId={campaignId} />
    }
  ]
  return <TableSidebar items={items} tab={tab} onTab={pick} folded={folded} onFold={setFolded} />
}
