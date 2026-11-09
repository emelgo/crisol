/**
 * El inventario del grupo de una campaña (docs/specs/grupo.md): lo que es de todos, por contenedores, con sus monedas.
 * Lo ven y lo cambian todos los de la campaña; «Mover» pasa algo a un personaje (el suyo; el máster, cualquiera) o a
 * otro contenedor sin duplicarlo. Va en «Grupo», en la barra de la campaña, y en el inventario de cada hoja
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionInput, ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { characterKey } from '../characters/save.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { useDismiss } from '../components/dismiss.ts'
import { Field, FormError } from '../components/field.tsx'
import formStyles from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { useSettled } from '../components/settled.ts'
import { summaryOf } from '../summaries.ts'
import styles from './party.module.css'

type Loaded = ActionOutput<'getParty'>
type CharacterLoaded = ActionOutput<'getCharacter'>
type Changed = ActionOutput<'moveItem'>['characters'][number]
type Item = Loaded['party']['items'][number]
export const partyKey = (campaignId: string) => ['party', campaignId] as const

/** Lo que se arrastra entre «Lo mío» (en la hoja) y «Del grupo»: de dónde sale. Se pasa de uno en uno (para más, «Mover») */
export const ITEM_DRAG = 'application/x-crisol-objeto'
/** Además, lo del grupo que puede llevar un personaje (lo del compendio; lo escrito a mano se queda en el grupo) */
export const CARRIABLE_DRAG = 'application/x-crisol-objeto-llevable'
export type ItemDrag = { party: string } | { character: string; item: string }

export function readItemDrag(data: DataTransfer): ItemDrag | null {
  try {
    const raw = data.getData(ITEM_DRAG)
    return raw ? (JSON.parse(raw) as ItemDrag) : null
  } catch {
    return null
  }
}

/** Un sitio al que mover: un personaje o un contenedor del grupo */
export interface MoveTarget {
  key: string
  label: string
  hint?: string
  to: { character: string } | { container: string }
}

/** El grupo de una campaña y lo que se hace con él: lo que sale de cada cambio pone al día también los personajes */
export function useParty(campaignId: string, enabled = true) {
  const api = useApi()
  const client = useQueryClient()
  const loaded = useQuery({
    queryKey: partyKey(campaignId),
    queryFn: () => api.call('getParty', { campaignId }),
    enabled
  })
  const done = async (out: { party: Loaded['party']; characters?: Changed[] }) => {
    client.setQueryData<Loaded>(partyKey(campaignId), (old) => (old ? { ...old, party: out.party } : old))
    // Los personajes que cambiaron, al momento (su versión nueva: la hoja sigue guardando sin chocar)
    for (const changed of out.characters ?? [])
      client.setQueryData<CharacterLoaded>(characterKey(changed.id), (old) =>
        old ? { ...old, character: { ...old.character, version: changed.version, play: changed.play } } : old
      )
    // Y lo demás (los movimientos, las monedas de cada uno, lo calculado de su hoja), de nuevo, a la vez
    await Promise.all([
      client.invalidateQueries({ queryKey: partyKey(campaignId) }),
      ...(out.characters ?? []).map((c) => client.invalidateQueries({ queryKey: characterKey(c.id) })),
      ...(out.characters?.length ? [client.invalidateQueries({ queryKey: ['characters', campaignId] })] : [])
    ])
  }
  const update = useMutation({
    mutationFn: (change: Omit<ActionInput<'updateParty'>, 'campaignId' | 'version'>) =>
      api.call('updateParty', { campaignId, version: loaded.data?.party.version ?? 0, ...change }),
    onSuccess: (out) => done(out),
    // Otro lo cambió mientras tanto: se vuelve a leer
    onError: () => client.invalidateQueries({ queryKey: partyKey(campaignId) })
  })
  const move = useMutation({
    mutationFn: (input: Omit<ActionInput<'moveItem'>, 'campaignId'>) => api.call('moveItem', { campaignId, ...input }),
    onSuccess: (out) => done(out)
  })
  const coins = useMutation({
    mutationFn: (input: Omit<ActionInput<'moveCoins'>, 'campaignId'>) =>
      api.call('moveCoins', { campaignId, ...input }),
    onSuccess: (out) => done(out)
  })
  const split = useMutation({
    mutationFn: (input: Omit<ActionInput<'splitCoins'>, 'campaignId'>) =>
      api.call('splitCoins', { campaignId, ...input }),
    onSuccess: (out) => done(out)
  })
  return { loaded, update, move, coins, split }
}

