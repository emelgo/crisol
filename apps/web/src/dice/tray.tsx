/**
 * La bandeja de dados 3D: un lienzo sobre toda la pantalla, que no se puede pulsar, donde caen los dados con el
 * resultado que dio el servidor. Caen los tuyos al tirar y los de las tiradas públicas de los demás en el mundo en el que
 * estás (si no lo has apagado). La escena (three.js y la física) se carga aparte, la primera vez que se tira
 */
import type { Campaign, DiceRoll } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useRolled } from '../realtime/context.tsx'
import type { DiceScene } from './3d/scene.ts'
import { useWorldInPath } from './context.tsx'
import { fallingDice } from './falling.ts'
import { colorOf, isMine } from './rolls.ts'
import styles from './tray.module.css'

/** Cuánto se ve el total, desde que se paran los dados */
const TOTAL_MS = 2600

interface Shown {
  id: string
  total: number
  who: string
  color: string
  critical: boolean
}

const TrayContext = createContext<{ play(roll: DiceRoll): void }>({ play: () => {} })

/** Hacer caer los dados de una tirada */
export const useTray = () => useContext(TrayContext)

export function DiceTray({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { account } = useAccounts().useAccount()
  const worldId = useWorldInPath()
  const canvas = useRef<HTMLCanvasElement>(null)
  // Sin WebGL (un navegador viejo, una máquina sin gráficos) no caen dados: las tiradas siguen en el registro
  const scene = useRef<Promise<DiceScene | null> | null>(null)
  const [shown, setShown] = useState<Shown[]>([])

  const play = useCallback(
    (roll: DiceRoll) => {
      const dice = fallingDice(roll.dice)
      const target = canvas.current
      // Con la pestaña escondida no se dibuja: la tirada sigue en el registro
      if (dice.length === 0 || !target || document.hidden) return
      scene.current ??= import('./3d/scene.ts').then(({ createScene }) => createScene(target)).catch(() => null)
      const mine = isMine(roll, account)
      const color = colorOf(roll.by.userId, mine ? (account?.diceColor ?? roll.by.color) : roll.by.color)
      const total: Shown = {
        id: roll.id,
        total: roll.total,
        who: mine ? t('dice.me') : roll.by.name,
        color,
        critical: roll.critical === 'high'
      }
      void scene.current.then((s) =>
        s?.play(dice, color, () => {
          setShown((current) => [...current, total])
          window.setTimeout(() => setShown((current) => current.filter((x) => x.id !== total.id)), TOTAL_MS)
        })
      )
    },
    [account, t]
  )

  // Las de los demás: en el mundo en el que se está y si no se ha apagado; las tuyas ya cayeron al tirarlas
  useRolled((roll) => {
    // Solo las públicas: lo privado de un jugador no cae en la pantalla del máster (puede estar compartiéndola)
    if (roll.visibility !== 'all' || isMine(roll, account) || account?.diceOthers === false || !worldId) return
    const here = queryClient.getQueryData<{ campaigns: Campaign[] }>(['campaigns', worldId])
    if (here?.campaigns.some((c) => c.id === roll.campaignId)) play(roll)
  })

  // Al salir (cerrar la sesión), la escena se suelta entera
  useEffect(
    () => () => {
      void scene.current?.then((s) => s?.dispose())
      scene.current = null
    },
    []
  )

  const value = useMemo(() => ({ play }), [play])
  return (
    <TrayContext.Provider value={value}>
      {children}
      <div className={styles.tray} aria-hidden="true">
        <canvas ref={canvas} className={styles.canvas} />
      </div>
      {/* El total, grande, al pararse: lo que se lee ya se anuncia desde el registro */}
      <div className={styles.totals} aria-hidden="true">
        {shown.map((s) => (
          <p key={s.id} className={styles.total} data-testid="total-tirada">
            <span className={s.critical ? styles.critical : styles.number}>{s.total}</span>
            <span className={styles.who} style={{ color: s.color }}>
              {s.critical ? t('dice.whoCritical', { who: s.who }) : s.who}
            </span>
          </p>
        ))}
      </div>
    </TrayContext.Provider>
  )
}
