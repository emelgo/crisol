/**
 * Aplicar el daño (o la curación) de una tirada a quien lo recibe (docs/specs/criaturas.md § aplicar): las criaturas
 * en juego y los personajes de la campaña, cada uno con nada, mitad, entero o doble. El servidor tiene en cuenta sus
 * resistencias, inmunidades y vulnerabilidades
 */
import type { DiceRoll } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import formStyles from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import styles from './apply.module.css'

const MULTIPLIERS = [0, 0.5, 1, 2] as const
const WORDS = { 0: 'inPlay.apply.x0', 0.5: 'inPlay.apply.x05', 1: 'inPlay.apply.x1', 2: 'inPlay.apply.x2' } as const
type Multiplier = (typeof MULTIPLIERS)[number]

export function ApplyRoll({ roll, onClose }: { roll: DiceRoll; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const creatures = useQuery({
    queryKey: ['creatures', roll.campaignId],
    queryFn: () => api.call('listInPlay', { campaignId: roll.campaignId })
  })
  const characters = useQuery({
    queryKey: ['characters', roll.campaignId],
    queryFn: () => api.call('listCharacters', { campaignId: roll.campaignId })
  })
  // A quién y con qué multiplicador: de entrada, nadie y entero
  const [chosen, setChosen] = useState<Record<string, Multiplier>>({})
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const targets = [
    ...(creatures.data?.creatures ?? []).map((c) => ({
      id: c.id,
      kind: 'creature' as const,
      name: c.name,
      life: c.life ? `${c.life.value} / ${c.life.max}` : null
    })),
    ...(characters.data?.characters ?? []).map((c) => ({
      id: c.id,
      kind: 'character' as const,
      name: c.name,
      life: null
    }))
  ]
  const apply = useMutation({
    mutationFn: () =>
      api.call('applyRoll', {
        campaignId: roll.campaignId,
        rollId: roll.id,
        targets: targets
          .filter((each) => picked.has(each.id))
          .map((each) => ({
            ...(each.kind === 'creature' ? { creatureId: each.id } : { characterId: each.id }),
            multiplier: chosen[each.id] ?? 1
          }))
      }),
    onSuccess: async (out) => {
      announce(out.applied.map((a) => `${a.name}: ${a.amount}`).join(', '))
      await Promise.all([
        client.invalidateQueries({ queryKey: ['creatures', roll.campaignId] }),
        client.invalidateQueries({ queryKey: ['creature'] }),
        client.invalidateQueries({ queryKey: ['characters', roll.campaignId] }),
        client.invalidateQueries({ queryKey: ['character'] })
      ])
      dialog.current?.close()
    }
  })
  const toggle = (id: string) =>
    setPicked((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const heal = roll.apply?.kind === 'heal'
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.dialog}`}
      onClose={onClose}
    >
      <div className={dialogStyles.body}>
        <h2 id={titleId}>
          {heal ? t('inPlay.apply.healTitle', { total: roll.total }) : t('inPlay.apply.title', { total: roll.total })}
        </h2>
        <p className={dialogStyles.description}>{roll.label}</p>
        {targets.length === 0 ? (
          <p className={styles.none}>{t('inPlay.apply.none')}</p>
        ) : (
          <ul className={styles.targets}>
            {targets.map((each) => (
              <li key={each.id} className={styles.target}>
                <label className={styles.who}>
                  <input type="checkbox" checked={picked.has(each.id)} onChange={() => toggle(each.id)} />
                  <span>
                    {each.name}
                    {each.life && <span className={styles.life}> {each.life}</span>}
                  </span>
                </label>
                <fieldset className={styles.multipliers} disabled={!picked.has(each.id)}>
                  <legend className={styles.hidden}>{t('inPlay.apply.how', { name: each.name })}</legend>
                  {MULTIPLIERS.map((m) => (
                    <label key={m} className={styles.multiplier}>
                      <input
                        type="radio"
                        name={`${titleId}-${each.id}`}
                        checked={(chosen[each.id] ?? 1) === m}
                        onChange={() => setChosen((was) => ({ ...was, [each.id]: m }))}
                      />
                      <span>{t(WORDS[m])}</span>
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ul>
        )}
        <FormError message={apply.error ? errorText(apply.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton
            className={formStyles.button}
            busy={apply.isPending}
            disabled={picked.size === 0}
            onClick={() => apply.mutate()}
          >
            {t('inPlay.apply.go', { count: picked.size })}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('compendium.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
