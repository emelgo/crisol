/**
 * Lo elegido en el cuadro de «Pestaña nueva» para una escena: el cuadro crea la pestaña y la abre, y la pestaña, al
 * montarse, lo recoge y prepara el mapa
 */
import type { SceneChoice } from '../../tabletop/use-preparation.ts'

const pending = new Map<string, SceneChoice>()

export const setPendingChoice = (tabId: string, choice: SceneChoice) => pending.set(tabId, choice)

export function takePendingChoice(tabId: string): SceneChoice | null {
  const choice = pending.get(tabId) ?? null
  pending.delete(tabId)
  return choice
}
