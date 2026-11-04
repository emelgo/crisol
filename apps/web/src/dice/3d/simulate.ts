/**
 * Simular una tirada: en un worker, para que la página no se pare mientras tanto. Sin workers (un navegador que no los
 * deja, las pruebas) o si el suyo falla, aquí mismo
 */
import type { DieKind } from './solids.ts'
import type { Thrown } from './throw.ts'

type Dice = { kind: DieKind; label: string }[]

const inline = (dice: Dice) => import('./throw.ts').then(({ throwDice }) => throwDice(dice))

export function simulator() {
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('./throw.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  let next = 0
  const waiting = new Map<number, { dice: Dice; done: (thrown: Promise<Thrown[]> | Thrown[]) => void }>()
  worker?.addEventListener('message', (event: MessageEvent<{ id: number; thrown: Thrown[] }>) => {
    waiting.get(event.data.id)?.done(event.data.thrown)
    waiting.delete(event.data.id)
  })
  // Si no carga (o se rompe), lo que esperaba se simula aquí y lo que venga, también
  worker?.addEventListener('error', () => {
    worker?.terminate()
    worker = null
    for (const { dice, done } of waiting.values()) done(inline(dice))
    waiting.clear()
  })
  return {
    run(dice: Dice): Promise<Thrown[]> {
      if (!worker) return inline(dice)
      const id = next++
      const promise = new Promise<Thrown[]>((resolve) => waiting.set(id, { dice, done: resolve }))
      worker.postMessage({ id, dice })
      return promise
    },
    stop() {
      worker?.terminate()
      worker = null
      waiting.clear()
    }
  }
}
