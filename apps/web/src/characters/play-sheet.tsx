/**
 * La hoja en partida de un personaje (docs/specs/hoja.md § pantalla) o de una criatura en juego
 * (docs/specs/criaturas.md): los bloques que compone su sistema (o los de por defecto) con sus valores calculados y lo
 * de la partida. Tirar a un clic (el servidor tira por él, a su registro), los PG con daño, curación y temporales, los
 * usos, lo que lleva, las notas y descansar
 */

import { visibilitiesFor } from '@crisol/contracts'
import {
  changeResource,
  type Play,
  type PlayItem,
  type SheetBlockView,
  setValue,
  spend,
  type Text,
  textOf,
  type ValueView
} from '@crisol/systems'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Dices, Minus, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { createContext, type ReactNode, useContext, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { useSettled } from '../components/settled.ts'
import { useDice } from '../dice/context.tsx'
import { visibilityIn } from '../dice/visibility.ts'
import {
  CARRIABLE_DRAG,
  ITEM_DRAG,
  type ItemDrag,
  MoveMenu,
  type MoveTarget,
  PartyInventory,
  partyKey,
  readItemDrag,
  useParty
} from '../party/party.tsx'
import { CONTENT_DRAG, readContentDrag } from '../tabletop/drags.ts'
import styles from './play-sheet.module.css'
import { type Change, pickId } from './save.ts'

/**
 * Varias hojas a la vez (la pantalla del máster): cada parte, un artículo en vez de una región, para no repetir las
 * mismas regiones en la página
 */
const Grouped = createContext(false)
export const SheetGroups = Grouped.Provider

/** La pestaña en la que está un bloque: si su título dice lo mismo que ella, no se repite a la vista */
const InTab = createContext<string | null>(null)
function useTitleClass(label: string | undefined) {
  const tab = useContext(InTab)
  const same = tab !== null && label !== undefined && tab.trim().toLowerCase() === label.trim().toLowerCase()
  return same ? styles.hidden : styles.blockTitle
}

function Part({
  className,
  labelledBy,
  children
}: {
  className?: string | undefined
  labelledBy: string
  children: ReactNode
}) {
  const grouped = useContext(Grouped)
  return grouped ? (
    <article className={className} aria-labelledby={labelledBy}>
      {children}
    </article>
  ) : (
    <section className={className} aria-labelledby={labelledBy}>
      {children}
    </section>
  )
}

type CharacterState = ActionOutput<'getCharacter'>['state']
/** Lo de la hoja: la de un personaje lleva además lo que le dan sus elecciones (`items`); la de una criatura, no */
type State = Pick<
  CharacterState,
  'sheet' | 'resources' | 'itemValues' | 'actions' | 'layout' | 'rolls' | 'carried' | 'playMissing'
> & { items?: CharacterState['items'] }
type DiceRoll = ActionOutput<'rollForCharacter'>['roll']
/** De quién es la hoja: su campaña y lo de la partida guardado */
export interface SheetSubject {
  campaignId: string
  play: Record<string, unknown>
  /** Un personaje (no una criatura): su inventario va junto al del grupo */
  id?: string
}
/** Lo que se tira desde la hoja: una tirada del sistema o una parte de una acción */
export interface SheetRoll {
  visibility: 'all' | 'self' | 'master' | 'hidden'
  roll?: { key: string; element?: string; mode?: string }
  action?: { item: string | null; key: string; part: 'attack' | 'damage' | 'heal'; mode?: string }
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
const get = (values: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), values)
/** Las fracciones que se escriben así (el valor de desafío: 1/8, 1/4, 1/2) */
const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }
const decimal = new Intl.NumberFormat('es', { maximumFractionDigits: 3 })

const shown = (value: unknown, signedWhen = false, fraction = false): string => {
  if (typeof value === 'number') {
    if (fraction && FRACTIONS[value]) return FRACTIONS[value]
    // Con coma decimal, como se escribe en español
    return signedWhen ? signed(value) : decimal.format(value)
  }
  if (typeof value === 'boolean') return value ? '✓' : ''
  // Una lista puede llevar textos en dos idiomas ({ es, en })
  if (Array.isArray(value))
    return value.map((item) => (item && typeof item === 'object' ? textOf(item as Text) : String(item))).join(', ')
  if (value && typeof value === 'object' && 'value' in value) return shown((value as { value: unknown }).value)
  return value === null || value === undefined ? '' : String(value)
}

interface Ctx {
  subject: SheetSubject
  state: State
  save: (change: Change) => Promise<void>
  roll: (input: {
    roll?: { key: string; element?: string }
    action?: { item: string | null; key: string; part: 'attack' | 'damage' | 'heal' }
  }) => void
}

