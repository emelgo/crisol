/**
 * En la Mesa, el historial de tiradas es una ventana más (lienzo «Tirar dados»): mientras está abierta, «Historial»
 * (en los dados o al pulsar un resultado) la abre allí en vez de en la ficha junto al d20
 */
import type { Campaign } from '@crisol/contracts'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindows, type WindowSpec } from '../components/windows.tsx'
import { useDice } from './context.tsx'
import styles from './dice.module.css'
import { useSheet } from './floating.ts'
import { RollLog } from './log.tsx'

export function historyWindow(campaign: Campaign, title: string): WindowSpec {
  return {
    id: 'historial',
    title,
    width: 420,
    height: 560,
    render: () => (
      <div className={styles.windowLog}>
        <RollLog campaign={campaign} />
      </div>
    )
  }
}

export function HistoryHost({ campaign }: { campaign: Campaign | undefined }) {
  const { t } = useTranslation()
  const windows = useWindows()
  const { setHistoryHost } = useDice()
  // En el móvil, la hoja desde abajo de siempre (las ventanas son para el PC)
  const sheet = useSheet()
  const open = sheet ? undefined : windows?.open
  useEffect(() => {
    if (!open || !campaign) return
    setHistoryHost(() => open(historyWindow(campaign, t('dice.history'))))
    return () => setHistoryHost(null)
  }, [open, campaign, setHistoryHost, t])
  return null
}
