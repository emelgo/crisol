/**
 * La hoja de un personaje en partida (docs/specs/hoja.md § pantalla): los bloques que compone su sistema (o los de
 * por defecto) con sus valores calculados y lo de la partida. Tirar a un clic (el servidor tira por él, a su
 * registro), los PG con daño, curación y temporales, los usos, lo que lleva, las notas y descansar
 */

import { visibilitiesFor } from '@crisol/contracts'
import {
  changeResource,
  type Play,
  type PlayItem,
  type SheetBlockView,
  setValue,
  spend,
  type ValueView
} from '@crisol/systems'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Dices, Minus, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { useDeferredValue, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { useDice } from '../dice/context.tsx'
import styles from './play-sheet.module.css'
import { type Change, pickId } from './save.ts'

type Loaded = ActionOutput<'getCharacter'>
type Character = Loaded['character']
type State = Loaded['state']
type DiceRoll = ActionOutput<'rollForCharacter'>['roll']

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
const get = (values: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), values)
const shown = (value: unknown, signedWhen = false): string => {
  if (typeof value === 'number') return signedWhen ? signed(value) : String(value)
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object' && 'value' in value) return shown((value as { value: unknown }).value)
  return value === null || value === undefined ? '' : String(value)
}

interface Ctx {
  character: Character
  state: State
  save: (change: Change) => Promise<void>
  roll: (input: {
    roll?: { key: string; element?: string }
    action?: { item: string | null; key: string; part: 'attack' | 'damage' | 'heal' }
  }) => void
}

