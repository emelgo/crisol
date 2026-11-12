/**
 * Las pestañas de un libro por dentro (ADR-0025): «Capítulos» y «Entradas», bajo su título, en texto plano con la
 * elegida subrayada, como las de una página (docs/diseno.md)
 */
import { Link, type LinkProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SECTION } from '../components/world-transition.ts'
import styles from './book-tabs.module.css'

/** Lo de la dirección de un libro por dentro */
export interface BookSearch {
  ver?: string
  capitulo?: string
  vista?: 'capitulos' | 'entradas'
}

export type BookView = 'capitulos' | 'entradas'

export function BookTabs({
  current,
  chapters,
  entries
}: {
  current: BookView
  /** A dónde lleva cada una (con su dirección, para abrirla también en otra pestaña) */
  chapters: LinkProps
  entries: LinkProps
}) {
  const { t } = useTranslation()
  return (
    <nav className={styles.tabs} aria-label={t('chapters.views')}>
      <Link
        {...chapters}
        className={styles.tab}
        aria-current={current === 'capitulos' ? 'page' : undefined}
        viewTransition={SECTION}
      >
        {t('chapters.tab')}
      </Link>
      <Link
        {...entries}
        className={styles.tab}
        aria-current={current === 'entradas' ? 'page' : undefined}
        viewTransition={SECTION}
      >
        {t('chapters.entries')}
      </Link>
    </nav>
  )
}
