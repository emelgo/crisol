/**
 * La pestaña «Pizarra» (módulo 9): el editor (el máster, en la wiki) o la vista (la jugadora, en su campaña), cada uno
 * cargado a demanda: Excalidraw solo se descarga al abrir una pizarra
 */
import type { Page, PageTabView } from '@crisol/contracts'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './board.module.css'

const BoardEditor = lazy(() => import('./board-editor.tsx'))
const BoardView = lazy(() => import('./board-view.tsx'))

function Loading() {
  const { t } = useTranslation()
  return (
    <div className={styles.wrapper}>
      <p className={styles.loading} role="status">
        {t('board.loading')}
      </p>
    </div>
  )
}

/** La pizarra del máster: la edita en vivo */
export function BoardTab({ page, tab }: { page: Page; tab: PageTabView }) {
  return (
    <Suspense fallback={<Loading />}>
      <BoardEditor page={page} tab={tab} />
    </Suspense>
  )
}

/** La pizarra de una jugadora: la ve, sin escribir */
export function BoardReadTab({ page, tab }: { page: Page; tab: PageTabView }) {
  return (
    <Suspense fallback={<Loading />}>
      <BoardView page={page} tab={tab} />
    </Suspense>
  )
}