export function PlaySheet({
  subject,
  state,
  save,
  rollWith,
  rests = true,
  defaultVisibility
}: {
  subject: SheetSubject
  state: State
  save: (change: Change) => Promise<void>
  /** Tira a su nombre (un personaje o una criatura) */
  rollWith: (input: SheetRoll) => Promise<{ roll: DiceRoll }>
  /** Con los botones de descansar */
  rests?: boolean
  /** A quién van sus tiradas de entrada, sin seguir lo elegido en los dados (las de una criatura: ocultas) */
  defaultVisibility?: SheetRoll['visibility']
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const [last, setLast] = useState<DiceRoll | null>(null)
  const [mode, setMode] = useState<string | null>(null)
  const dice = useDice()
  const campaign = useQuery({
    queryKey: ['campaign', subject.campaignId],
    queryFn: () => api.call('getCampaign', { campaignId: subject.campaignId })
  })
  const options = visibilitiesFor(campaign.data?.campaign.role ?? 'player')
  // Quién la ve: lo elegido en los dados, si vale en esta campaña; o lo suyo, si la hoja lo trae (una criatura)
  const [own, setOwn] = useState(defaultVisibility)
  const visibility =
    own && options.includes(own) ? own : visibilityIn(dice.visibility, campaign.data?.campaign.role ?? 'player')
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
      return rollWith({
        visibility,
        ...(input.roll ? { roll: { ...input.roll, ...withMode } } : {}),
        ...(input.action ? { action: { ...input.action, ...(input.action.part === 'attack' ? withMode : {}) } } : {})
      })
    },
    onSuccess: (out) => setLast(out.roll)
  })
  // Un doble clic no tira dos veces: mientras sale una, las demás esperan
  const ctx: Ctx = {
    subject,
    state,
    save,
    roll: (input) => {
      if (!rolling.isPending) rolling.mutate(input)
    }
  }
  const layout = state.layout as SheetBlockView[]
  return (
    <div className={styles.sheet}>
      <div className={styles.rollBar} data-tour="hoja-tirar">
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
            <span>{t('dice.whoRolls')}</span>
            <select
              value={visibility}
              onChange={(event) => {
                const chosen = event.currentTarget.value as typeof visibility
                if (defaultVisibility) setOwn(chosen)
                else dice.setVisibility(chosen)
              }}
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
      {rests && <Rests ctx={ctx} label={t('playSheet.rest')} />}
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
              <button type="button" className={styles.statRoll} onClick={() => ctx.roll({ roll: { key: rollKey } })}>
                {/* Su nombre lleva lo que se ve tal cual («Tirar Iniciativa +2»): así lo encuentra quien dicta (WCAG 2.5.3) */}
                <span className={styles.hidden}>{t('playSheet.rollStat', { what: f.label })} </span>
                {shown(value, f.signed)}
              </button>
            ) : f.play ? (
              <PlayValue field={f} path={f.key} value={value} ctx={ctx} />
            ) : (
              <span className={styles.statValue}>{shown(value, f.signed, f.fraction)}</span>
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
  const titleClass = useTitleClass(block.label)
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const apply = (change: { damage?: number; heal?: number; temp?: number }) => {
    if (n === 0) return
    void ctx.save({ play: (play) => changeResource(play, block.field, current.max, change) })
    setAmount('')
  }
  return (
    <Part className={styles.resource} labelledBy={`${id}-t`}>
      <h2 id={`${id}-t`} className={titleClass}>
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
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          value={amount}
          onChange={(event) => setAmount(event.currentTarget.value)}
        />
        <button type="button" className={styles.joined} onClick={() => apply({ damage: n })}>
          {t('playSheet.damage')}
        </button>
        <button type="button" className={`${styles.joined} ${styles.joinedEnd}`} onClick={() => apply({ heal: n })}>
          {t('playSheet.heal')}
        </button>
        <button type="button" className={styles.quiet} onClick={() => apply({ temp: n })}>
          {t('playSheet.setTemp')}
        </button>
      </div>
    </Part>
  )
}

function SetBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'set' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const values = (ctx.state.sheet[block.field] ?? {}) as Record<string, Record<string, unknown>>
  const rollKey = block.roll
  const titleClass = useTitleClass(block.label)
  return (
    <Part className={styles.block} labelledBy={id}>
      <h2 id={id} className={titleClass}>
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
    </Part>
  )
}

function GroupBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'group' }>; ctx: Ctx }) {
  const id = useId()
  const { t } = useTranslation()
  const values = (ctx.state.sheet[block.field] ?? {}) as Record<string, unknown>
  const titleClass = useTitleClass(block.label)
  // De los recursos de dentro (los espacios), solo los que tienen máximo
  const fields = block.fields.filter((f) => {
    const v = values[f.key] as { max?: number } | undefined
    return f.kind !== 'resource' || (typeof v?.max === 'number' && v.max > 0)
  })
  if (fields.length === 0) return null
  return (
    <Part className={styles.block} labelledBy={id}>
      <h2 id={id} className={titleClass}>
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
    </Part>
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
  // Lo que se cambia jugando de un personaje (su inventario) va junto a lo del grupo: «Lo mío» y «Del grupo»
  const characterId = ctx.subject.id
  const api = useApi()
  const errorText = useErrorText()
  const party = useQuery({
    queryKey: partyKey(ctx.subject.campaignId),
    queryFn: () => api.call('getParty', { campaignId: ctx.subject.campaignId }),
    enabled: Boolean(characterId) && block.play
  })
  // Solo el inventario del grupo (no los estados, que también se cambian jugando)
  const partyTypes = party.data?.types ?? []
  const withParty =
    Boolean(characterId) && block.play && partyTypes.length > 0 && block.types.every((x) => partyTypes.includes(x))
  // Arrastrar entre «Lo mío» y «Del grupo» (en el móvil, con «Mover»)
  const { move } = useParty(ctx.subject.campaignId, Boolean(characterId) && block.play)
  const [dropping, setDropping] = useState(false)
  const titleClass = useTitleClass(block.label)
  // La papelera pide un segundo toque para quitar (un toque desviado no borra): cuál está pidiéndolo
  const [removing, setRemoving] = useState<string | null>(null)
  const granted = (ctx.state.items ?? []).filter((it) => block.types.includes(it.type) && it.from !== null)
  // Lo que lleva, tal como se acaba de guardar (equipar se ve al momento); su nombre y su tipo, del estado
  const known = new Map(ctx.state.carried.map((it) => [it.id, it]))
  const carried = ((ctx.subject.play as Play).items ?? [])
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
  const row = (itemId: string, name: string, extra?: React.ReactNode, drag?: ItemDrag) => {
    const values = ctx.state.itemValues[itemId] ?? {}
    return (
      <li
        key={itemId}
        className={styles.item}
        draggable={Boolean(drag)}
        onDragStart={
          drag
            ? (event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData(ITEM_DRAG, JSON.stringify(drag))
              }
            : undefined
        }
      >
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
    <Part className={styles.block} labelledBy={id}>
      <div className={styles.blockHead}>
        <h2 id={id} className={titleClass}>
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
          campaignId={ctx.subject.campaignId}
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
      {withParty && <h3 className={styles.partHead}>{t('party.mine')}</h3>}
      {
        // biome-ignore lint/a11y/noStaticElementInteractions: soltar lo del grupo aquí; con teclado, su «Mover»
        <ul
          className={styles.items}
          data-over={dropping || undefined}
          onDragOver={(event) => {
            // Lo del grupo que puede llevar (lo suyo ya está aquí; lo escrito a mano se queda en el grupo) o un objeto
            // del compendio de la Mesa
            const types = event.dataTransfer.types
            if (!block.play || !(types.includes(CONTENT_DRAG) || (withParty && types.includes(CARRIABLE_DRAG)))) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropping(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
          }}
          onDrop={(event) => {
            setDropping(false)
            // Un objeto del compendio: a lo que lleva (si es de los que van en este inventario)
            const content = readContentDrag(event.dataTransfer)
            if (content) {
              event.preventDefault()
              if (content.actor || !block.types.includes(content.type)) return
              const itemId = pickId()
              void ctx.save({
                play: (play) => ({
                  ...play,
                  items: [...(play.items ?? []), { id: itemId, key: content.key, quantity: 1 }]
                })
              })
              return
            }
            const from = readItemDrag(event.dataTransfer)
            if (!from || !('party' in from) || !characterId) return
            event.preventDefault()
            move.mutate({ from, to: { character: characterId }, quantity: 1 })
          }}
        >
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
                {withParty && characterId && (
                  <CarriedMove
                    campaignId={ctx.subject.campaignId}
                    characterId={characterId}
                    item={{ id: it.id, name: it.name, quantity: it.quantity ?? 1 }}
                  />
                )}
                <button
                  type="button"
                  className={`${styles.icon} ${styles.remove}`}
                  data-armed={removing === it.id || undefined}
                  aria-label={
                    removing === it.id
                      ? t('playSheet.removeSure', { what: it.name })
                      : t('playSheet.remove', { what: it.name })
                  }
                  onClick={() => {
                    if (removing !== it.id) return setRemoving(it.id)
                    setRemoving(null)
                    update(it.id, () => null)
                  }}
                  onBlur={() => setRemoving((current) => (current === it.id ? null : current))}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && removing === it.id) {
                      event.preventDefault()
                      setRemoving(null)
                    }
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {removing === it.id && <span aria-hidden="true">{t('playSheet.removeShort')}</span>}
                </button>
              </span>,
              withParty && characterId ? { character: characterId, item: it.id } : undefined
            )
          )}
          {granted.length === 0 && carried.length === 0 && <li className={styles.none}>{t('playSheet.nothing')}</li>}
        </ul>
      }
      {move.error && (
        <p className={styles.moveError} role="alert">
          {errorText(move.error)}
        </p>
      )}
      {/* «Del grupo», debajo de lo suyo (como en D&D Beyond): lo de todos, con sus monedas y quién lo puso */}
      {withParty && (
        <>
          <h3 className={styles.partHead}>{t('party.theirs')}</h3>
          <PartyInventory campaignId={ctx.subject.campaignId} me={characterId} />
        </>
      )}
    </Part>
  )
}

