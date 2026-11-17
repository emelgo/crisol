/**
 * El Inicio de una campaña (ADR-0021, lienzo «Libros y campaña»): para el máster, volver a la Mesa donde se quedaron,
 * quién juega, qué libros usa y la aventura en curso; para quien juega, su personaje, la Mesa, el grupo, los libros y
 * lo que sabe. La portada de la campaña, por detrás
 */
import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Layers, NotebookPen, UserPlus } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { ActivityCenter } from '../campaign-time/activity.tsx'
import { MasterToday, PlayerToday } from '../campaign-time/today.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { useWindow } from '../components/window.tsx'
import { worldTransition } from '../components/world-transition.ts'
import { useDice } from '../dice/context.tsx'
import { coverStyle } from '../wiki/cover-look.ts'
import { useNarrow } from '../wiki/panel.tsx'
import { BookCover, useCampaignBooks } from './book-cover.tsx'
import styles from './home.module.css'
import { MembersPanel } from './settings.tsx'

type Props = { worldId: string; worldName: string; campaign: Campaign }

/** La cabecera: su portada fundida con el fondo, su nombre y de qué mundo y sistema es */
function Hero({ campaign, worldName, actions }: { campaign: Campaign; worldName: string; actions?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className={styles.head} style={worldTransition(campaign.id)}>
      {campaign.cover && (
        <div className={styles.hero} aria-hidden="true">
          <img src={`/api/files/${campaign.cover.fileId}`} alt="" style={coverStyle(campaign.cover)} />
        </div>
      )}
      <header className={styles.titlebar}>
        <div className={styles.grow}>
          <PageTitle className={styles.title}>{campaign.name}</PageTitle>
          <p className={styles.sub}>
            {t('campaignHome.sub', { world: worldName, system: campaign.system?.name ?? t('campaignHome.noSystem') })}
          </p>
        </div>
        {actions}
      </header>
    </div>
  )
}

/** «Ir a la Mesa», con la escena abierta (su imagen) y si hay combate */
function ToMesa({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const table = useQuery({
    queryKey: ['campaignTable', campaignId],
    queryFn: () => api.call('getCampaignTable', { campaignId })
  })
  const open = table.data?.open ?? null
  const combat = table.data?.combat ?? null
  const fileId = open?.image?.fileId
  return (
    <section className={styles.go} data-tour="inicio-mesa">
      <div className={styles.goImage} aria-hidden="true">
        {fileId && <img src={`/api/files/${fileId}`} alt="" />}
      </div>
      <div className={styles.goText}>
        {open ? (
          <>
            <span className={styles.label}>{t('campaignHome.leftAt')}</span>
            <span className={styles.scene}>{open.name}</span>
            {combat && (
              <span className={styles.meta}>
                {combat.round > 0 ? t('campaignHome.combat', { round: combat.round }) : t('campaignHome.combatStart')}
              </span>
            )}
          </>
        ) : (
          <span className={styles.meta}>{t('campaignHome.noScene')}</span>
        )}
        <div className={styles.goRow}>
          {/* La Mesa, en otra pestaña (Enrique, 2026-11-10) */}
          <a
            href={`/mundos/${worldId}/campanas/${campaignId}/mesa`}
            target="_blank"
            rel="noopener"
            className={styles.toMesa}
          >
            <Layers aria-hidden="true" size={18} />
            {t('campaignHome.toMesa')}
          </a>
        </div>
      </div>
    </section>
  )
}

/** Un título pequeño de sección, con su enlace a la derecha */
function Section({
  title,
  link,
  children,
  tour
}: {
  title: string
  link?: ReactNode
  children: ReactNode
  tour?: string
}) {
  return (
    <section className={styles.section} data-tour={tour}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h}>{title}</h2>
        {link}
      </div>
      {children}
    </section>
  )
}

