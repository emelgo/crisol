/**
 * La ficha de un libro, en una ventana que sale de su tarjeta (la portada viaja con una transición de vista): de qué
 * va, qué trae (cada recuento abre el compendio con ese libro), a qué amplía y qué campañas lo usan
 */
import type { Book } from '@crisol/contracts'
import { Link } from '@tanstack/react-router'
import { Layers } from 'lucide-react'
import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../components/modal.tsx'
import { BookCover } from './book-cover.tsx'
import styles from './books.module.css'

export function BookWindow({
  book,
  books,
  systemName,
  builtIn,
  compendium,
  onClose
}: {
  book: Book
  /** Todos los del sistema, para los nombres de a qué amplía */
  books: readonly Book[]
  systemName: string
  builtIn: boolean
  /** Dónde abrir el compendio con este libro (el de una campaña); sin él, no se enlaza */
  compendium?: { worldId: string; campaignId: string } | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const requires = book.requires.map((key) => books.find((b) => b.key === key)?.name ?? key)
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={styles.window} onClose={onClose}>
      <div className={styles.windowBody}>
        <h2 id={titleId} className={styles.windowTitle}>
          {book.name}
        </h2>
        <div className={styles.windowGrid}>
          <div>
            <span className={styles.bigCover} style={{ viewTransitionName: 'libro-abierto' }}>
              <BookCover book={book} size="card" />
            </span>
            <dl className={styles.kv}>
              <dt>{t('books.system')}</dt>
              <dd>{systemName}</dd>
              {book.edition && (
                <>
                  <dt>{t('books.edition')}</dt>
                  <dd>{book.edition}</dd>
                </>
              )}
              <dt>{t('books.originLabel')}</dt>
              <dd>{builtIn ? t('books.origin.builtIn') : book.origin ? t(`books.origin.${book.origin}`) : '—'}</dd>
              <dt>{t('books.version')}</dt>
              <dd>{book.version}</dd>
              <dt>{t('books.license')}</dt>
              <dd>{book.license}</dd>
            </dl>
          </div>
          <div className={styles.windowMain}>
            {book.description && <p className={styles.description}>{book.description}</p>}
            <h3 className={styles.h}>{t('books.brings')}</h3>
            {book.byType.length === 0 ? (
              <p className={styles.quiet}>{t('books.empty')}</p>
            ) : (
              <ul className={styles.counts}>
                {book.byType.map((type) => (
                  <li key={type.type} className={styles.count}>
                    <span className={styles.countName}>{type.label}</span>
                    <span className={styles.countNumber}>{type.count}</span>
                    <span className={styles.examples}>{type.examples.join(', ')}…</span>
                    {compendium && (
                      <Link
                        to="/mundos/$worldId/campanas/$campaignId/compendio"
                        params={compendium}
                        search={{ libro: book.key, tipo: type.type }}
                      >
                        {t('books.inCompendium')}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {requires.length > 0 && (
              <>
                <h3 className={styles.h}>{t('books.extends')}</h3>
                <p className={styles.extends}>
                  <Layers aria-hidden="true" size={16} />
                  <span>{requires.join(', ')}</span>
                </p>
              </>
            )}
            <h3 className={styles.h}>{t('books.usedBy')}</h3>
            {book.campaigns.length === 0 ? (
              <p className={styles.quiet}>{t('books.noCampaigns')}</p>
            ) : (
              <p className={styles.campaigns}>
                {book.campaigns.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ' · '}
                    <Link to="/mundos/$worldId/campanas/$campaignId" params={{ worldId: c.worldId, campaignId: c.id }}>
                      {c.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** Abrir algo con una transición de vista (la portada de la tarjeta viaja a la de la ventana); sin ella, al momento */
export function withTransition(card: HTMLElement | null, open: () => void) {
  if (typeof document.startViewTransition !== 'function' || !card) {
    open()
    return
  }
  card.style.viewTransitionName = 'libro-abierto'
  document.startViewTransition({
    update: () => {
      card.style.viewTransitionName = ''
      open()
    },
    types: ['abrir-libro']
  })
}

/** Recolocar unas tarjetas (al filtrar): las que se quedan se deslizan a su sitio; las que se van, se funden */
export function relayout(update: () => void) {
  if (typeof document.startViewTransition !== 'function') {
    update()
    return
  }
  document.startViewTransition({ update, types: ['recolocar'] })
}
