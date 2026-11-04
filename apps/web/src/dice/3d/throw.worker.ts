/** La física de la tirada, fuera del hilo de la página: con 20 dados tarda medio segundo */
import type { DieKind } from './solids.ts'
import { throwDice } from './throw.ts'

self.onmessage = (event: MessageEvent<{ id: number; dice: { kind: DieKind; label: string }[] }>) => {
  self.postMessage({ id: event.data.id, thrown: throwDice(event.data.dice) })
}
