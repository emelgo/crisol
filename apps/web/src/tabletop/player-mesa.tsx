/**
 * La Mesa de quien juega (lienzo «Campaña en la Mesa»): lo que ve el grupo (como la tele) y, a la derecha, su barra con
 * Tiradas, Combate, Personajes, Compendio y Páginas (las que conoce). Las páginas y su hoja se abren en ventanas; la
 * página que el máster enseña se le abre sola. No tiene Escenas ni Ajustes (son del máster)
 */
import type { Campaign, ScreenView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { CurrentCampaignContext } from '../campaign/current-campaign.ts'
import { PlayerPage } from '../campaign/world-pages.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { useDice } from '../dice/context.tsx'
import { useShown } from '../realtime/context.tsx'
import { ReadAsProvider } from '../wiki/read-as.tsx'
import { CompendiumTab } from './compendium-tab.tsx'
import styles from './mesa.module.css'
import { PagesTab } from './pages-tab.tsx'
import playerStyles from './player-mesa.module.css'
import { RollToasts } from './roll-toasts.tsx'
import { TableScreen } from './screen.tsx'
import { type SidebarItem, type SidebarTab, TableSidebar, useSidebarFolded, useSidebarTab } from './sidebar.tsx'
import { sheetWindow } from './token-sheet.tsx'
import { type LinkHandler, useWindows, WindowLayer, type WindowSpec, WindowsProvider } from './windows.tsx'

const PLAYER_TABS: readonly SidebarTab[] = ['combat', 'characters', 'compendium', 'pages']

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
  const { t } = useTranslation()
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
            <Tour
              id="mesa-jugador"
              steps={[{ target: '[data-tour="mesa-barra"]', text: t('tour.tabletop.player'), placement: 'left' }]}
            />
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
  const dice = useDice()
  // Los dados tiran en esta campaña (antes lo decía la barra de la izquierda, que aquí no está)
  const { setCampaign } = dice
  useEffect(() => setCampaign(worldId, campaign.id), [setCampaign, worldId, campaign.id])
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id })
  })
  // La página que enseña el máster: se abre sola
  useShown((shown) => {
    if (shown.campaignId === campaign.id) windows?.open(playerPageWindow(worldId, shown.pageId, shown.title))
  })
  // Lo nuevo para ella (lo revelado que aún no ha abierto): un punto en sus páginas y en la pestaña
  const news = useQuery({
    queryKey: ['pages', worldId, 'player', campaign.id, null, 'news'],
    queryFn: () => api.call('listNews', { campaignId: campaign.id })
  })
  const newPages = new Set((news.data?.news ?? []).flatMap((n) => (n.pageId ? [n.pageId] : [])))
  const combat = screen?.combat ?? null
  const systemId = campaign.system?.id ?? null
  const items: SidebarItem[] = [
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
      content: () => <CompendiumTab worldId={worldId} campaignId={campaign.id} books={false} />
    },
    {
      key: 'pages',
      dot: newPages.size > 0 && tab !== 'pages',
      content: () => (
        <PagesTab
          worldId={worldId}
          campaignId={campaign.id}
          onOpen={(pageId, title) => windows?.open(playerPageWindow(worldId, pageId, title))}
          news={newPages}
        />
      )
    }
  ]
  return (
    <>
      <TableSidebar
        items={items}
        tab={tab}
        onTab={setTab}
        folded={folded}
        onFold={setFolded}
        // Sin la barra de la izquierda: su ficha, desde aquí
        actions={
          <Link
            to="/mundos/$worldId/campanas/$campaignId"
            params={{ worldId, campaignId: campaign.id }}
            className={playerStyles.toSheet}
          >
            <UserRound aria-hidden="true" size={15} />
            {t('playerMesa.toSheet')}
          </Link>
        }
      />
      {/* Las tiradas sobre el d20, mientras su ficha está cerrada (con ella abierta, ya se ven en su registro) */}
      <RollToasts campaignId={campaign.id} enabled={!dice.open} master={false} />
    </>
  )
}
