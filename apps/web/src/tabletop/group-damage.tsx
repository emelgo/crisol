/**
 * El daño (o la curación) a varias fichas elegidas a la vez (docs/specs/combate.md, «Daño a varias» del lienzo): una
 * cantidad para todas, o una tirada del registro con nada, mitad, entero o doble para cada una (`applyRoll`, con sus
 * resistencias). Va a lo vital de su personaje o su criatura
 */
import type { TokenView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import styles from './combat.module.css'
import { initialOf } from './tokens.ts'

const MULTIPLIERS = [0, 0.5, 1, 2] as const
const WORDS = { 0: 'x0', 0.5: 'x05', 1: 'x1', 2: 'x2' } as const
type Multiplier = (typeof MULTIPLIERS)[number]
type Mode = 'damage' | 'heal' | 'roll'

export function GroupDamage({
  campaignId,
  tokens,
  title,
  onClose
}: {
  campaignId: string
  tokens: TokenView[]
  /** Lo que dice en vez de «N elegidas» (las de dentro de una plantilla) */
  title?: string | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const ids = { mode: useId(), amount: useId(), roll: useId() }
  const [mode, setMode] = useState<Mode>('damage')
  const [amount, setAmount] = useState('')
  const [rollId, setRollId] = useState('')
  const [multipliers, setMultipliers] = useState<Record<string, Multiplier>>({})
  // Las tiradas del registro que traen daño o curación (las de una acción), de la más nueva a la más vieja
  const rolls = useQuery({
    queryKey: ['rolls', campaignId, 'apply'],
    queryFn: () => api.call('listRolls', { campaignId }),
    enabled: mode === 'roll'
  })
  const usable = [...(rolls.data?.rolls ?? [])].filter((roll) => roll.apply).reverse()
  const value = Number(amount)
  const valid = mode === 'roll' ? Boolean(rollId) : Number.isInteger(value) && value > 0
  const apply = useMutation({
    mutationFn: async () => {
      if (mode === 'roll') {
        await api.call('applyRoll', {
          campaignId,
          rollId,
          targets: tokens.map((token) => ({
            ...(token.actor.kind === 'creature' ? { creatureId: token.actor.id } : { characterId: token.actor.id }),
            multiplier: multipliers[token.id] ?? 1
          }))
        })
        return
      }
      const change = mode === 'damage' ? { damage: value } : { heal: value }
      for (const token of tokens) {
        const { actor } = token
        if (actor.kind === 'creature')
          await api.call('playCreature', { creatureId: actor.id, version: actor.version, ...change })
        else await api.call('playCharacter', { characterId: actor.id, version: actor.version, ...change })
      }
    },
    onSuccess: () => {
      setAmount('')
      void client.invalidateQueries({ queryKey: ['creatures', campaignId] })
    }
  })
  return (
    <section className={styles.damage} aria-label={t('combat.damageTitle')}>
      <form
        className={styles.damageRow}
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) apply.mutate()
        }}
      >
        <span className={styles.stack} aria-hidden="true">
          {tokens.slice(0, 4).map((token) => (
            <span key={token.id} className={styles.avatar} data-faction={token.faction}>
              {initialOf(token.label)}
            </span>
          ))}
        </span>
        <b className={styles.count}>{title ?? t('combat.chosen', { count: tokens.length })}</b>
        <fieldset className={styles.segments}>
          <legend className={styles.hidden}>{t('combat.damageMode')}</legend>
          {(['damage', 'heal', 'roll'] as const).map((each) => (
            <label key={each} className={styles.segment}>
              <input type="radio" name={ids.mode} checked={mode === each} onChange={() => setMode(each)} />
              {t(`combat.modes.${each}`)}
            </label>
          ))}
        </fieldset>
        {mode === 'roll' ? (
          <>
            <label htmlFor={ids.roll} className={styles.hidden}>
              {t('combat.whichRoll')}
            </label>
            <select id={ids.roll} value={rollId} onChange={(event) => setRollId(event.currentTarget.value)}>
              <option value="" disabled>
                {usable.length > 0 ? t('combat.whichRoll') : t('combat.noRolls')}
              </option>
              {usable.map((roll) => (
                <option key={roll.id} value={roll.id}>
                  {`${roll.label ?? roll.formula} · ${roll.total}`}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor={ids.amount} className={styles.hidden}>
              {t('combat.amount')}
            </label>
            <input
              id={ids.amount}
              className={styles.amount}
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              placeholder="0"
              onChange={(event) => setAmount(event.currentTarget.value)}
            />
          </>
        )}
        <button type="submit" className={styles.apply} disabled={!valid || apply.isPending}>
          {t('combat.apply')}
        </button>
        <button type="button" className={styles.icon} aria-label={t('combat.closeDamage')} onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </form>
      {mode === 'roll' && (
        <ul className={styles.targets} aria-label={t('combat.targets')}>
          {tokens.map((token) => (
            <li key={token.id}>
              <span>{token.label}</span>
              <fieldset className={styles.segments}>
                <legend className={styles.hidden}>{t('combat.howMuch', { name: token.label })}</legend>
                {MULTIPLIERS.map((m) => (
                  <label key={m} className={styles.segment}>
                    <input
                      type="radio"
                      name={`${ids.mode}-${token.id}`}
                      checked={(multipliers[token.id] ?? 1) === m}
                      onChange={() => setMultipliers((current) => ({ ...current, [token.id]: m }))}
                    />
                    {t(`combat.multipliers.${WORDS[m]}`)}
                  </label>
                ))}
              </fieldset>
            </li>
          ))}
        </ul>
      )}
      <FormError message={apply.error ? errorText(apply.error) : null} />
    </section>
  )
}
