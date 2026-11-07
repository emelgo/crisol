/**
 * «Preparando el mapa…»: la imagen detrás, tapada por casillas que se destapan según se suben las teselas, y en medio
 * la llama latiendo, cuántas partes van y «Cancelar» (como en el lienzo de la mesa)
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { CrisolMark } from '../components/brand.tsx'
import styles from './preparing.module.css'
import type { Preparation } from './use-preparation.ts'

/** Cuántas casillas tapan la imagen como mucho por lado */
const MAX_CELLS = 10

export function Preparing({
  state,
  onCancel
}: {
  state: Extract<Preparation, { status: 'preparing' }>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { done, total, preview, size } = state
  const ratio = size ? size.width / size.height : 3 / 2
  const columns = Math.max(1, Math.min(MAX_CELLS, Math.round(ratio >= 1 ? MAX_CELLS : MAX_CELLS * ratio)))
  const rows = Math.max(1, Math.min(MAX_CELLS, Math.round(ratio >= 1 ? MAX_CELLS / ratio : MAX_CELLS)))
  const cells = columns * rows
  const uncovered = total > 0 ? Math.floor((done / total) * cells) : 0
  return (
    <div className={styles.box}>
      <div
        className={styles.image}
        style={{ aspectRatio: String(ratio), '--columns': columns, '--rows': rows } as CSSProperties}
      >
        {preview && <img src={preview} alt="" />}
        <div className={styles.cells} aria-hidden="true">
          {Array.from({ length: cells }, (_, i) => (
            <i key={i} data-done={i < uncovered || undefined} />
          ))}
        </div>
      </div>
      <div className={styles.card} role="status">
        <CrisolMark size={26} className={styles.beat} />
        <b>{t('scene.preparing')}</b>
        <progress max={Math.max(1, total)} value={done} aria-label={t('scene.preparing')} />
        <span className={styles.parts}>{total > 0 ? t('scene.parts', { done, total }) : ' '}</span>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {t('scene.cancel')}
        </button>
      </div>
    </div>
  )
}
