/**
 * La bandeja de dados 3D: un lienzo sobre toda la pantalla, que no se puede pulsar, donde caen los dados con el
 * resultado que dio el servidor. Caen los tuyos al tirar y los de las tiradas públicas de los demás en el mundo en el que
 * estás (si no lo has apagado). La escena (three.js y la física) se carga aparte, la primera vez que se tira. Cuando
 * paran, avisa: el resultado sale entonces sobre el d20
 */
import type { Campaign, DiceRoll } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useAccounts } from '../account/context.tsx'
import { useRolled } from '../realtime/context.tsx'
import type { DiceScene } from './3d/scene.ts'
import { useWorldInPath } from './context.tsx'
import { fallingDice } from './falling.ts'
import { colorOf, isMine } from './rolls.ts'
import styles from './tray.module.css'

type Settled = (roll: DiceRoll) => void

/** Lo más que se espera a que paren los dados: luego el resultado sale igual */
const SETTLE_MAX_MS = 8000

interface Tray {
  /** Hacer caer los dados de una tirada */
  play(roll: DiceRoll): void
  /** Avisa cuando paran los dados de una tirada (o al momento, si no caen) */
  onSettled(listener: Settled): () => void
  /** Si los dados de esa tirada están cayendo */
  playing(rollId: string): boolean
}

const TrayContext = createContext<Tray>({ play: () => {}, onSettled: () => () => {}, playing: () => false })

export const useTray = () => useContext(TrayContext)

export function DiceTray({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { account } = useAccounts().useAccount()
  const worldId = useWorldInPath()
  const canvas = useRef<HTMLCanvasElement>(null)
  // Sin WebGL (un navegador viejo, una máquina sin gráficos) no caen dados: las tiradas siguen en el registro
  const scene = useRef<Promise<DiceScene | null> | null>(null)
  const listeners = useRef(new Set<Settled>())
  const falling = useRef(new Set<string>())
  const settle = useCallback((roll: DiceRoll) => {
    falling.current.delete(roll.id)
    for (const listener of listeners.current) listener(roll)
  }, [])

  const play = useCallback(
    (roll: DiceRoll) => {
      if (falling.current.has(roll.id)) return
      const dice = fallingDice(roll.dice)
      const target = canvas.current
      // Con la pestaña escondida no se dibuja: el resultado sale al momento
      if (dice.length === 0 || !target || document.hidden) {
        settle(roll)
        return
      }
      falling.current.add(roll.id)
      // Si la escena falla a medias y no avisa, el resultado sale igual
      window.setTimeout(() => {
        if (falling.current.has(roll.id)) settle(roll)
      }, SETTLE_MAX_MS)
      scene.current ??= import('./3d/scene.ts').then(({ createScene }) => createScene(target)).catch(() => null)
      const mine = isMine(roll, account)
      const color = colorOf(roll.by.userId, mine ? (account?.diceColor ?? roll.by.color) : roll.by.color)
      void scene.current.then((s) => {
        if (s) s.play(dice, color, () => settle(roll))
        else settle(roll)
      })
    },
    [account, settle]
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

  const value = useMemo<Tray>(
    () => ({
      play,
      onSettled: (listener) => {
        listeners.current.add(listener)
        return () => listeners.current.delete(listener)
      },
      playing: (rollId) => falling.current.has(rollId)
    }),
    [play]
  )
  return (
    <TrayContext.Provider value={value}>
      {children}
      <div className={styles.tray} aria-hidden="true">
        <canvas ref={canvas} className={styles.canvas} />
      </div>
    </TrayContext.Provider>
  )
}
