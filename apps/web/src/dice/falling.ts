/** Los dados que caen de una tirada: su sólido y su cara, para la bandeja 3D. Como mucho 20; el resto, en el registro */
import type { DiceRoll } from '@crisol/contracts'
import type { DieKind } from './3d/solids.ts'

export const MAX_FALLING = 20

export interface FallingDie {
  kind: DieKind
  label: string
  /** Si cuenta: los descartados (ventaja, 4d6kh3) se ven más tenues al caer */
  kept: boolean
  /** El 20 natural del d20 que cuenta: brilla */
  critical: boolean
}

const SOLID = new Set([4, 6, 8, 10, 12, 20])

export function fallingDice(dice: DiceRoll['dice']): FallingDie[] {
  return dice
    .flatMap((d): FallingDie[] => {
      if (d.sides === 'F')
        return [{ kind: 'F', label: d.value > 0 ? '+' : d.value < 0 ? '−' : '', kept: d.kept, critical: false }]
      if (d.sides === 100) {
        const tens = d.value === 100 ? 0 : Math.floor(d.value / 10) * 10
        return [
          { kind: 'T', label: tens === 0 ? '00' : String(tens), kept: d.kept, critical: false },
          { kind: 10, label: String(d.value % 10), kept: d.kept, critical: false }
        ]
      }
      if (!SOLID.has(d.sides)) return []
      return [
        {
          kind: d.sides as DieKind,
          label: d.sides === 10 ? String(d.value % 10) : String(d.value),
          kept: d.kept,
          critical: d.sides === 20 && d.kept && d.value === 20
        }
      ]
    })
    .slice(0, MAX_FALLING)
}
