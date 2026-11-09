/**
 * El resultado de cada tirada, sobre el d20 (lienzo «Tirar dados»): sale cuando paran los dados 3D (o al momento, si
 * no caen) y se apaga solo. Lleva el total, lo que salió en cada dado, «Otra vez» y, al pulsarlo, abre el historial.
 * Las que no ve el grupo, en morado y con «solo tú» (las ocultas o las suyas para sí) o «para ti» (las que un jugador
 * le enseña solo al máster). Mientras los dados o el historial están abiertos, no sale
 */
import type { Campaign, DiceRoll } from '@crisol/contracts'
import { Repeat, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { useRolled } from '../realtime/context.tsx'
import { useDice } from './context.tsx'
import styles from './notices.module.css'
import { DiceRow, RollTags, useRollAgain } from './roll-parts.tsx'
import { isMine } from './rolls.ts'
import { useTray } from './tray.tsx'

/** Cuánto se queda cada uno, en milisegundos */
export const NOTICE_MS = 6000
/** Cuántos a la vez, como mucho (los más nuevos) */
const MAX = 3
/** Lo que llega por el canal sin que caigan sus dados (otra pestaña, la IA, sin 3D): cuánto se espera a la bandeja */
const WAIT_MINE_MS = 1500
const WAIT_OTHERS_MS = 400

export function RollNotices({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const dice = useDice()
  const tray = useTray()
  const announce = useAnnounce()
  const { account } = useAccounts().useAccount()
  const [shown, setShown] = useState<DiceRoll[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const seen = useRef(new Set<string>())
  const enabled = !dice.open && !dice.history
  const live = useRef(enabled)
  live.current = enabled
  const again = useRollAgain(campaign)

  const relevant = useCallback(
    // Lo «para sí» de otro le llega sin aviso (como en el historial)
    (roll: DiceRoll) => roll.campaignId === campaign.id && (roll.visibility !== 'self' || isMine(roll, account)),
    [campaign.id, account]
  )
  const forget = useCallback((id: string) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setShown((current) => current.filter((r) => r.id !== id))
  }, [])
  const later = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        setTimeout(() => forget(id), NOTICE_MS)
      )
    },
    [forget]
  )
  const show = useCallback(
    (roll: DiceRoll) => {
      if (seen.current.has(roll.id) || !live.current) return
      seen.current.add(roll.id)
      setShown((current) => [...current.filter((r) => r.id !== roll.id), roll].slice(-MAX))
      later(roll.id)
    },
    [later]
  )
  // Cuando paran los dados que caen
  useEffect(() => tray.onSettled((roll) => relevant(roll) && show(roll)), [tray, relevant, show])
  // Lo que llega por el canal y no cae: tras esperar un poco a la bandeja
  useRolled((roll) => {
    if (!relevant(roll)) return
    // Lo de los demás se lee al llegar (lo propio ya se dijo al tirarlo)
    if (!isMine(roll, account))
      announce(t('dice.heard', { who: roll.by.name, label: roll.label ?? roll.formula, total: roll.total }))
    const wait = isMine(roll, account) && !roll.ai ? WAIT_MINE_MS : WAIT_OTHERS_MS
    const id = setTimeout(() => {
      timers.current.delete(`wait:${roll.id}`)
      if (!tray.playing(roll.id)) show(roll)
    }, wait)
    timers.current.set(`wait:${roll.id}`, id)
  })
  // Al abrir los dados o el historial, fuera (ya están en el historial); al irse, sin temporizadores colgando
  useEffect(() => {
    if (!enabled) setShown([])
  }, [enabled])
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
    }
  }, [])
  const master = campaign.role === 'master'
  return (
    <ol className={styles.notices} aria-label={t('dice.lastRolls')}>
      {shown.map((roll) => {
        const mine = isMine(roll, account)
        const secret = roll.visibility !== 'all'
        return (
          <li
            key={roll.id}
            className={styles.notice}
            data-secret={secret || undefined}
            data-critical={roll.critical ?? undefined}
            onPointerEnter={() => clearTimeout(timers.current.get(roll.id))}
            onPointerLeave={() => later(roll.id)}
          >
            <button type="button" className={styles.open} onClick={dice.openHistory}>
              <span className={styles.total}>{roll.total}</span>
              <span className={styles.text}>
                <span className={styles.line}>
                  <b>{mine ? t('dice.me') : roll.by.name}</b>
                  {' · '}
                  {roll.label ?? roll.formula}
                </span>
                <DiceRow roll={roll} />
                <RollTags roll={roll} />
                {secret && (
                  <span className={styles.secret}>
                    {!mine
                      ? t('dice.forYou')
                      : roll.visibility === 'master' && !master
                        ? t('dice.youAndMaster')
                        : t('dice.onlyYou')}
                  </span>
                )}
              </span>
              <span className={styles.hidden}>{t('dice.openHistory')}</span>
            </button>
            <span className={styles.actions}>
              <button
                type="button"
                aria-label={t('dice.againOf', { what: roll.label ?? roll.formula })}
                title={t('dice.again')}
                onClick={() => {
                  forget(roll.id)
                  again.mutate(roll)
                }}
              >
                <Repeat size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t('dice.dismiss')}
                title={t('dice.dismiss')}
                onClick={() => forget(roll.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
