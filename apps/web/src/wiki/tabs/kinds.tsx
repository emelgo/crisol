/**
 * Los tipos de pestaña (ADR-0007, ADR-0024), en un solo sitio para «Página nueva», «Pestaña nueva» y lo que enseña una
 * plantilla: su icono, si ya se puede usar y si se ofrece al crear una página. Un tipo nuevo nace aquí (y, en el
 * servidor, con su forma de copiarse: packages/db/src/repos/copy.ts)
 */
import {
  ChevronLeft,
  Clock,
  Dices,
  FileText,
  Grid3x3,
  LayoutTemplate,
  Map as MapIcon,
  Network,
  PenTool
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './page-tabs.module.css'

export const TAB_KINDS = [
  { kind: 'text', icon: FileText, ready: true, newPage: true },
  { kind: 'map', icon: MapIcon, ready: true, newPage: true },
  { kind: 'table', icon: Dices, ready: true, newPage: false },
  { kind: 'scene', icon: Grid3x3, ready: true, newPage: false },
  { kind: 'board', icon: PenTool, ready: false, newPage: true },
  { kind: 'timeline', icon: Clock, ready: false, newPage: true },
  { kind: 'tree', icon: Network, ready: false, newPage: true }
] as const

export type TabKind = (typeof TAB_KINDS)[number]['kind']

/** El dibujo de un tipo de pestaña */
export const tabIcon = (kind: string) => TAB_KINDS.find((each) => each.kind === kind)?.icon ?? FileText

/**
 * Elegir el tipo: un recuadro por tipo (los que aún no, «Pronto») y, tras una raya con «o», «Desde plantilla», la
 * última y centrada, que abre su paso (onTemplate)
 */
export function KindChoices({
  name,
  legend,
  kinds,
  value,
  labelOf,
  onChange,
  onTemplate
}: {
  name: string
  legend: string
  kinds: readonly (typeof TAB_KINDS)[number][]
  value: string
  labelOf: (kind: TabKind) => string
  onChange: (kind: TabKind) => void
  onTemplate: () => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className={styles.kinds}>
      <legend className={styles.hidden}>{legend}</legend>
      {kinds.map(({ kind, icon: Icon, ready }) => (
        <label key={kind} className={styles.kindCard} data-ready={ready || undefined}>
          <input
            type="radio"
            name={name}
            disabled={!ready}
            checked={value === kind}
            onChange={() => {
              if (ready) onChange(kind)
            }}
          />
          <Icon aria-hidden="true" size={20} />
          {labelOf(kind)}
          {!ready && <span className={styles.soon}>{t('pageTabs.soon')}</span>}
        </label>
      ))}
      <span className={styles.or} aria-hidden="true">
        {t('newPage.or')}
      </span>
      <button type="button" className={`${styles.kindCard} ${styles.fromTemplate}`} data-ready="" onClick={onTemplate}>
        <LayoutTemplate aria-hidden="true" size={20} />
        {t('newPage.fromTemplate')}
      </button>
    </fieldset>
  )
}

/** «‹ Otro tipo»: vuelve del paso de la plantilla a elegir el tipo */
export function StepBack({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" className={styles.stepBack} onClick={onClick}>
      <ChevronLeft aria-hidden="true" size={16} />
      {t('newPage.otherKind')}
    </button>
  )
}
