/**
 * La sección Mesa de la campaña (ADR-0021, Enrique 2026-11-10: «al entrar en mesa … un abrir mesa que abre una nueva
 * pestaña … y ver quiénes están dentro, si está activo»): abrir la Mesa (y la tele) en otra pestaña, quién está en
 * ella ahora y, para el máster, cómo va la partida. Debajo, los personajes
 */
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Layers, Tv } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import styles from './table-lobby.module.css'

export function TableLobby({ worldId, campaignId, master }: { worldId: string; campaignId: string; master: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const presence = useQuery({
    queryKey: ['tablePresence', campaignId],
    queryFn: () => api.call('getTablePresence', { campaignId })
  })
  const table = useQuery({
    queryKey: ['campaignTable', campaignId],
    queryFn: () => api.call('getCampaignTable', { campaignId }),
    enabled: master
  })
  const base = `/mundos/${worldId}/campanas/${campaignId}`
  const present = presence.data?.present ?? []
  const time = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  const data = table.data
  return (
    <section className={styles.lobby} aria-label={t('ribbon.table')}>
      <div className={styles.open}>
        <a href={`${base}/mesa`} target="_blank" rel="noopener" className={styles.openMesa} data-tour="mesa-abrir">
          <Layers aria-hidden="true" size={18} />
          {t('lobby.open')}
          <ExternalLink aria-hidden="true" size={15} />
          <span className={styles.hidden}>({t('lobby.newTab')})</span>
        </a>
        {master && (
          <a href={`${base}/pantalla`} target="_blank" rel="noopener" className={styles.openTv}>
            <Tv aria-hidden="true" size={16} />
            {t('lobby.openTv')}
            <span className={styles.hidden}>({t('lobby.newTab')})</span>
          </a>
        )}
      </div>
      <div className={styles.columns}>
        <div>
          <h2 className={styles.h}>{t('lobby.present')}</h2>
          {present.length === 0 ? (
            <p className={styles.quiet}>{t('lobby.nobody')}</p>
          ) : (
            <ul className={styles.present} data-tour="mesa-presentes">
              {present.map((who) => (
                <li key={`${who.userId}-${who.viewer}`} className={styles.who}>
                  <span
                    className={who.active ? styles.dot : `${styles.dot} ${styles.away}`}
                    role="img"
                    aria-label={who.active ? t('lobby.active') : t('lobby.away')}
                  />
                  <span className={styles.name}>
                    <b>{who.viewer === 'screen' ? t('lobby.screen') : who.name}</b>
                    <span>
                      {[
                        who.viewer === 'master'
                          ? t('lobby.master')
                          : who.viewer === 'player'
                            ? t('lobby.player')
                            : who.name,
                        who.active ? t('lobby.active') : t('lobby.away'),
                        t('lobby.since', { time: time(who.since) }),
                        who.tabs > 1 ? t('lobby.tabs', { count: who.tabs }) : ''
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {master && data && (
          <div>
            <h2 className={styles.h}>{t('lobby.game')}</h2>
            <dl className={styles.game}>
              <dt>{t('lobby.scene')}</dt>
              <dd>{data.open?.name ?? t('lobby.noScene')}</dd>
              <dt>{t('lobby.tv')}</dt>
              <dd>{data.screenHidden ? t('lobby.tvHidden') : (data.presented?.name ?? t('lobby.tvNothing'))}</dd>
              <dt>{t('lobby.combat')}</dt>
              <dd>
                {data.combat
                  ? data.combat.round > 0
                    ? t('lobby.combatRound', { round: data.combat.round })
                    : t('lobby.combatStart')
                  : t('lobby.noCombat')}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}