/** «Mover» lo que lleva un personaje: al grupo (a uno de sus contenedores) o a otro personaje con el que se pueda */
function CarriedMove({
  campaignId,
  characterId,
  item
}: {
  campaignId: string
  characterId: string
  item: { id: string; name: string; quantity: number }
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { loaded, move } = useParty(campaignId)
  if (!loaded.data) return null
  const targets: MoveTarget[] = [
    ...loaded.data.party.containers.map((c) => ({
      key: `g:${c.id}`,
      label: c.id === 'grupo' ? t('party.toParty') : t('party.toContainer', { name: c.name }),
      to: { container: c.id }
    })),
    ...loaded.data.characters
      .filter((c) => c.id !== characterId)
      .map((c) => ({ key: `c:${c.id}`, label: t('party.toCharacter', { name: c.name }), to: { character: c.id } }))
  ]
  return (
    <>
      <MoveMenu
        name={item.name}
        max={item.quantity}
        targets={targets}
        busy={move.isPending}
        onMove={(to, quantity) => move.mutate({ from: { character: characterId, item: item.id }, to, quantity })}
      />
      {move.error && <span className={styles.moveError}>{errorText(move.error)}</span>}
    </>
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
  const wanted = useSettled(query.trim())
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
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
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
  const titleClass = useTitleClass(block.label ?? t('playSheet.actions'))
  if (actions.length === 0) return null
  return (
    <Part className={styles.block} labelledBy={id}>
      <h2 id={id} className={titleClass}>
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
    </Part>
  )
}

function UsesBlock({ block, ctx }: { block: Extract<SheetBlockView, { kind: 'uses' }>; ctx: Ctx }) {
  const { t } = useTranslation()
  const id = useId()
  const uses = ctx.state.resources.filter((r) => !r.error && r.max > 0)
  // De quién es cada uno (Tomar aliento, la Furia): lo que da, o lo que lleva
  const owners = new Map([
    ...(ctx.state.items ?? []).map((it) => [it.id, it.name] as const),
    ...ctx.state.carried.map((it) => [`p:${it.id}`, it.name] as const)
  ])
  const titleClass = useTitleClass(block.label ?? t('playSheet.uses'))
  if (uses.length === 0) return null
  return (
    <Part className={styles.block} labelledBy={id}>
      <h2 id={id} className={titleClass}>
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
    </Part>
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
  const titleClass = useTitleClass(block.label)
  if (!block.play)
    return (
      <Part className={styles.text} labelledBy={id}>
        <h2 id={id} className={titleClass}>
          {block.label}
        </h2>
        <p className={styles.prose}>{value}</p>
      </Part>
    )
  return (
    <div className={styles.text}>
      <label htmlFor={id} className={titleClass}>
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
  const stored = get((ctx.subject.play as Play).values ?? {}, path)
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
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
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
        <InTab.Provider value={tab?.label ?? null}>
          {tab?.blocks.map((inner, i) => (
            <Block key={`${shownTab}-${inner.kind}-${i.toString(36)}`} block={inner} ctx={ctx} />
          ))}
        </InTab.Provider>
      </div>
    </div>
  )
}

/** Descansar: el corto recupera lo de los descansos cortos; el largo, todo y los PG. Discretos, sin borde */
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
