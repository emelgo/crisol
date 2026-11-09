/**
 * La Mesa de quien juega (lienzo «Campaña en la Mesa»): lo que ve el grupo (como la tele) y, a la derecha, su barra con
 * Tiradas, Combate, Personajes, Compendio y Páginas (las que conoce). Las páginas y su hoja se abren en ventanas; la
 * página que el máster enseña se le abre sola. No tiene Escenas ni Ajustes (son del máster)
 */
import type { Campaign, ScreenView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { CurrentCampaignContext } from '../campaign/current-campaign.ts'
import { PlayerPage } from '../campaign/world-pages.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { RollLog } from '../dice/log.tsx'
import { useShown } from '../realtime/context.tsx'
import { ReadAsProvider } from '../wiki/read-as.tsx'
import { compendiumWindow } from './compendium-window.tsx'
import styles from './mesa.module.css'
import { PagesTab } from './pages-tab.tsx'
import playerStyles from './player-mesa.module.css'
import { RollToasts } from './roll-toasts.tsx'
import { TableScreen } from './screen.tsx'
import { type SidebarItem, type SidebarTab, TableSidebar, useSidebarFolded, useSidebarTab } from './sidebar.tsx'
import { sheetWindow } from './token-sheet.tsx'
import { type LinkHandler, useWindows, WindowLayer, type WindowSpec, WindowsProvider } from './windows.tsx'

const PLAYER_TABS: readonly SidebarTab[] = ['rolls', 'combat', 'characters', 'compendium', 'pages']

/** Una página del mundo, leída desde la campaña, en su ventana */
function playerPageWindow(worldId: string, pageId: string, title: string): WindowSpec {
  return {
    id: `page:${pageId}`,
    title,
    width: 820,
    height: 640,
    render: () => (
      <div className={playerStyles.page}>
        <PlayerPage worldId={worldId} pageId={pageId} />
      </div>
    )
  }
}

const PLAYER_PAGE = /^\/mundos\/([0-9a-f-]{36})\/campanas\/[0-9a-f-]{36}\/paginas\/([0-9a-f-]{36})\/?$/

/** Un enlace a una página dentro de una ventana: a otra ventana */
const openPlayerPageLinks: LinkHandler = (url, text, open) => {
  const match = PLAYER_PAGE.exec(url.pathname)
  if (!match?.[1] || !match[2]) return false
  open(playerPageWindow(match[1], match[2], text || '…'))
  return true
}

export function PlayerMesa({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  const stageBox = useRef<HTMLDivElement>(null)
  const [screen, setScreen] = useState<ScreenView | null>(null)
  return (
    <CurrentCampaignContext.Provider value={campaign.id}>
      <ReadAsProvider value={{ campaignId: campaign.id }}>
        <WindowsProvider area={stageBox} onLink={openPlayerPageLinks}>
          <div className={styles.mesa} data-mesa="">
            <div ref={stageBox} className={styles.stageBox}>
              <TableScreen campaignId={campaign.id} viewer="player" onScreen={setScreen} />
              <WindowLayer />
            </div>
            <PlayerSidebar worldId={worldId} campaign={campaign} screen={screen} />
            <PageTitle className={styles.hidden}>{campaign.name}</PageTitle>
          </div>
        </WindowsProvider>
      </ReadAsProvider>
    </CurrentCampaignContext.Provider>
  )
}

function PlayerSidebar({
  worldId,
  campaign,
  screen
}: {
  worldId: string
  campaign: Campaign
  screen: ScreenView | null
}) {
  const { t } = useTranslation()
  const api = useApi()
  const windows = useWindows()
  const [tab, setTab] = useSidebarTab(PLAYER_TABS, null)
  const [folded, setFolded] = useSidebarFolded()
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id })
  })
  // La página que enseña el máster: se abre sola
  useShown((shown) => {
    if (shown.campaignId === campaign.id) windows?.open(playerPageWindow(worldId, shown.pageId, shown.title))
  })
  const combat = screen?.combat ?? null
  const systemId = campaign.system?.id ?? null
  const items: SidebarItem[] = [
    { key: 'rolls', content: () => <RollLog campaign={campaign} /> },
    {
      key: 'combat',
      dot: Boolean(combat) && tab !== 'combat',
      content: () =>
        combat ? (
          <ol className={playerStyles.order} aria-label={t('combat.title')}>
            <li className={playerStyles.round}>
              {combat.round === 0 ? t('combat.notStarted') : t('combat.round', { round: combat.round })}
            </li>
            {combat.combatants.map((c) => (
              <li
                key={c.id}
                className={playerStyles.combatant}
                data-active={c.active || undefined}
                data-defeated={c.defeated || undefined}
                aria-current={c.active ? 'step' : undefined}
              >
                <span>{c.name}</span>
                {c.initiative !== null && <b>{c.initiative}</b>}
              </li>
            ))}
          </ol>
        ) : (
          <p className={playerStyles.muted}>{t('playerMesa.noCombat')}</p>
        )
    },
    {
      key: 'characters',
      content: () => {
        if (!characters.data)
          return failed(characters) ? <LoadError error={characters.error} onRetry={() => characters.refetch()} /> : null
        const own = characters.data.characters
        const allies = characters.data.allies ?? []
        return (
          <ul className={playerStyles.people}>
            {own.map((character) => (
              <li key={character.id}>
                <button
                  type="button"
                  className={playerStyles.person}
                  onClick={() =>
                    windows?.open(
                      sheetWindow({ kind: 'character', id: character.id, name: character.name }, campaign.id, systemId)
                    )
                  }
                >
                  <b>{character.name}</b>
                  <small>{character.summary.line}</small>
                </button>
              </li>
            ))}
            {allies.map((ally) => (
              <li key={ally.id} className={playerStyles.person}>
                <b>{ally.name}</b>
                <small>{[ally.line, ally.owner?.name].filter(Boolean).join(' · ')}</small>
              </li>
            ))}
          </ul>
        )
      }
    },
    {
      key: 'compendium',
      content: () => (
        <button
          type="button"
          className={playerStyles.open}
          onClick={() => windows?.open(compendiumWindow(worldId, campaign.id, t('tabletop.sidebar.compendium')))}
        >
          {t('tabletop.compendium.openAll')}
        </button>
      )
    },
    {
      key: 'pages',
      content: () => (
        <PagesTab
          worldId={worldId}
          campaignId={campaign.id}
          onOpen={(pageId, title) => windows?.open(playerPageWindow(worldId, pageId, title))}
        />
      )
    }
  ]
  return (
    <>
      <TableSidebar items={items} tab={tab} onTab={setTab} folded={folded} onFold={setFolded} />
      <RollToasts campaignId={campaign.id} enabled={folded || tab !== 'rolls'} />
    </>
  )
}
