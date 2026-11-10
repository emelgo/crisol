/**
 * Lo que dice un personaje en el registro («en personaje» y para todos) sale unos segundos en una burbuja sobre su ficha,
 * en la vista de jugadores (docs/specs/registro.md): encaja con la mesa en persona, donde todos miran la tele
 */
import type { LogEntry, ScreenView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { useApi } from '../api/context.tsx'
import styles from './bubbles.module.css'

const SHOWN_MS = 6000

type Bubble = { id: string; name: string; text: string; x: number; y: number }

export function useBubbles(campaignId: string, screen: ScreenView | null) {
  const api = useApi()
  // Se vuelve a pedir con cada aviso del registro (comparte la clave del registro: ['log', campaña, …])
  const log = useQuery({
    queryKey: ['log', campaignId, 'bubbles'],
    queryFn: () => api.call('listLog', { campaignId, only: 'messages' })
  })
  const seen = useRef<Set<string> | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const screenRef = useRef(screen)
  screenRef.current = screen
  useEffect(() => {
    const entries = log.data?.entries
    if (!entries) return
    // Lo que ya había al entrar no sale: solo lo nuevo
    if (!seen.current) {
      seen.current = new Set(entries.map((e) => e.id))
      return
    }
    const known = seen.current
    const fresh = entries.filter((e) => !known.has(e.id))
    for (const e of fresh) known.add(e.id)
    const said = fresh.flatMap((entry) => bubbleOf(entry, screenRef.current))
    if (said.length === 0) return
    setBubbles((now) => [...now.filter((b) => !said.some((s) => s.name === b.name)), ...said])
    for (const bubble of said)
      window.setTimeout(() => setBubbles((now) => now.filter((b) => b.id !== bubble.id)), SHOWN_MS)
  }, [log.data])
  return bubbles
}

/** Dónde sale: encima de la ficha del personaje que habla, si está en la escena y se ve */
export function bubbleOf(entry: LogEntry, screen: ScreenView | null): Bubble[] {
  if (entry.kind !== 'message' || entry.deleted || entry.whisper || entry.style !== 'ic') return []
  if (entry.speaker.kind === 'user' || !screen?.scene) return []
  const name = entry.speaker.name
  const token = screen.tokens.find((t) => t.name === name)
  if (!token) return []
  const cell = screen.scene.grid.size
  return [{ id: entry.id, name, text: entry.text, x: token.x, y: token.y - (token.size * cell) / 2 - 6 }]
}

export function Bubbles({ layer, bubbles }: { layer: RefObject<HTMLDivElement | null>; bubbles: readonly Bubble[] }) {
  return (
    <div ref={layer} className={styles.layer} aria-hidden="true">
      {bubbles.map((b) => (
        <div key={b.id} className={styles.bubble} data-x={b.x} data-y={b.y}>
          <b>{b.name}</b>
          <span>{b.text}</span>
        </div>
      ))}
    </div>
  )
}