/** Quién juega y con qué personaje (el máster ve todos) */
function Players({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.call('listMembers', { campaignId })
  })
  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () => api.call('listCharacters', { campaignId })
  })
  const players = (members.data?.members ?? []).filter((m) => m.role === 'player')
  const all = characters.data?.characters ?? []
  return (
    <Section
      title={t('campaignHome.playersTitle')}
      tour="inicio-jugadores"
      link={
        <Link
          to="/mundos/$worldId/campanas/$campaignId/personajes"
          params={{ worldId, campaignId }}
          className={styles.more}
        >
          {t('campaignHome.characters')}
          <ChevronRight aria-hidden="true" size={15} />
        </Link>
      }
    >
      {players.length === 0 ? (
        <p className={styles.quiet}>{t('campaignHome.noPlayers')}</p>
      ) : (
        <ul className={styles.players}>
          {players.map((player) => {
            const theirs = all.filter((c) => c.owner?.id === player.userId)
            const first = theirs[0]
            return (
              <li key={player.userId} className={styles.player}>
                <span className={styles.avatar} aria-hidden="true">
                  {(first?.name ?? player.name).charAt(0).toUpperCase()}
                </span>
                <span className={styles.who}>
                  {first ? (
                    <Link
                      to="/mundos/$worldId/campanas/$campaignId/personajes/$characterId"
                      params={{ worldId, campaignId, characterId: first.id }}
                      search={{ vista: 'ficha' }}
                    >
                      {theirs.map((c) => c.name).join(', ')}
                    </Link>
                  ) : (
                    <b>{t('campaignHome.noCharacter')}</b>
                  )}
                  <span>{[first?.summary.line, player.name].filter(Boolean).join(' · ')}</span>
                </span>
                {/* Sus notas, de solo lectura (docs/specs/notas-jugador.md) */}
                <Link
                  to="/mundos/$worldId/campanas/$campaignId/notas"
                  params={{ worldId, campaignId }}
                  search={{ de: player.userId }}
                  className={styles.notes}
                  aria-label={t('notes.openOf', { name: player.name })}
                  title={t('notes.openOf', { name: player.name })}
                >
                  <NotebookPen aria-hidden="true" size={16} />
                  {t('notes.open')}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/** Los libros que usa: sus portadas, en fila */
function Shelf({ worldId, worldName, campaign, editable }: Props & { editable: boolean }) {
  const { t } = useTranslation()
  const books = useCampaignBooks(campaign)
  const active = books.filter((b) => b.on)
  const excluded = campaign.systemChoices?.excluded?.length ?? 0
  return (
    <Section
      title={t('campaignHome.booksTitle')}
      tour="inicio-libros"
      link={
        editable && (
          <Link
            to="/mundos/$worldId/campanas/$campaignId/libros"
            params={{ worldId, campaignId: campaign.id }}
            className={styles.more}
          >
            {t('campaignHome.change')}
            <ChevronRight aria-hidden="true" size={15} />
          </Link>
        )
      }
    >
      {!campaign.system ? (
        <p className={styles.quiet}>{t('campaignHome.noBooks')}</p>
      ) : (
        <>
          <ul className={styles.shelf}>
            {active.map((book) => (
              <li key={book.key}>
                <BookCover book={book} size="spine" />
              </li>
            ))}
          </ul>
          <p className={styles.quiet}>
            {t('campaignHome.booksLine', { count: active.length })}
            {t('campaignHome.withWorld', { world: worldName })}
            {editable && excluded > 0 ? t('campaignHome.excluded', { count: excluded }) : ''}
          </p>
        </>
      )}
    </Section>
  )
}

/** La aventura en curso: llega con Aventuras */
function Adventure({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t } = useTranslation()
  return (
    <Section
      title={t('campaignHome.adventureTitle')}
      link={
        <Link
          to="/mundos/$worldId/campanas/$campaignId/aventuras"
          params={{ worldId, campaignId }}
          className={styles.more}
        >
          {t('campaignHome.adventures')}
          <ChevronRight aria-hidden="true" size={15} />
        </Link>
      }
    >
      <p className={styles.quiet}>{t('campaignHome.noAdventure')}</p>
    </Section>
  )
}

/** El Inicio del máster */
export function CampaignHome({ worldId, worldName, campaign }: Props) {
  const { t } = useTranslation()
  const windows = useWindow()
  useDiceHere(worldId, campaign.id)
  return (
    <div className={styles.home}>
      <div className={styles.col}>
        <Hero
          campaign={campaign}
          worldName={worldName}
          actions={
            <button
              type="button"
              className={styles.ghost}
              onClick={(event) => windows?.open('campana', event.currentTarget)}
            >
              <UserPlus aria-hidden="true" size={16} />
              {t('campaignHome.invite')}
            </button>
          }
        />
        <MasterToday worldId={worldId} campaign={campaign} />
        <ActivityCenter worldId={worldId} campaign={campaign} master />
        <ToMesa worldId={worldId} campaignId={campaign.id} />
        <Players worldId={worldId} campaignId={campaign.id} />
        <div className={styles.two}>
          <Shelf worldId={worldId} worldName={worldName} campaign={campaign} editable />
          <Adventure worldId={worldId} campaignId={campaign.id} />
        </div>
      </div>
      <Tour
        id="campana"
        steps={[
          { target: '[data-tour="barra-mesa"]', text: t('tour.campaignHome.table') },
          { target: '[data-tour="barra-libros"]', text: t('tour.campaignHome.books') },
          { target: '[data-tour="barra-compendio"]', text: t('tour.campaignHome.compendium') },
          { target: '[data-tour="barra-aventuras"]', text: t('tour.campaignHome.adventures') },
          { target: '[data-tour="barra-ajustes-campana"]', text: t('tour.campaignHome.settings') },
          { target: '[data-tour="inicio-mesa"]', text: t('tour.campaignHome.toMesa') }
        ]}
      />
    </div>
  )
}

/** El Inicio de quien juega: su personaje, la Mesa, el grupo, los libros y lo que sabe (también en el móvil) */
export function PlayerCampaignHome({ worldId, worldName, campaign }: Props) {
  const { t } = useTranslation()
  const api = useApi()
  const narrow = useNarrow()
  useDiceHere(worldId, campaign.id)
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id })
  })
  const own = characters.data?.characters ?? []
  const allies = characters.data?.allies ?? []
  return (
    <div className={styles.home}>
      <div className={styles.col}>
        <Hero campaign={campaign} worldName={worldName} />
        <PlayerToday worldId={worldId} campaign={campaign} />
        <ActivityCenter worldId={worldId} campaign={campaign} master={false} compact={narrow} />
        <Section title={t('campaignHome.yours')} tour="inicio-personaje">
          {own.length === 0 && characters.data ? (
            <Link
              to="/mundos/$worldId/campanas/$campaignId/personajes"
              params={{ worldId, campaignId: campaign.id }}
              className={styles.create}
            >
              <UserPlus aria-hidden="true" size={17} />
              {t('playerHome.create')}
            </Link>
          ) : (
            <ul className={styles.mine}>
              {own.map((character) => (
                <li key={character.id}>
                  <Link
                    to="/mundos/$worldId/campanas/$campaignId/personajes/$characterId"
                    params={{ worldId, campaignId: campaign.id, characterId: character.id }}
                    search={{ vista: 'ficha' }}
                    className={styles.card}
                  >
                    <span className={styles.portrait} aria-hidden="true">
                      {character.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.who}>
                      <b>{character.name}</b>
                      <span>{character.summary.line}</span>
                    </span>
                    <ChevronRight aria-hidden="true" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <a
          href={`/mundos/${worldId}/campanas/${campaign.id}/mesa`}
          target="_blank"
          rel="noopener"
          className={[styles.toMesa, styles.wideButton].join(' ')}
          data-tour="inicio-mesa"
        >
          <Layers aria-hidden="true" size={18} />
          {t('campaignHome.toMesa')}
        </a>
        {allies.length > 0 && (
          <Section title={t('campaignHome.party')}>
            <ul className={styles.party}>
              {allies.map((ally) => (
                <li key={ally.id} className={styles.ally}>
                  <span className={styles.avatar} aria-hidden="true">
                    {ally.name.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.who}>
                    <b>{ally.name}</b>
                    <span>{[ally.line, ally.owner?.name].filter(Boolean).join(' · ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Shelf worldId={worldId} worldName={worldName} campaign={campaign} editable={false} />
        <Tour
          id="campana"
          steps={[
            { target: '[data-tour="barra-mesa"]', text: t('tour.playerCampaign.table') },
            { target: '[data-tour="barra-compendio"]', text: t('tour.playerCampaign.compendium') },
            { target: '[data-tour="barra-notas"]', text: t('tour.playerCampaign.notes') },
            { target: '[data-tour="inicio-personaje"]', text: t('tour.playerCampaign.character') },
            { target: '[data-tour="inicio-mesa"]', text: t('tour.playerCampaign.toMesa') }
          ]}
        />
        {/* La campaña: quién juega y, en su zona de peligro, dejarla */}
        <details className={styles.campaign}>
          <summary>{t('playerHome.campaign', { name: campaign.name })}</summary>
          <MembersPanel campaign={campaign} />
        </details>
      </div>
    </div>
  )
}

/** Los dados tiran en esta campaña */
function useDiceHere(worldId: string, campaignId: string) {
  const { setCampaign } = useDice()
  useEffect(() => setCampaign(worldId, campaignId), [setCampaign, worldId, campaignId])
}
