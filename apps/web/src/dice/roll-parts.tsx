/**
 * Las piezas de una tirada que comparten el aviso sobre el d20 y el historial (lienzo «Tirar dados»): los dados que
 * salieron en sus cajitas (los descartados, tachados; el 20 natural, en rojo), el modificador, si fue con ventaja, y
 * «Otra vez»
 */
import { type Campaign, type DiceRoll, visibilitiesFor } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import styles from './roll-parts.module.css'
import { appendRoll, isMine } from './rolls.ts'
import { useTray } from './tray.tsx'

/** Como mucho, cajitas de dados en una tirada; el resto, en el desglose */
const MAX_BOXES = 12

/** Si se tiró con ventaja o con desventaja (2d20kh1, 2d20kl1) */
export function advantageOf(formula: string): 'advantage' | 'disadvantage' | null {
  if (/(^|[^\d])2d20kh1/i.test(formula)) return 'advantage'
  if (/(^|[^\d])2d20kl1/i.test(formula)) return 'disadvantage'
  return null
}

/** Los dados seguidos del mismo tipo van juntos, con su nombre delante */
function groups(dice: DiceRoll['dice']) {
  const out: { sides: DiceRoll['dice'][number]['sides']; values: { value: number; kept: boolean }[] }[] = []
  for (const d of dice.slice(0, MAX_BOXES)) {
    const last = out.at(-1)
    if (last && last.sides === d.sides) last.values.push(d)
    else out.push({ sides: d.sides, values: [d] })
  }
  return out
}

/** Lo que no salió de los dados (el +5): solo si la tirada es una suma (con * o / no se sabe) */
function modifierOf(roll: DiceRoll): number {
  if (/[*/]/.test(roll.formula) || roll.dice.length > MAX_BOXES) return 0
  const fromDice = roll.dice.filter((d) => d.kept).reduce((sum, d) => sum + d.value, 0)
  return roll.total - fromDice
}

export function DiceRow({ roll }: { roll: DiceRoll }) {
  if (roll.dice.length === 0) return null
  const rest = modifierOf(roll)
  const parts = groups(roll.dice)
  return (
    <span className={styles.row} title={roll.detail}>
      {parts.map((part, i) => (
        // Los grupos no cambian de orden: la posición sirve de clave
        // biome-ignore lint/suspicious/noArrayIndexKey: los grupos de una tirada son fijos
        <span key={i} className={styles.group}>
          {i > 0 && <span className={styles.plus}>+</span>}
          <span className={styles.die}>{part.sides === 'F' ? 'dF' : `d${part.sides}`}</span>
          {part.values.map((d, j) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: los dados de una tirada son fijos
              key={j}
              className={styles.box}
              data-dropped={!d.kept || undefined}
              data-critical={(part.sides === 20 && d.kept && d.value === 20) || undefined}
            >
              {part.sides === 'F' ? (d.value > 0 ? '+' : d.value < 0 ? '−' : '0') : d.value}
            </span>
          ))}
        </span>
      ))}
      {roll.dice.length > MAX_BOXES && <span className={styles.plus}>…</span>}
      {rest !== 0 && (
        <span className={styles.rest}>
          {rest > 0 ? '+' : '−'} {Math.abs(rest)}
        </span>
      )}
    </span>
  )
}

/** Debajo de los dados: «Crítico» o «Pifia» y si fue con ventaja */
export function RollTags({ roll }: { roll: DiceRoll }) {
  const { t } = useTranslation()
  const advantage = advantageOf(roll.formula)
  if (!roll.critical && !advantage) return null
  return (
    <span className={styles.tags}>
      {roll.critical && (
        <span className={roll.critical === 'high' ? styles.critical : styles.fumble}>
          {t(roll.critical === 'high' ? 'dice.critical' : 'dice.fumble')}
        </span>
      )}
      {advantage && <span>{t(`dice.${advantage}`)}</span>}
    </span>
  )
}

/**
 * Con qué se repite una tirada: la suya, con la misma visibilidad si aún vale; una pública, para todos; una privada
 * de otro, nunca para todos: con la más privada que tenga quien repite (oculta el máster, «para mí» un jugador)
 */
export function againVisibility(roll: DiceRoll, mine: boolean, role: Campaign['role']) {
  const allowed = visibilitiesFor(role)
  if (mine && allowed.includes(roll.visibility)) return roll.visibility
  if (roll.visibility === 'all') return 'all'
  return role === 'master' ? 'hidden' : 'self'
}

/** «Otra vez»: la misma tirada (con su nombre) en la campaña */
export function useRollAgain(campaign: Pick<Campaign, 'id' | 'role'>) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const tray = useTray()
  const { account } = useAccounts().useAccount()
  return useMutation({
    mutationFn: (roll: DiceRoll) =>
      api.call('rollDice', {
        campaignId: campaign.id,
        formula: roll.label ? `${roll.formula} # ${roll.label}` : roll.formula,
        visibility: againVisibility(roll, isMine(roll, account), campaign.role)
      }),
    onSuccess: ({ roll }) => {
      appendRoll(queryClient, roll)
      tray.play(roll)
      announce(t('dice.rolled', { label: roll.label ?? roll.formula, total: roll.total }))
    },
    onError: (error) => announce(errorText(error))
  })
}