export function PlaySheet({
  character,
  state,
  save
}: {
  character: Character
  state: State
  save: (change: Change) => Promise<void>
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const [last, setLast] = useState<DiceRoll | null>(null)
  const [mode, setMode] = useState<string | null>(null)
  const dice = useDice()
  const campaign = useQuery({
    queryKey: ['campaign', character.campaignId],
    queryFn: () => api.call('getCampaign', { campaignId: character.campaignId })
  })
  const options = visibilitiesFor(campaign.data?.campaign.role ?? 'player')
  // Quién la ve: lo elegido en los dados, si vale en esta campaña
  const visibility = options.includes(dice.visibility) ? dice.visibility : 'all'
  // Los modos (ventaja, desventaja) de sus tiradas
  const modes = [...new Map(state.rolls.flatMap((r) => r.modes).map((m) => [m.key, m.label] as const)).entries()].map(
    ([key, label]) => ({ key, label })
  )
  const rolling = useMutation({
    mutationFn: (input: Parameters<Ctx['roll']>[0]) => {
      const fits = input.roll
        ? state.rolls.find((r) => r.key === input.roll?.key)?.modes.some((m) => m.key === mode)
        : true
      const withMode = mode && fits ? { mode } : {}
      return api.call('rollForCharacter', {
        characterId: character.id,
        visibility,
        ...(input.roll ? { roll: { ...input.roll, ...withMode } } : {}),
        ...(input.action ? { action: { ...input.action, ...(input.action.part === 'attack' ? withMode : {}) } } : {})
      })
    },
    onSuccess: (out) => setLast(out.roll)
  })
  // Un doble clic no tira dos veces: mientras sale una, las demás esperan
  const ctx: Ctx = {
    character,
    state,
    save,
    roll: (input) => {
      if (!rolling.isPending) rolling.mutate(input)
    }
  }
  const layout = state.layout as SheetBlockView[]
  return (
    <div className={styles.sheet}>
      <div className={styles.rollBar}>
        {modes.length > 0 && (
          <fieldset className={styles.modes}>
            <legend className={styles.hidden}>{t('playSheet.rollWith')}</legend>
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                className={styles.mode}
                aria-pressed={mode === m.key}
                onClick={() => setMode(mode === m.key ? null : m.key)}
              >
                {m.label}
              </button>
            ))}
          </fieldset>
        )}
        {options.length > 1 && (
          <label className={styles.who}>
            <span>{t('dice.who')}</span>
            <select
              value={visibility}
              onChange={(event) => dice.setVisibility(event.currentTarget.value as typeof visibility)}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {t(`dice.visibility.${option}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {last && (
        <p className={styles.last} role="status">
          <Dices size={16} aria-hidden="true" />
          <span>{last.label}</span>
          <strong className={styles.total}>{last.total}</strong>
          <span className={styles.detail}>{last.detail}</span>
        </p>
      )}
      <FormError message={rolling.error ? errorText(rolling.error) : null} />
      {layout.map((block, i) => (
        <Block key={`${block.kind}-${i.toString(36)}`} block={block} ctx={ctx} />
      ))}
      <Rests ctx={ctx} label={t('playSheet.rest')} />
    </div>
  )
}

function Block({ block, ctx }: { block: SheetBlockView; ctx: Ctx }) {
  switch (block.kind) {
    case 'header':
      return null
    case 'stats':
      return <Stats block={block} ctx={ctx} />
    case 'resource':
      return <ResourceBlock block={block} ctx={ctx} />
    case 'set':
      return <SetBlock block={block} ctx={ctx} />
    case 'group':
      return <GroupBlock block={block} ctx={ctx} />
    case 'list':
      return <ListBlock block={block} ctx={ctx} />
    case 'items':
      return <ItemsBlock block={block} ctx={ctx} />
    case 'actions':
      return <ActionsBlock block={block} ctx={ctx} />
    case 'uses':
      return <UsesBlock block={block} ctx={ctx} />
    case 'text':
      return <TextBlock block={block} ctx={ctx} />
    case 'columns':
      return (
        <div className={styles.columns}>
          {block.blocks.map((inner, i) => (
            <Block key={`${inner.kind}-${i.toString(36)}`} block={inner} ctx={ctx} />
          ))}
        </div>
      )
    case 'tabs':
      return <Tabs block={block} ctx={ctx} />
  }
}

function Stats({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'stats' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  return (
    <ul className={styles.stats} aria-label={block.label ?? t('playSheet.values')}>
      {block.fields.map((f) => {
        const value = ctx.state.sheet[f.key]
        const rollKey = f.roll
        return (
          <li key={f.key} className={styles.stat}>
            <span className={styles.statLabel}>{f.label}</span>
            {rollKey ? (
              <button
                type="button"
                className={styles.statRoll}
                aria-label={t('playSheet.rollOf', { what: f.label, value: shown(value, true) })}
                onClick={() => ctx.roll({ roll: { key: rollKey } })}
              >
                {shown(value, f.signed)}
              </button>
            ) : f.play ? (
              <PlayValue field={f} path={f.key} value={value} ctx={ctx} />
            ) : (
              <span className={styles.statValue}>{shown(value, f.signed)}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ResourceBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'resource' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const [amount, setAmount] = useState('')
  const raw = (ctx.state.sheet[block.field] ?? {}) as { value?: number; max?: number; temp?: number }
  const current = { value: raw.value ?? raw.max ?? 0, max: raw.max ?? 0, temp: raw.temp ?? 0 }
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const apply = (change: { damage?: number; heal?: number; temp?: number }) => {
    if (n === 0) return
    void ctx.save({ play: (play) => changeResource(play, block.field, current.max, change) })
    setAmount('')
  }
  return (
    <section className={styles.resource} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className={styles.blockTitle}>
        {block.label}
      </h2>
      <p className={styles.resourceValue}>
        <strong>{current.value}</strong> / {current.max}
        {current.temp > 0 && <span className={styles.temp}>{t('playSheet.temp', { temp: current.temp })}</span>}
      </p>
      <div className={styles.resourceControls}>
        <label htmlFor={id} className={styles.hidden}>
          {t('playSheet.amount')}
        </label>
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.currentTarget.value)}
        />
        <button type="button" onClick={() => apply({ damage: n })}>
          {t('playSheet.damage')}
        </button>
        <button type="button" onClick={() => apply({ heal: n })}>
          {t('playSheet.heal')}
        </button>
        <button type="button" onClick={() => apply({ temp: n })}>
          {t('playSheet.setTemp')}
        </button>
      </div>
    </section>
  )
}

function SetBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'set' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const values = (ctx.state.sheet[block.field] ?? {}) as Record<string, Record<string, unknown>>
  const rollKey = block.roll
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h2 id={id} className={styles.blockTitle}>
        {block.label}
      </h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.hidden}>{block.label}</span>
            </th>
            {block.columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.elements.map((e) => (
            <tr key={e.key}>
              <th scope="row">
                {rollKey ? (
                  <button
                    type="button"
                    className={styles.rowRoll}
                    onClick={() => ctx.roll({ roll: { key: rollKey, element: e.key } })}
                    aria-label={t('playSheet.rollFor', { what: e.label })}
                  >
                    {e.label}
                  </button>
                ) : (
                  e.label
                )}
              </th>
              {block.columns.map((c) => {
                return <td key={c.key}>{shown(values[e.key]?.[c.key], c.signed)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function GroupBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'group' }>; ctx: Ctx }) {
  const id = useId()
  const { t } = useTranslation()
  const values = (ctx.state.sheet[block.field] ?? {}) as Record<string, unknown>
  // De los recursos de dentro (los espacios), solo los que tienen máximo
  const fields = block.fields.filter((f) => {
    const v = values[f.key] as { max?: number } | undefined
    return f.kind !== 'resource' || (typeof v?.max === 'number' && v.max > 0)
  })
  if (fields.length === 0) return null
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h2 id={id} className={styles.blockTitle}>
        {block.label}
      </h2>
      <ul className={styles.group}>
        {fields.map((f) => {
          const v = values[f.key]
          if (f.kind === 'resource') {
            const r = v as { value?: number; max?: number }
            const current = { value: r.value ?? r.max ?? 0, max: r.max ?? 0, temp: 0 }
            const path = `${block.field}.${f.key}`
            return (
              <li key={f.key} className={styles.groupResource}>
                <span>{f.label}</span>
                <Stepper
                  label={f.label}
                  value={`${current.value} / ${current.max}`}
                  onLess={
                    current.value > 0
                      ? () => void ctx.save({ play: (p) => changeResource(p, path, current.max, { damage: 1 }) })
                      : undefined
                  }
                  onMore={
                    current.value < current.max
                      ? () => void ctx.save({ play: (p) => changeResource(p, path, current.max, { heal: 1 }) })
                      : undefined
                  }
                />
              </li>
            )
          }
          return (
            <li key={f.key}>
              <span className={styles.statLabel}>{f.label}</span>{' '}
              {f.play ? (
                <PlayValue field={f} path={`${block.field}.${f.key}`} value={v} ctx={ctx} />
              ) : (
                shown(v, f.signed) || t('playSheet.none')
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Stepper({
  label,
  value,
  onLess,
  onMore
}: {
  label: string
  value: string
  onLess: (() => void) | undefined
  onMore: (() => void) | undefined
}) {
  const { t } = useTranslation()
  return (
    <span className={styles.stepper}>
      <button type="button" aria-label={t('playSheet.less', { what: label })} disabled={!onLess} onClick={onLess}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <output>{value}</output>
      <button type="button" aria-label={t('playSheet.more', { what: label })} disabled={!onMore} onClick={onMore}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </span>
  )
}

function ListBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'list' }>; ctx: Ctx }) {
  const items = block.fields.filter(
    (f) => Array.isArray(ctx.state.sheet[f.key]) && (ctx.state.sheet[f.key] as unknown[]).length > 0
  )
  if (items.length === 0) return null
  return (
    <dl className={styles.list}>
      {items.map((f) => (
        <div key={f.key}>
          <dt>{f.label}</dt>
          <dd>{shown(ctx.state.sheet[f.key])}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Lo que lleva de un campo de objetos: lo concedido (sin tocar) y lo del inventario (equipar, cantidad, quitar) */
function ItemsBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'items' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const [adding, setAdding] = useState(false)
  const granted = ctx.state.items.filter((it) => block.types.includes(it.type) && it.from !== null)
  // Lo que lleva, tal como se acaba de guardar (equipar se ve al momento); su nombre y su tipo, del estado
  const known = new Map(ctx.state.carried.map((it) => [it.id, it]))
  const carried = ((ctx.character.play as Play).items ?? [])
    .map((it) => ({ ...it, name: known.get(it.id)?.name ?? it.key, type: known.get(it.id)?.type ?? null }))
    .filter((it) => it.type !== null && block.types.includes(it.type))
  const update = (itemId: string, change: (it: PlayItem) => PlayItem | null) =>
    void ctx.save({
      play: (play) => ({
        ...play,
        items: (play.items ?? []).flatMap((it) => {
          if (it.id !== itemId) return [it]
          const next = change(it)
          return next ? [next] : []
        })
      })
    })
  const row = (itemId: string, name: string, extra?: React.ReactNode) => {
    const values = ctx.state.itemValues[itemId] ?? {}
    return (
      <li key={itemId} className={styles.item}>
        <span className={styles.itemName}>{name}</span>
        {block.columns.map((c) => (
          <span key={c.key} className={styles.itemValue}>
            <span className={styles.hidden}>{c.label}: </span>
            {shown(values[c.key], c.signed)}
          </span>
        ))}
        {block.rolls.map((r) => (
          <button
            key={r}
            type="button"
            className={styles.smallRoll}
            onClick={() => ctx.roll({ roll: { key: r, element: itemId } })}
            aria-label={t('playSheet.rollItem', {
              what: name,
              roll: ctx.state.rolls.find((x) => x.key === r)?.label ?? r
            })}
          >
            <Dices size={14} aria-hidden="true" />
            {ctx.state.rolls.find((x) => x.key === r)?.label ?? r}
          </button>
        ))}
        {extra}
      </li>
    )
  }
  return (
    <section className={styles.block} aria-labelledby={id}>
      <div className={styles.blockHead}>
        <h2 id={id} className={styles.blockTitle}>
          {block.label}
        </h2>
        {block.play && (
          <button type="button" className={styles.add} onClick={() => setAdding(!adding)} aria-expanded={adding}>
            <Plus size={14} aria-hidden="true" />
            {t('playSheet.add')}
          </button>
        )}
      </div>
      {adding && block.play && (
        <AddFromCompendium
          campaignId={ctx.character.campaignId}
          types={block.types}
          onAdd={(key) => {
            setAdding(false)
            // El id, fuera: el cambio se aplica otra vez sobre lo guardado y tiene que dar lo mismo
            const itemId = pickId()
            void ctx.save({
              play: (play) => ({ ...play, items: [...(play.items ?? []), { id: itemId, key, quantity: 1 }] })
            })
          }}
        />
      )}
      <ul className={styles.items}>
        {granted.map((it) => row(it.id, it.name))}
        {carried.map((it) =>
          row(
            `p:${it.id}`,
            it.name,
            <span className={styles.itemControls}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={it.equipped === true}
                  onChange={(event) => {
                    const equipped = event.currentTarget.checked
                    update(it.id, (x) => ({ ...x, equipped }))
                  }}
                />
                {t('playSheet.equipped')}
              </label>
              <Stepper
                label={it.name}
                value={String(it.quantity ?? 1)}
                onLess={
                  (it.quantity ?? 1) > 1
                    ? () => update(it.id, (x) => ({ ...x, quantity: (x.quantity ?? 1) - 1 }))
                    : undefined
                }
                onMore={() => update(it.id, (x) => ({ ...x, quantity: (x.quantity ?? 1) + 1 }))}
              />
              <button
                type="button"
                className={styles.icon}
                aria-label={t('playSheet.remove', { what: it.name })}
                onClick={() => update(it.id, () => null)}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </span>
          )
        )}
        {granted.length === 0 && carried.length === 0 && <li className={styles.none}>{t('playSheet.nothing')}</li>}
      </ul>
    </section>
  )
}

/** Añadir del compendio de la campaña: buscar por su nombre, de los tipos del bloque */
function AddFromCompendium({
  campaignId,
  types,
  onAdd
}: {
  campaignId: string
  types: string[]
  onAdd: (key: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const [query, setQuery] = useState('')
  // Se busca lo escrito cuando se deja de escribir, no con cada tecla
  const wanted = useDeferredValue(query.trim())
  const found = useQuery({
    queryKey: ['compendium', campaignId, 'add', types.join(','), wanted],
    queryFn: async () => {
      const results = await Promise.all(
        types.map((type) =>
          api.call('searchCampaignContent', { campaignId, type, ...(wanted ? { query: wanted } : {}), limit: 10 })
        )
      )
      return results.flatMap((r) => r.items).slice(0, 12)
    }
  })
  return (
    <div className={styles.addBox}>
      <label htmlFor={id}>{t('playSheet.search')}</label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      {found.data?.length === 0 && <p className={styles.none}>{t('playSheet.noResults')}</p>}
      <ul className={styles.addList}>
        {found.data?.map((hit) => (
          <li key={hit.key}>
            <button type="button" onClick={() => onAdd(hit.key)}>
              {hit.name}
              {hit.edition && <span className={styles.edition}>{hit.edition}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActionsBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'actions' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const actions = ctx.state.actions.filter((a) => !a.error)
  if (actions.length === 0) return null
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h2 id={id} className={styles.blockTitle}>
        {block.label ?? t('playSheet.actions')}
      </h2>
      <ul className={styles.items}>
        {actions.map((a) => (
          <li key={`${a.item}-${a.key}`} className={styles.item}>
            <span className={styles.itemName}>{a.label}</span>
            {a.bonus !== null && (
              <button
                type="button"
                className={styles.smallRoll}
                onClick={() => ctx.roll({ action: { item: a.item, key: a.key, part: 'attack' } })}
                aria-label={t('playSheet.attackOf', { what: a.label, bonus: signed(a.bonus) })}
              >
                {signed(a.bonus)}
              </button>
            )}
            {a.save && (
              <span className={styles.itemValue}>
                {t('playSheet.saveDc', { ability: a.save.abilityLabel, dc: a.save.dc })}
              </span>
            )}
            {a.damage.length > 0 && (
              <button
                type="button"
                className={styles.smallRoll}
                onClick={() => ctx.roll({ action: { item: a.item, key: a.key, part: 'damage' } })}
                aria-label={t('playSheet.damageOf', { what: a.label })}
              >
                {a.damage.map((d) => d.formula).join(' + ')}
              </button>
            )}
            {a.heal && (
              <button
                type="button"
                className={styles.smallRoll}
                onClick={() => ctx.roll({ action: { item: a.item, key: a.key, part: 'heal' } })}
                aria-label={t('playSheet.healOf', { what: a.label })}
              >
                {a.heal}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function UsesBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'uses' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const uses = ctx.state.resources.filter((r) => !r.error && r.max > 0)
  // De quién es cada uno (Tomar aliento, la Furia): lo que da, o lo que lleva
  const owners = new Map([
    ...ctx.state.items.map((it) => [it.id, it.name] as const),
    ...ctx.state.carried.map((it) => [`p:${it.id}`, it.name] as const)
  ])
  if (uses.length === 0) return null
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h2 id={id} className={styles.blockTitle}>
        {block.label ?? t('playSheet.uses')}
      </h2>
      <ul className={styles.items}>
        {uses.map((r) => {
          const owner = r.item ? owners.get(r.item) : undefined
          return (
            <li key={`${r.item}-${r.key}`} className={styles.item}>
              <span className={styles.itemName}>
                {owner ?? r.label}
                {owner && <span className={styles.useLabel}> · {r.label}</span>}
              </span>
              {r.recovery && (
                <span className={styles.itemValue}>{t(`playSheet.recovery.${r.recovery}`, r.recovery)}</span>
              )}
              <Stepper
                label={owner ? `${owner} · ${r.label}` : r.label}
                value={t('playSheet.left', { left: r.left, max: r.max })}
                onLess={r.left > 0 ? () => void ctx.save({ play: (p) => spend(p, r, 1) }) : undefined}
                onMore={r.used > 0 ? () => void ctx.save({ play: (p) => spend(p, r, -1) }) : undefined}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Un valor que sigue al de fuera mientras no se escribe en él (si llega otro, se pone el nuevo) */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (source !== value) {
    setSource(value)
    setDraft(value)
  }
  return [draft, setDraft] as const
}

function TextBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'text' }>; ctx: Ctx }) {
  const id = useId()
  const value = shown(get(ctx.state.sheet, block.field))
  const [text, setText] = useDraft(value)
  if (!block.play)
    return (
      <section className={styles.text} aria-labelledby={id}>
        <h2 id={id} className={styles.blockTitle}>
          {block.label}
        </h2>
        <p className={styles.prose}>{value}</p>
      </section>
    )
  return (
    <div className={styles.text}>
      <label htmlFor={id} className={styles.blockTitle}>
        {block.label}
      </label>
      <textarea
        id={id}
        rows={8}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onBlur={() => {
          if (text !== value) void ctx.save({ play: (play) => setValue(play, block.field, text) })
        }}
      />
    </div>
  )
}

/** Un valor que se cambia jugando: un sí o no se marca; un número o un texto se escribe (se guarda al salir) */
function PlayValue({
  field,
  path,
  value: computed,
  ctx
}: {
  field: ValueView
  path: string
  value: unknown
  ctx: Ctx
}) {
  // Lo recién cambiado se ve ya (lo de la partida, antes de que responda el servidor); si no, lo calculado
  const stored = get((ctx.character.play as Play).values ?? {}, path)
  const value = stored !== undefined ? stored : computed
  const [draft, setDraft] = useDraft(value === undefined || value === null ? '' : String(value))
  if (field.kind === 'boolean')
    return (
      <input
        type="checkbox"
        className={styles.toggle}
        aria-label={field.label}
        checked={value === true}
        onChange={(event) => {
          const checked = event.currentTarget.checked
          void ctx.save({ play: (play) => setValue(play, path, checked) })
        }}
      />
    )
  const number = field.kind === 'number'
  const commit = () => {
    if (draft === (value === undefined || value === null ? '' : String(value))) return
    if (!number) {
      void ctx.save({ play: (play) => setValue(play, path, draft) })
      return
    }
    const n = Number(draft)
    const fits =
      draft.trim() !== '' &&
      Number.isFinite(n) &&
      (field.min === undefined || n >= field.min) &&
      (field.max === undefined || n <= field.max)
    if (fits) void ctx.save({ play: (play) => setValue(play, path, n) })
    else setDraft(value === undefined || value === null ? '' : String(value))
  }
  return (
    <input
      type={number ? 'number' : 'text'}
      className={styles.playValue}
      aria-label={field.label}
      inputMode={number ? 'numeric' : undefined}
      autoComplete="off"
      min={field.min}
      max={field.max}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}

function Tabs({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'tabs' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const [shownTab, setShownTab] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const tab = block.tabs[shownTab] ?? block.tabs[0]
  return (
    <div className={styles.tabs}>
      <div role="tablist" className={styles.tabList} aria-label={t('playSheet.sections')}>
        {block.tabs.map((each, i) => (
          <button
            key={each.label}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === shownTab}
            aria-controls={`${id}-panel`}
            tabIndex={i === shownTab ? 0 : -1}
            className={styles.tab}
            onClick={() => setShownTab(i)}
            ref={(node) => {
              tabs.current[i] = node
            }}
            onKeyDown={(event) => {
              const n = block.tabs.length
              const next =
                event.key === 'ArrowRight'
                  ? (shownTab + 1) % n
                  : event.key === 'ArrowLeft'
                    ? (shownTab - 1 + n) % n
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? n - 1
                        : null
              if (next === null) return
              event.preventDefault()
              setShownTab(next)
              tabs.current[next]?.focus()
            }}
          >
            {each.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${shownTab}`} className={styles.panel}>
        {tab?.blocks.map((inner, i) => (
          <Block key={`${shownTab}-${inner.kind}-${i.toString(36)}`} block={inner} ctx={ctx} />
        ))}
      </div>
    </div>
  )
}

/** Descansar: el corto recupera lo de los descansos cortos; el largo, todo y los PG */
function Rests({ ctx, label }: { ctx: Ctx; label: string }) {
  const { t } = useTranslation()
  const restNow = (kind: 'short' | 'long') => void ctx.save({ rest: kind })
  return (
    <fieldset className={styles.rests}>
      <legend className={styles.hidden}>{label}</legend>
      <button type="button" onClick={() => restNow('short')}>
        <Sun size={15} aria-hidden="true" />
        {t('playSheet.shortRest')}
      </button>
      <button type="button" onClick={() => restNow('long')}>
        <Moon size={15} aria-hidden="true" />
        {t('playSheet.longRest')}
      </button>
    </fieldset>
  )
}
