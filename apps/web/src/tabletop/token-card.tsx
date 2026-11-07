/**
 * La tarjeta de la ficha elegida (docs/specs/fichas.md, como el lienzo): quién es, su vida con dañar y curar, sus
 * datos, sus estados (los del compendio de la campaña o uno escrito, con rondas), «Abrir hoja», su tirada principal,
 * «Ocultar» y, en sus ajustes, el rótulo, el bando, el tamaño, la imagen y quitarla del mapa. Lo vital es del
 * personaje o de la criatura: se cambia con lo de su partida y le llega a la ficha por la mesa
 */
import type { TokenView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dices, Eye, EyeOff, FileText, ImageIcon, Settings2, Trash2, X } from 'lucide-react'
import { type RefObject, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { characterKey } from '../characters/save.ts'
import { FormError } from '../components/field.tsx'
import { creatureKey } from '../creatures/save.ts'
import styles from './fichas.module.css'
import { initialOf } from './tokens.ts'

const SIZES = [0.5, 1, 2, 3, 4] as const

/** Los estados del compendio de la campaña (las entradas de un tipo «estado», si su sistema lo tiene) */
export function useConditionOptions(campaignId: string) {
  const api = useApi()
  const compendium = useQuery({
    queryKey: ['compendium', campaignId, 'overview'],
    queryFn: () => api.call('getCampaignCompendium', { campaignId })
  })
  const type = compendium.data?.types.find(
    (each) => /condi|estado/i.test(each.key) || /^estados?$/i.test(each.label)
  )?.key
  const items = useQuery({
    queryKey: ['compendium', campaignId, 'conditions', type],
    queryFn: () => api.call('searchCampaignContent', { campaignId, type: type ?? '', limit: 100 }),
    enabled: Boolean(type)
  })
  return items.data?.items.map((item) => ({ key: item.key, name: item.name })) ?? []
}

export function TokenCard({
  token,
  campaignId,
  cardRef,
  onClose,
  onSheet,
  onImage
}: {
  token: TokenView
  campaignId: string
  /** El sitio de la tarjeta lo pone la mesa, junto a la ficha */
  cardRef: RefObject<HTMLElement | null>
  onClose: () => void
  onSheet: () => void
  onImage: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const ids = { amount: useId(), condition: useId(), rounds: useId(), label: useId(), faction: useId(), size: useId() }
  const titleId = useId()
  const listId = useId()
  const { actor } = token
  const [amount, setAmount] = useState('')
  const [condition, setCondition] = useState('')
  const [rounds, setRounds] = useState('')
  const [settings, setSettings] = useState(false)
  const [label, setLabel] = useState(token.label)
  const options = useConditionOptions(campaignId)

  // Lo de la partida: daño, curación y estados, a nombre del personaje o de la criatura
  type Change = {
    damage?: number
    heal?: number
    condition?: { add: { name: string; key?: string; rounds?: number } } | { remove: string }
  }
  const play = useMutation({
    mutationFn: async (change: Change) => {
      if (actor.kind === 'creature')
        await api.call('playCreature', { creatureId: actor.id, version: actor.version, ...change })
      else await api.call('playCharacter', { characterId: actor.id, version: actor.version, ...change })
    },
    onSuccess: () => {
      setAmount('')
      void client.invalidateQueries({
        queryKey: actor.kind === 'creature' ? creatureKey(actor.id) : characterKey(actor.id)
      })
      void client.invalidateQueries({ queryKey: ['creatures', campaignId] })
    }
  })
  const update = useMutation({
    mutationFn: (patch: { label?: string; faction?: TokenView['faction']; size?: number; hidden?: boolean }) =>
      api.call('updateToken', { tokenId: token.id, ...patch })
  })
  const remove = useMutation({
    mutationFn: () => api.call('removeTokens', { campaignId, tokenIds: [token.id] }),
    onSuccess: onClose
  })
  // Su tirada principal: la primera de sus acciones con ataque
  const sheet = useQuery({
    queryKey: actor.kind === 'creature' ? creatureKey(actor.id) : characterKey(actor.id),
    queryFn: async () =>
      actor.kind === 'creature'
        ? api.call('getInPlay', { creatureId: actor.id })
        : api.call('getCharacter', { characterId: actor.id })
  })
  const main = sheet.data?.state.actions.find((action) => action.attack !== null && !action.error)
  const roll = useMutation({
    mutationFn: async () => {
      if (!main) return null
      const action = { item: main.item, key: main.key, part: 'attack' as const }
      return actor.kind === 'creature'
        ? api.call('rollForCreature', { creatureId: actor.id, action })
        : api.call('rollForCharacter', { characterId: actor.id, action })
    }
  })
  const value = Number(amount)
  const valid = Number.isInteger(value) && value > 0
  const life = actor.life
  const ratio = life && life.max > 0 ? Math.max(0, Math.min(1, life.value / life.max)) : 0
  const problem = play.error ?? update.error ?? remove.error ?? roll.error
  const addCondition = () => {
    const name = condition.trim()
    if (!name) return
    const found = options.find((option) => option.name.toLowerCase() === name.toLowerCase())
    const turns = Number(rounds)
    play.mutate(
      {
        condition: {
          add: {
            name: found?.name ?? name,
            ...(found ? { key: found.key } : {}),
            ...(Number.isInteger(turns) && turns > 0 ? { rounds: turns } : {})
          }
        }
      },
      {
        onSuccess: () => {
          setCondition('')
          setRounds('')
        }
      }
    )
  }

  return (
    <section ref={cardRef} className={styles.card} aria-labelledby={titleId} data-token-card="">
      <header className={styles.cardHead}>
        <span className={styles.avatar} data-faction={token.faction} aria-hidden="true">
          {initialOf(token.label)}
        </span>
        <div className={styles.cardTitles}>
          <h3 id={titleId}>{actor.name}</h3>
          <span>
            {t(`tokens.kinds.${actor.kind}`)} · {token.label}
            {token.hidden ? ` · ${t('tokens.hidden')}` : ''}
          </span>
        </div>
        <button
          type="button"
          className={styles.icon}
          aria-label={t('tokens.close')}
          title={t('tokens.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      {life && (
        <div className={styles.life}>
          {/* La barra es solo dibujo: lo que dice, al lado, en texto */}
          <div className={styles.bar} aria-hidden="true">
            <i data-tone={ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'low' : 'bad'} style={{ inlineSize: `${ratio * 100}%` }} />
          </div>
          <span className={styles.lifeText}>
            {t('tokens.lifeValue', { value: life.value, max: life.max })}
            {life.temp > 0 ? ` +${life.temp}` : ''}
          </span>
          <form
            className={styles.damage}
            onSubmit={(event) => {
              event.preventDefault()
              if (valid) play.mutate({ damage: value })
            }}
          >
            <label htmlFor={ids.amount} className={styles.hidden}>
              {t('tokens.amount')}
            </label>
            <input
              id={ids.amount}
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              placeholder="0"
              onChange={(event) => setAmount(event.currentTarget.value)}
            />
            <button type="submit" className={styles.small} disabled={!valid || play.isPending}>
              {t('tokens.damage')}
            </button>
            <button
              type="button"
              className={styles.small}
              disabled={!valid || play.isPending}
              onClick={() => play.mutate({ heal: value })}
            >
              {t('tokens.heal')}
            </button>
          </form>
        </div>
      )}
      {actor.stats.length > 0 && (
        <dl className={styles.stats}>
          {actor.stats.map((stat) => (
            <div key={stat.key}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className={styles.conditions}>
        {actor.conditions.length > 0 && (
          <ul aria-label={t('tokens.conditions')}>
            {actor.conditions.map((each) => (
              <li key={each.id} className={styles.condition}>
                {each.name}
                {each.rounds ? <em>{t('tokens.rounds', { count: each.rounds })}</em> : null}
                <button
                  type="button"
                  aria-label={t('tokens.removeCondition', { name: each.name })}
                  title={t('tokens.removeCondition', { name: each.name })}
                  onClick={() => play.mutate({ condition: { remove: each.id } })}
                >
                  <X aria-hidden="true" size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className={styles.addCondition}
          onSubmit={(event) => {
            event.preventDefault()
            addCondition()
          }}
        >
          <label htmlFor={ids.condition} className={styles.hidden}>
            {t('tokens.newCondition')}
          </label>
          <input
            id={ids.condition}
            list={listId}
            value={condition}
            maxLength={60}
            placeholder={t('tokens.newCondition')}
            onChange={(event) => setCondition(event.currentTarget.value)}
          />
          <datalist id={listId}>
            {options.map((option) => (
              <option key={option.key} value={option.name} />
            ))}
          </datalist>
          <label htmlFor={ids.rounds} className={styles.hidden}>
            {t('tokens.roundsLabel')}
          </label>
          <input
            id={ids.rounds}
            className={styles.rounds}
            type="number"
            min={1}
            value={rounds}
            placeholder={t('tokens.roundsShort')}
            onChange={(event) => setRounds(event.currentTarget.value)}
          />
          <button type="submit" className={styles.small} disabled={!condition.trim() || play.isPending}>
            {t('tokens.addCondition')}
          </button>
        </form>
      </div>
      <div className={styles.acts}>
        <button type="button" className={styles.primary} onClick={onSheet}>
          <FileText aria-hidden="true" size={14} />
          {t('tokens.openSheet')}
        </button>
        {main && (
          <button type="button" className={styles.ghost} disabled={roll.isPending} onClick={() => roll.mutate()}>
            <Dices aria-hidden="true" size={14} />
            {main.label}
            {main.bonus !== null ? ` ${main.bonus >= 0 ? '+' : ''}${main.bonus}` : ''}
            {roll.data ? <b className={styles.total}>{roll.data.roll.total}</b> : null}
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={() => update.mutate({ hidden: !token.hidden })}>
          {token.hidden ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
          {token.hidden ? t('tokens.show') : t('tokens.hide')}
        </button>
        <button
          type="button"
          className={styles.icon}
          aria-expanded={settings}
          aria-label={t('tokens.settings')}
          title={t('tokens.settings')}
          onClick={() => setSettings(!settings)}
        >
          <Settings2 aria-hidden="true" size={16} />
        </button>
      </div>
      {settings && (
        <div className={styles.settings}>
          <div className={styles.field}>
            <label htmlFor={ids.label}>{t('tokens.label')}</label>
            <input
              id={ids.label}
              value={label}
              maxLength={16}
              onChange={(event) => setLabel(event.currentTarget.value)}
              onBlur={() => {
                if (label.trim() && label.trim() !== token.label) update.mutate({ label: label.trim() })
              }}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.faction}>{t('tokens.faction')}</label>
            <select
              id={ids.faction}
              value={token.faction}
              onChange={(event) => update.mutate({ faction: event.currentTarget.value as TokenView['faction'] })}
            >
              {(['group', 'hostile', 'neutral'] as const).map((faction) => (
                <option key={faction} value={faction}>
                  {t(`tokens.factions.${faction}`)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.size}>{t('tokens.size')}</label>
            <select
              id={ids.size}
              value={String(token.size)}
              onChange={(event) => update.mutate({ size: Number(event.currentTarget.value) })}
            >
              {[...new Set([...SIZES, token.size])].map((size) => (
                <option key={size} value={size}>
                  {t('tokens.cells', { count: size })}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.settingsActs}>
            <button type="button" className={styles.ghost} onClick={onImage}>
              <ImageIcon aria-hidden="true" size={14} />
              {t('tokens.image')}
            </button>
            <button type="button" className={styles.ghost} onClick={() => remove.mutate()}>
              <Trash2 aria-hidden="true" size={14} />
              {t('tokens.remove')}
            </button>
          </div>
        </div>
      )}
      <FormError message={problem ? errorText(problem) : null} />
    </section>
  )
}
