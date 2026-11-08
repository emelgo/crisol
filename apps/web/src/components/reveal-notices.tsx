/**
 * El aviso de lo que se le acaba de revelar a quien juega (docs/specs/revelar.md): «Nuevo: El pacto de Varn», con
 * «Leerlo» (lleva a su página, desde su campaña) y su X. Flota abajo a la derecha, estés donde estés, y se anuncia
 */
import { Link } from '@tanstack/react-router'
import { Eye, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotices } from '../realtime/context.tsx'
import { useAnnounce } from './announcer.tsx'
import { focusAfterRemoving } from './focus.ts'
import styles from './reveal-notices.module.css'

export function RevealNotices() {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const { revealed, dismissRevealed } = useNotices()
  const seen = useRef(new Set<string>())
  useEffect(() => {
    const fresh = revealed.filter((notice) => !seen.current.has(notice.id))
    for (const notice of fresh) seen.current.add(notice.id)
    if (fresh.length > 0) announce(fresh.map((n) => t('revealNotice.title', { title: n.title })).join(' '))
  }, [revealed, announce, t])
  if (revealed.length === 0) return null
  return (
    <section aria-label={t('revealNotice.region')} className={styles.region}>
      {revealed.map((notice) => (
        <article key={notice.id} className={styles.card}>
          <Eye aria-hidden="true" size={18} className={styles.icon} />
          <div className={styles.text}>
            <p className={styles.title}>{t('revealNotice.title', { title: notice.title })}</p>
            <p className={styles.what}>{t(`revealNotice.kinds.${notice.kind}`)}</p>
            {notice.pageId && (
              <Link
                to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
                params={{ worldId: notice.worldId, campaignId: notice.campaignId, pageId: notice.pageId }}
                className={styles.read}
                onClick={() => dismissRevealed(notice.id)}
              >
                {t('revealNotice.read')}
              </Link>
            )}
            {notice.kind === 'content' && notice.targetId && (
              <Link
                to="/mundos/$worldId/campanas/$campaignId/compendio"
                params={{ worldId: notice.worldId, campaignId: notice.campaignId }}
                search={{ ver: notice.targetId }}
                className={styles.read}
                onClick={() => dismissRevealed(notice.id)}
              >
                {t('revealNotice.read')}
              </Link>
            )}
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label={t('revealNotice.closeOne', { title: notice.title })}
            onClick={(event) => {
              // El foco, al aviso de al lado (o al título de la página): no se pierde en la nada
              const after = focusAfterRemoving(event.currentTarget.closest('article'))
              dismissRevealed(notice.id)
              requestAnimationFrame(after)
            }}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </article>
      ))}
    </section>
  )
}
