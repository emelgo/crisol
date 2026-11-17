/**
 * La bandeja de dados 3D: un lienzo sobre toda la pantalla, que no se puede pulsar, donde caen los dados con el
 * resultado que dio el servidor. Caen los tuyos al tirar y los de las tiradas públicas de los demás en el mundo en el que
 * estás (si no lo has apagado). La escena (three.js y la física) se carga aparte, en cuanto hay un rato libre dentro de
 * un mundo, para que la primera tirada no espere. Las tuyas empiezan a caer en el clic, mientras se pregunta al
 * servidor; al llegar el resultado, se le ponen sus números. Cuando paran, avisa: el resultado sale entonces sobre el d20
 */
import type { Campaign, DiceRoll } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useAccounts } from '../account/context.tsx'
import { useRolled } from '../realtime/context.tsx'
import type { DiceScene, PendingThrow } from './3d/scene.ts'
import { useWorldInPath } from './context.tsx'
import { fallingDice } from './falling.ts'
import { predictFalling } from './predict.ts'
import { colorOf, isMine } from './rolls.ts'
import styles from './tray.module.css'

type Settled = (roll: DiceRoll) => void

/** Lo más que se espera a que paren los dados: luego el resultado sale igual */
const SETTLE_MAX_MS = 8000
/** Lo más que caen unos dados esperando al servidor: si no contesta, se van */
const WAIT_MAX_MS = 15000

/** Una tirada tuya que ya cae, a falta del resultado */
export interface Throwing {
  /** El resultado: si son los dados que caen, se les ponen sus números; si no, caen los suyos */
  land(roll: DiceRoll): void
  /** La tirada falló: los dados se van */
  cancel(): void
}

interface Tray {
  /** Hacer caer los dados de una tirada */
  play(roll: DiceRoll): void
  /** Empezar a tirar en el clic, antes del resultado; null si no se sabe qué dados caerán (entonces, play al llegar) */
  start(formula: string): Throwing | null
  /** Avisa cuando paran los dados de una tirada (o al momento, si no caen) */
  onSettled(listener: Settled): () => void
  /** Si los dados de esa tirada están cayendo */
  playing(rollId: string): boolean
  /** Va a tirar (el ratón o el foco en el d20): se carga ya la escena, para que la primera tirada no espere */
  prepare(): void
}

const TrayContext = createContext<Tray>({
  play: () => {},
  start: () => null,
  onSettled: () => () => {},
  playing: () => false,
  prepare: () => {}
})

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
  // La escena, una sola vez (y calentada una sola vez)
  const warmed = useRef(false)
  const load = useCallback((target: HTMLCanvasElement) => {
    scene.current ??= import('./3d/scene.ts').then(({ createScene }) => createScene(target)).catch(() => null)
    return scene.current.then((s) => {
      if (s && !warmed.current) {
        warmed.current = true
        s.warm?.()
      }
      return s
    })
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
      const mine = isMine(roll, account)
      const color = colorOf(roll.by.userId, mine ? (account?.diceColor ?? roll.by.color) : roll.by.color)
      void load(target).then((s) => {
        if (s) s.play(dice, color, () => settle(roll))
        else settle(roll)
      })
    },
    [account, settle, load]
  )

  const start = useCallback(
    (formula: string): Throwing | null => {
      const kinds = predictFalling(formula)
      const target = canvas.current
      if (!kinds || !target || document.hidden) return null
      const color = colorOf(account?.id ?? account?.name ?? '', account?.diceColor)
      const pending: Promise<PendingThrow | null> = load(target).then((s) => s?.start(kinds, color) ?? null)
      let done = false
      const cancel = () => {
        done = true
        void pending.then((p) => p?.cancel())
      }
      // Si nadie dice cómo acabó (no debería pasar), se van solos
      window.setTimeout(() => {
        if (!done) cancel()
      }, WAIT_MAX_MS)
      return {
        land(roll) {
          if (done) return
          const dice = fallingDice(roll.dice)
          // Cayeron otros (no debería pasar): se van y caen los de la tirada
          if (dice.length !== kinds.length || dice.some((d, i) => d.kind !== kinds[i])) {
            cancel()
            play(roll)
            return
          }
          done = true
          if (falling.current.has(roll.id)) return
          falling.current.add(roll.id)
          window.setTimeout(() => {
            if (falling.current.has(roll.id)) settle(roll)
          }, SETTLE_MAX_MS)
          void pending.then((p) => {
            if (p) p.land(dice, () => settle(roll))
            else settle(roll)
          })
        },
        cancel() {
          if (!done) cancel()
        }
      }
    },
    [account, settle, load, play]
  )

  // La escena (three.js, ~0,5 MB) no se carga hasta que se va a tirar (Enrique, 2026-11-14: así las páginas pesan
  // menos): al acercarse al d20, al tirar o al llegar la tirada de otro
  const prepare = useCallback(() => {
    if (canvas.current) void load(canvas.current)
  }, [load])

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
      start,
      onSettled: (listener) => {
        listeners.current.add(listener)
        return () => listeners.current.delete(listener)
      },
      playing: (rollId) => falling.current.has(rollId),
      prepare
    }),
    [play, start, prepare]
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