/** Las monedas en una línea: «148 po · 35 pp» (las que hay) */
export function coinLine(coins: Record<string, number>, kinds: Loaded['coins']): string {
  return kinds
    .filter((k) => (coins[k.key] ?? 0) > 0)
    .map((k) => `${coins[k.key]} ${k.key}`)
    .join(' · ')
}

export function PartyInventory({ campaignId, me }: { campaignId: string; me?: string | undefined }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { loaded, update, move, coins, split } = useParty(campaignId)
  // El contenedor sobre el que se arrastra algo (de la hoja o de otro contenedor)
  const [over, setOver] = useState<string | null>(null)
  const [dialog, setDialog] = useState<
    { kind: 'add' } | { kind: 'coins' } | { kind: 'container'; id?: string; name?: string } | null
  >(null)
  if (!loaded.data)
    return failed(loaded) ? <LoadError error={loaded.error} onRetry={() => loaded.refetch()} /> : <Loading />
  const { party, characters } = loaded.data
  const busy = update.isPending || move.isPending
  const containerName = (c: { id: string; name: string }) => c.name || t('party.common')
  const error = [update, move, coins, split].find((m) => m.error)?.error
  const targetsFor = (item: Item): MoveTarget[] => [
    ...(item.key
      ? characters.map((c) => ({
          key: `c:${c.id}`,
          label: t('party.toCharacter', { name: c.name }),
          ...(c.id === me ? { hint: t('party.you') } : {}),
          to: { character: c.id }
        }))
      : []),
    ...party.containers
      .filter((c) => c.id !== item.container)
      .map((c) => ({
        key: `g:${c.id}`,
        label: t('party.toContainer', { name: containerName(c) }),
        to: { container: c.id }
      }))
  ]
  return (
    <div className={styles.party}>
      <div className={styles.coinsBar}>
        <h3 className={styles.small}>{t('party.coins')}</h3>
        {loaded.data.coins.length === 0 ? (
          <p className={styles.muted}>{t('party.noCoins')}</p>
        ) : (
          <>
            <ul className={styles.coins}>
              {loaded.data.coins.map((k) => (
                <li key={k.key} title={k.label}>
                  <strong>{party.coins[k.key] ?? 0}</strong> <span className={styles.coinKey}>{k.key}</span>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.link} onClick={() => setDialog({ kind: 'coins' })}>
              <Coins size={14} aria-hidden="true" />
              {t('party.manageCoins')}
            </button>
          </>
        )}
      </div>
      <div className={styles.tools}>
        <button type="button" className={styles.tool} disabled={busy} onClick={() => setDialog({ kind: 'add' })}>
          <Plus size={15} aria-hidden="true" />
          {t('party.add')}
        </button>
        <button type="button" className={styles.toolQuiet} onClick={() => setDialog({ kind: 'container' })}>
          {t('party.newContainer')}
        </button>
      </div>
      <FormError message={error ? errorText(error) : null} />
      {party.items.length === 0 && <p className={styles.muted}>{t('party.emptyAll')}</p>}
      {party.containers.map((container) => {
        const items = party.items.filter((i) => i.container === container.id)
        if (items.length === 0 && container.id === 'grupo' && party.items.length === 0) return null
        const name = containerName(container)
        return (
          <section
            key={container.id}
            className={styles.container}
            aria-label={name}
            data-over={over === container.id || undefined}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(ITEM_DRAG)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setOver(container.id)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
            }}
            onDrop={(event) => {
              setOver(null)
              const from = readItemDrag(event.dataTransfer)
              if (!from) return
              event.preventDefault()
              if ('party' in from && party.items.find((i) => i.id === from.party)?.container === container.id) return
              move.mutate({ from, to: { container: container.id }, quantity: 1 })
            }}
          >
            <div className={styles.containerHead}>
              <h3 id={`grupo-${container.id}`} className={styles.small} tabIndex={-1}>
                {name}
              </h3>
              <span className={styles.count}>{items.length}</span>
              <button
                type="button"
                className={styles.icon}
                aria-label={t('party.renameContainer', { name })}
                disabled={busy}
                onClick={() => setDialog({ kind: 'container', id: container.id, name: container.name })}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              {container.id !== 'grupo' && (
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={t('party.removeContainer', { name })}
                  disabled={busy}
                  onClick={() => update.mutate({ removeContainer: { id: container.id } })}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className={styles.muted}>{t('party.empty')}</p>
            ) : (
              <ul className={styles.items}>
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={styles.item}
                    draggable={!busy}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData(ITEM_DRAG, JSON.stringify({ party: item.id }))
                      if (item.key) event.dataTransfer.setData(CARRIABLE_DRAG, '1')
                    }}
                  >
                    <span className={styles.itemName}>
                      {item.name}
                      {item.note && <span className={styles.note}>{item.note}</span>}
                    </span>
                    {item.addedBy && (
                      <span className={styles.addedBy}>
                        <span className={styles.hidden}>{t('party.addedBy')}: </span>
                        {item.addedBy}
                      </span>
                    )}
                    <span className={styles.quantity}>
                      <span className={styles.hidden}>{t('party.quantity')}: </span>×{item.quantity}
                    </span>
                    <MoveMenu
                      name={item.name}
                      max={item.quantity}
                      targets={targetsFor(item)}
                      busy={busy}
                      fallback={`grupo-${container.id}`}
                      onMove={(to, quantity) => move.mutate({ from: { party: item.id }, to, quantity })}
                    />
                    <button
                      type="button"
                      className={styles.icon}
                      aria-label={t('party.remove', { name: item.name })}
                      disabled={busy}
                      onClick={() => update.mutate({ remove: { item: item.id } })}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {dialog?.kind === 'add' && (
        <AddDialog
          campaignId={campaignId}
          loaded={loaded.data}
          busy={update.isPending}
          error={update.error ? errorText(update.error) : null}
          onAdd={(add) => update.mutateAsync({ add }).then(() => setDialog(null))}
          onClose={() => {
            setDialog(null)
            update.reset()
          }}
        />
      )}
      {dialog?.kind === 'container' && (
        <ContainerDialog
          name={dialog.name ?? ''}
          busy={update.isPending}
          error={update.error ? errorText(update.error) : null}
          onSave={(name) =>
            update
              .mutateAsync(dialog.id ? { renameContainer: { id: dialog.id, name } } : { addContainer: { name } })
              .then(() => setDialog(null))
          }
          onClose={() => {
            setDialog(null)
            update.reset()
          }}
        />
      )}
      {dialog?.kind === 'coins' && (
        <CoinsDialog
          loaded={loaded.data}
          me={me}
          busy={coins.isPending || split.isPending}
          error={coins.error ? errorText(coins.error) : split.error ? errorText(split.error) : null}
          onMove={(input) => coins.mutateAsync(input).then(() => setDialog(null))}
          onSplit={(input) => split.mutateAsync(input).then(() => setDialog(null))}
          onClose={() => {
            setDialog(null)
            coins.reset()
            split.reset()
          }}
        />
      )}
    </div>
  )
}

/** «Mover»: a dónde (y cuántas, si hay más de una), en un desplegable que flota */
export function MoveMenu({
  name,
  max,
  targets,
  busy,
  fallback,
  onMove
}: {
  name: string
  max: number
  targets: MoveTarget[]
  busy: boolean
  /** Dónde va el foco si, tras mover, la fila ya no está (se movió todo) */
  fallback?: string
  onMove: (to: MoveTarget['to'], quantity: number) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(max)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useDismiss(open, () => setOpen(false), root, trigger)
  // Salir con el tabulador lo cierra
  useEffect(() => {
    const node = root.current
    if (!open || !node) return
    const leave = (event: FocusEvent) => {
      if (!node.contains(event.relatedTarget as Node | null)) setOpen(false)
    }
    node.addEventListener('focusout', leave)
    return () => node.removeEventListener('focusout', leave)
  }, [open])
  if (targets.length === 0) return null
  const quantity = Math.min(max, Math.max(1, Math.floor(count) || 1))
  return (
    <div className={styles.moveRoot} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={styles.move}
        aria-expanded={open}
        aria-controls={id}
        aria-label={t('party.moveWhat', { name })}
        onClick={() => {
          setCount(max)
          setOpen(!open)
        }}
      >
        {t('party.move')}
      </button>
      {open && (
        <fieldset id={id} className={styles.menu}>
          <legend className={styles.hidden}>{t('party.moveWhat', { name })}</legend>
          {max > 1 && (
            <label className={styles.howMany}>
              {t('party.howMany')}
              <input
                type="number"
                min={1}
                max={max}
                value={Number.isNaN(count) ? '' : count}
                onChange={(event) => setCount(event.currentTarget.valueAsNumber)}
              />
            </label>
          )}
          {targets.map((target) => (
            <button
              key={target.key}
              type="button"
              className={styles.target}
              disabled={busy}
              onClick={() => {
                setOpen(false)
                onMove(target.to, quantity)
                trigger.current?.focus()
                // Si se movió todo, la fila se va: el foco, a su contenedor
                window.setTimeout(() => {
                  if (!trigger.current?.isConnected && fallback) document.getElementById(fallback)?.focus()
                }, 600)
              }}
            >
              {target.label}
              {target.hint && <span className={styles.hint}>{target.hint}</span>}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  )
}

/** Lo último que se ha movido o cambiado en el grupo, con quién lo hizo */
export function PartyMoves({ campaignId }: { campaignId: string }) {
  const { t, i18n } = useTranslation()
  const { loaded } = useParty(campaignId)
  if (!loaded.data) return null
  const { moves } = loaded.data
  return moves.length === 0 ? (
    <p className={styles.muted}>{t('party.noMoves')}</p>
  ) : (
    <ul className={styles.moves}>
      {moves.map((m) => (
        <li key={m.id}>
          {t('party.by', {
            who: m.ai ? t('party.ai') : (m.by ?? t('party.someone')),
            what: summaryOf(t, { action: m.action, details: m.details })
          })}
          <time className={styles.when} dateTime={m.at}>
            {new Date(m.at).toLocaleString(i18n.language, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </time>
        </li>
      ))}
    </ul>
  )
}

function DialogShell({
  title,
  children,
  onClose,
  onSubmit
}: {
  title: string
  children: ReactNode
  onClose: () => void
  onSubmit: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </form>
    </Modal>
  )
}

/** Añadir al grupo: algo del compendio (buscándolo) o escrito a mano, con su cantidad y su contenedor */
function AddDialog({
  campaignId,
  loaded,
  busy,
  error,
  onAdd,
  onClose
}: {
  campaignId: string
  loaded: Loaded
  busy: boolean
  error: string | null
  onAdd: (add: NonNullable<ActionInput<'updateParty'>['add']>) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const searchId = useId()
  const containerId = useId()
  const [byHand, setByHand] = useState(false)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<{ key: string; name: string } | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [container, setContainer] = useState('grupo')
  const wanted = useSettled(query.trim())
  const types = loaded.types
  const found = useQuery({
    queryKey: ['compendium', campaignId, 'party', types.join(','), wanted],
    enabled: !byHand,
    queryFn: async () => {
      const kinds = types.length > 0 ? types : [undefined]
      const results = await Promise.all(
        kinds.map((type) =>
          api.call('searchCampaignContent', {
            campaignId,
            ...(type ? { type } : {}),
            ...(wanted ? { query: wanted } : {}),
            limit: 10
          })
        )
      )
      return results.flatMap((r) => r.items).slice(0, 12)
    }
  })
  const ready = byHand ? name.trim().length > 0 : picked !== null
  return (
    <DialogShell
      title={t('party.addTitle')}
      onClose={onClose}
      onSubmit={() => {
        if (!ready) return
        void onAdd({
          ...(byHand ? { name: name.trim() } : { key: picked?.key }),
          ...(note.trim() ? { note: note.trim() } : {}),
          quantity: Math.max(1, Math.floor(quantity) || 1),
          container
        }).catch(() => undefined)
      }}
    >
      <fieldset className={styles.choice}>
        <legend className={styles.hidden}>{t('party.addTitle')}</legend>
        <label>
          <input type="radio" name="party-add" checked={!byHand} onChange={() => setByHand(false)} />
          {t('party.fromCompendium')}
        </label>
        <label>
          <input type="radio" name="party-add" checked={byHand} onChange={() => setByHand(true)} />
          {t('party.byHand')}
        </label>
      </fieldset>
      {byHand ? (
        <Field
          label={t('party.name')}
          value={name}
          maxLength={200}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          data-autofocus=""
          onChange={(event) => setName(event.currentTarget.value)}
        />
      ) : (
        <div className={formStyles.field}>
          <label htmlFor={searchId}>{t('party.search')}</label>
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            data-autofocus=""
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {found.data?.length === 0 && <p className={styles.muted}>{t('party.noResults')}</p>}
          <ul className={styles.results}>
            {found.data?.map((hit) => (
              <li key={hit.key}>
                <button
                  type="button"
                  aria-pressed={picked?.key === hit.key}
                  onClick={() => setPicked({ key: hit.key, name: hit.name })}
                >
                  {hit.name}
                  {hit.edition && <span className={styles.hint}>{hit.edition}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field
        label={t('party.note')}
        value={note}
        maxLength={500}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        onChange={(event) => setNote(event.currentTarget.value)}
      />
      <div className={styles.pair}>
        <Field
          label={t('party.quantity')}
          type="number"
          min={1}
          max={100_000}
          value={Number.isNaN(quantity) ? '' : quantity}
          onChange={(event) => setQuantity(event.currentTarget.valueAsNumber)}
        />
        <div className={formStyles.field}>
          <label htmlFor={containerId}>{t('party.container')}</label>
          <select id={containerId} value={container} onChange={(event) => setContainer(event.currentTarget.value)}>
            {loaded.party.containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || t('party.common')}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormError message={error} />
      <div className={dialogStyles.actions}>
        <BusyButton type="submit" className={formStyles.button} busy={busy} disabled={!ready}>
          {t('party.add')}
        </BusyButton>
        <button type="button" className={dialogStyles.cancel} onClick={onClose}>
          {t('party.cancel')}
        </button>
      </div>
    </DialogShell>
  )
}

/** Crear o renombrar un contenedor */
function ContainerDialog({
  name: initial,
  busy,
  error,
  onSave,
  onClose
}: {
  name: string
  busy: boolean
  error: string | null
  onSave: (name: string) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial)
  return (
    <DialogShell
      title={initial ? t('party.renameContainer', { name: initial }) : t('party.newContainer')}
      onClose={onClose}
      onSubmit={() => {
        if (name.trim()) void onSave(name.trim()).catch(() => undefined)
      }}
    >
      <Field
        label={t('party.containerName')}
        value={name}
        required
        maxLength={100}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        data-autofocus=""
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <FormError message={error} />
      <div className={dialogStyles.actions}>
        <BusyButton type="submit" className={formStyles.button} busy={busy}>
          {t('party.save')}
        </BusyButton>
        <button type="button" className={dialogStyles.cancel} onClick={onClose}>
          {t('party.cancel')}
        </button>
      </div>
    </DialogShell>
  )
}

/** Las monedas: pasarlas entre el grupo y un personaje y, el máster, repartirlas a partes iguales */
function CoinsDialog({
  loaded,
  me,
  busy,
  error,
  onMove,
  onSplit,
  onClose
}: {
  loaded: Loaded
  me: string | undefined
  busy: boolean
  error: string | null
  onMove: (input: Omit<ActionInput<'moveCoins'>, 'campaignId'>) => Promise<unknown>
  onSplit: (input: Omit<ActionInput<'splitCoins'>, 'campaignId'>) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const characterId = useId()
  const { characters, coins: kinds, party, master } = loaded
  const [character, setCharacter] = useState(me ?? characters[0]?.id ?? '')
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [among, setAmong] = useState<string[]>(characters.map((c) => c.id))
  const chosen = characters.find((c) => c.id === character)
  const given = Object.fromEntries(Object.entries(amounts).filter(([, n]) => Number.isInteger(n) && n > 0)) as Record<
    string,
    number
  >
  const any = Object.keys(given).length > 0
  return (
    <DialogShell title={t('party.coinsTitle')} onClose={onClose} onSubmit={() => undefined}>
      <p className={styles.muted}>
        {t('party.coins')}: {coinLine(party.coins, kinds) || '0'}
      </p>
      {characters.length === 0 ? (
        <p className={styles.muted}>{t('party.noCharacters')}</p>
      ) : (
        <>
          <div className={formStyles.field}>
            <label htmlFor={characterId}>{t('party.character')}</label>
            <select id={characterId} value={character} onChange={(event) => setCharacter(event.currentTarget.value)}>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {coinLine(c.coins, kinds) ? ` · ${coinLine(c.coins, kinds)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.coinInputs}>
            {kinds.map((k) => (
              <Field
                key={k.key}
                label={k.label}
                type="number"
                min={0}
                value={amounts[k.key] ?? ''}
                onChange={(event) => {
                  const n = event.currentTarget.valueAsNumber
                  setAmounts((all) => ({ ...all, [k.key]: Number.isNaN(n) ? 0 : n }))
                }}
              />
            ))}
          </div>
          <div className={dialogStyles.actions}>
            <BusyButton
              type="button"
              className={formStyles.button}
              busy={busy}
              disabled={!any || !chosen}
              onClick={() => void onMove({ character, toParty: false, coins: given }).catch(() => undefined)}
            >
              {t('party.give')}
            </BusyButton>
            <BusyButton
              type="button"
              className={styles.secondary}
              busy={busy}
              disabled={!any || !chosen}
              onClick={() => void onMove({ character, toParty: true, coins: given }).catch(() => undefined)}
            >
              {t('party.leave')}
            </BusyButton>
          </div>
          {master && (
            <fieldset className={styles.split}>
              <legend>{t('party.split')}</legend>
              {characters.map((c) => (
                <label key={c.id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={among.includes(c.id)}
                    onChange={(event) => {
                      const on = event.currentTarget.checked
                      setAmong((all) => (on ? [...all, c.id] : all.filter((x) => x !== c.id)))
                    }}
                  />
                  {c.name}
                </label>
              ))}
              <p className={styles.muted}>{t('party.splitLeft')}</p>
              <BusyButton
                type="button"
                className={styles.secondary}
                busy={busy}
                disabled={among.length === 0}
                onClick={() => void onSplit({ characters: among }).catch(() => undefined)}
              >
                {t('party.splitDo')}
              </BusyButton>
            </fieldset>
          )}
        </>
      )}
      <FormError message={error} />
    </DialogShell>
  )
}
