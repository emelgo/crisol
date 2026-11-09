/**
 * Las tiradas, fuera de su pestaña: cada una sale un momento sobre el d20 (lienzo «Campaña en la Mesa») y se apaga
 * sola. Las que no ve el grupo, en morado y con «solo tú» (las ocultas o las suyas para sí) o «para ti» (las que un
 * jugador le enseña solo al máster)
 */
import type { DiceRoll } from '@crisol/contracts'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { isMine } from '../dice/rolls.ts'
import { useRolled } from '../realtime/context.tsx'
import styles from './roll-toasts.module.css'

/** Cuánto se queda cada una, en milisegundos */
export const TOAST_MS = 5000
/** Cuántas a la vez, como mucho (las más nuevas) */
const MAX = 3

export function RollToasts({
  campaignId,
  enabled,
  master = true
}: {
  campaignId: string
  enabled: boolean
  /** Quien mira lleva la campaña (lo suyo «para el máster» es solo suyo) */
  master?: boolean
}) {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const [shown, setShown] = useState<DiceRoll[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useRolled((roll) => {
    if (!enabled || roll.campaignId !== campaignId) return
    // Lo «para sí» de otro le llega sin aviso (como en el registro)
    if (roll.visibility === 'self' && !isMine(roll, account)) return
    setShown((current) => [...current.filter((r) => r.id !== roll.id), roll].slice(-MAX))
    // La misma por los dos caminos: un solo temporizador
    clearTimeout(timers.current.get(roll.id))
    timers.current.set(
      roll.id,
      setTimeout(() => {
        timers.current.delete(roll.id)
        setShown((current) => current.filter((r) => r.id !== roll.id))
      }, TOAST_MS)
    )
  })
  // Al abrir la pestaña, fuera (ya están en el registro); al irse, sin temporizadores colgando
  useEffect(() => {
    if (!enabled) setShown([])
  }, [enabled])
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
    }
  }, [])
  return (
    <ol className={styles.toasts} aria-live="polite" aria-label={t('tabletop.lastRolls')}>
      {shown.map((roll) => {
        const secret = roll.visibility !== 'all'
        return (
          <li key={roll.id} className={styles.toast} data-secret={secret || undefined}>
            <div className={styles.text}>
              <b>{roll.by.name}</b>
              <span>{roll.label ?? roll.formula}</span>
              {secret && (
                <span className={styles.secret}>
                  {!isMine(roll, account)
                    ? t('tabletop.forYou')
                    : roll.visibility === 'master' && !master
                      ? t('tabletop.youAndMaster')
                      : t('tabletop.onlyYou')}
                </span>
              )}
            </div>
            <span className={styles.total} data-critical={roll.critical ?? undefined}>
              {roll.total}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
