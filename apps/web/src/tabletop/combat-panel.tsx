/**
 * El combate en la mesa (docs/specs/combate.md, el tablero Combate del lienzo): la ronda, «Anterior» y «Siguiente
 * turno», tirar la iniciativa (de todos, de las criaturas o de las que faltan), escribirla, el orden (los empates se
 * arrastran), juntar o separar grupos, sacar a alguien, saltar a los derrotados y acabar (con la lista de las copias
 * que se van). Los turnos los lleva el servidor: aquí se piden y se ven
 */
import type { CombatantView, CombatView, TokenView, TurnStarted } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Dices, EyeOff, Flag, GripVertical, Link2, Unlink, X } from 'lucide-react'
import { type DragEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import dialogStyles from '../components/dialog.module.css'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { Modal } from '../components/modal.tsx'
import styles from './combat.module.css'
import { cssDisc } from './draw.ts'
import { initialOf } from './tokens.ts'

/** Lo que dice el aviso de un turno que empieza: de quién es, qué caducó, qué se recargó y qué se repuso */
export function startedText(t: (key: string, values?: Record<string, unknown>) => string, started: TurnStarted) {
  const list = (items: string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(items)
  return [
    t('combat.turnOf', { name: list(started.names) }),
    ...started.expired.map((e) => t('combat.expired', { condition: e.condition, name: e.name })),
    ...started.recharged.map((r) => t('combat.recharged', { action: r.action, name: r.name })),
    ...started.restored.map((r) => t('combat.restored', { resource: r.resource, name: r.name }))
  ].join(' ')
}

/** El orden nuevo al soltar uno encima de otro: se pone delante de él */
export function reorder(ids: readonly string[], moved: string, before: string): string[] {
  if (moved === before) return [...ids]
  const rest = ids.filter((id) => id !== moved)
  const at = rest.indexOf(before)
  return at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)]
}

export function CombatPanel({
  campaignId,
  combat,
  tokens,
  selected,
  onPick
}: {
  campaignId: string
  combat: CombatView
  tokens: TokenView[]
  /** Las fichas elegidas en el mapa */
  selected: string[]
  /** Elegir a alguien de la lista: su ficha, y la mesa se centra en ella */
  onPick: (tokenId: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const refresh = () => client.invalidateQueries({ queryKey: ['creatures', campaignId] })
  const act = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh
  })
  const turn = useMutation({
    mutationFn: (step: 'next' | 'previous') =>
      step === 'next'
        ? api.call('nextTurn', { campaignId })
        : api.call('previousTurn', { campaignId }).then(() => null),
    onSuccess: (out) => {
      if (out?.started) setNotice(startedText(t as never, out.started))
      void refresh()
    }
  })
  // El aviso se va solo al rato
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 7000)
    return () => window.clearTimeout(timer)
  }, [notice])
  const roll = useMutation({
    mutationFn: (who: 'all' | 'creatures' | 'unrolled') => api.call('rollInitiative', { campaignId, who }),
    onSuccess: (out) => {
      if (out.failed.length > 0) setNotice(out.failed.map((f) => `${f.name}: ${f.reason}`).join(' '))
    }
  })
  const ids = combat.combatants.map((c) => c.id)
  const chosenIn = combat.combatants.filter((c) => c.tokenId && selected.includes(c.tokenId))
  const outside = tokens.filter(
    (token) => selected.includes(token.id) && !combat.combatants.some((c) => c.tokenId === token.id)
  )
  const problem = act.error ?? turn.error ?? roll.error
  const drop = (event: DragEvent, before: string) => {
    event.preventDefault()
    const moved = dragging ?? event.dataTransfer.getData('text/plain')
    setDragging(null)
    if (!moved || moved === before) return
    act.mutate(() => api.call('orderCombatants', { campaignId, combatantIds: reorder(ids, moved, before) }))
  }
  return (
    <aside className={styles.panel} aria-label={t('combat.title')}>
      {/* El título es el de la pestaña: aquí, la ronda */}
      <header className={styles.head}>
        <span className={styles.round}>
          {combat.round === 0 ? t('combat.notStarted') : t('combat.round', { round: combat.round })}
        </span>
      </header>
      <div className={styles.controls} data-tour="combate-turno">
        <button
          type="button"
          className={styles.icon}
          aria-label={t('combat.previous')}
          title={t('combat.previous')}
          disabled={turn.isPending || combat.round === 0}
          onClick={() => turn.mutate('previous')}
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className={styles.next}
          disabled={turn.isPending || combat.combatants.length === 0}
          onClick={() => turn.mutate('next')}
        >
          {combat.round === 0 ? t('combat.first') : t('combat.next')}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        <RollMenu disabled={roll.isPending} onRoll={(who) => roll.mutate(who)} />
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <ol className={styles.list} aria-label={t('combat.order')}>
        {combat.combatants.map((combatant, index) => (
          <CombatantRow
            key={combatant.id}
            combatant={combatant}
            grouped={
              Boolean(combatant.group) && combat.combatants.filter((c) => c.group === combatant.group).length > 1
            }
            selected={Boolean(combatant.tokenId && selected.includes(combatant.tokenId))}
            dragging={dragging === combatant.id}
            onDragStart={(event) => {
              setDragging(combatant.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', combatant.id)
            }}
            onDrop={(event) => drop(event, combatant.id)}
            onPick={() => combatant.tokenId && onPick(combatant.tokenId)}
            onInitiative={(initiative) =>
              act.mutate(() =>
                api.call('setInitiative', { campaignId, values: [{ combatantId: combatant.id, initiative }] })
              )
            }
            onUngroup={() =>
              act.mutate(() =>
                api.call('groupCombatants', { campaignId, combatantIds: [combatant.id], together: false })
              )
            }
            onRemove={() =>
              act.mutate(() => api.call('removeCombatants', { campaignId, combatantIds: [combatant.id] }))
            }
            onMove={(step) => {
              const other = ids[index + step]
              if (!other) return
              const order = step < 0 ? reorder(ids, combatant.id, other) : reorder(ids, other, combatant.id)
              act.mutate(() => api.call('orderCombatants', { campaignId, combatantIds: order }))
            }}
          />
        ))}
      </ol>
      {(chosenIn.length > 1 || outside.length > 0) && (
        <div className={styles.chosen}>
          {chosenIn.length > 1 && (
            <button
              type="button"
              className={styles.ghost}
              onClick={() =>
                act.mutate(() =>
                  api.call('groupCombatants', {
                    campaignId,
                    combatantIds: chosenIn.map((c) => c.id),
                    together: true
                  })
                )
              }
            >
              <Link2 aria-hidden="true" size={14} />
              {t('combat.group', { count: chosenIn.length })}
            </button>
          )}
          {outside.length > 0 && (
            <button
              type="button"
              className={styles.ghost}
              onClick={() =>
                act.mutate(() => api.call('addCombatants', { campaignId, tokenIds: outside.map((t) => t.id) }))
              }
            >
              {t('combat.add', { count: outside.length })}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={combat.skipDefeated}
        onClick={() => act.mutate(() => api.call('updateCombat', { campaignId, skipDefeated: !combat.skipDefeated }))}
      >
        {t('combat.skipDefeated')}
        <span className={styles.toggle} aria-hidden="true" />
      </button>
      <FormError message={problem ? errorText(problem) : null} />
      <button type="button" className={styles.end} onClick={() => setEnding(true)}>
        <Flag aria-hidden="true" size={15} />
        {t('combat.end')}
      </button>
      {ending && <EndCombat campaignId={campaignId} combat={combat} onClose={() => setEnding(false)} />}
    </aside>
  )
}

/** El dado de la iniciativa: de todos, de las criaturas o de los que aún no la tienen */
function RollMenu({
  disabled,
  onRoll
}: {
  disabled: boolean
  onRoll: (who: 'all' | 'creatures' | 'unrolled') => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  useDismiss(open, () => setOpen(false), root, trigger)
  return (
    <div ref={root} className={styles.menuRoot}>
      <button
        ref={trigger}
        type="button"
        className={styles.icon}
        aria-label={t('combat.roll')}
        title={t('combat.roll')}
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Dices aria-hidden="true" size={18} />
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          {(['all', 'creatures', 'unrolled'] as const).map((who) => (
            <button
              key={who}
              type="button"
              onClick={() => {
                setOpen(false)
                onRoll(who)
              }}
            >
              {t(`combat.rollWho.${who}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CombatantRow({
  combatant,
  grouped,
  selected,
  dragging,
  onDragStart,
  onDrop,
  onPick,
  onInitiative,
  onUngroup,
  onRemove,
  onMove
}: {
  combatant: CombatantView
  grouped: boolean
  selected: boolean
  dragging: boolean
  onDragStart: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
  onPick: () => void
  onInitiative: (value: number | null) => void
  onUngroup: () => void
  onRemove: () => void
  onMove: (step: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(combatant.initiative === null ? '' : String(combatant.initiative))
  useEffect(() => setValue(combatant.initiative === null ? '' : String(combatant.initiative)), [combatant.initiative])
  const life = combatant.life
  const ratio = life && life.max > 0 ? Math.max(0, Math.min(1, life.value / life.max)) : null
  const save = () => {
    const next = value.trim() === '' ? null : Number(value)
    if (next !== null && !Number.isFinite(next)) return setValue(String(combatant.initiative ?? ''))
    if (next !== combatant.initiative) onInitiative(next)
  }
  return (
    <li
      className={styles.row}
      data-active={combatant.active || undefined}
      data-defeated={combatant.defeated || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      aria-current={combatant.active ? 'step' : undefined}
    >
      <span className={styles.grip} aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <input
        className={styles.initiative}
        inputMode="numeric"
        value={value}
        aria-label={t('combat.initiativeOf', { name: combatant.name })}
        placeholder="–"
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save()
          // Alt y las flechas lo mueven en el orden (los empates)
          if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault()
            onMove(event.key === 'ArrowUp' ? -1 : 1)
          }
        }}
      />
      <button type="button" className={styles.who} onClick={onPick} disabled={!combatant.tokenId}>
        <span
          className={styles.avatar}
          data-kind={combatant.kind}
          style={{ background: cssDisc(combatant.name, combatant.kind === 'character' ? 'group' : 'hostile') }}
          aria-hidden="true"
        >
          {initialOf(combatant.name)}
        </span>
        <span className={styles.name}>
          <b>
            {combatant.name}
            {combatant.hidden && <EyeOff aria-label={t('tokens.hidden')} size={12} />}
            {grouped && <Link2 aria-label={t('combat.grouped')} size={12} />}
          </b>
          {ratio !== null && (
            <span className={styles.bar} aria-hidden="true">
              <i
                data-tone={ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'low' : 'bad'}
                style={{ inlineSize: `${ratio * 100}%` }}
              />
            </span>
          )}
          {combatant.conditions.length > 0 && (
            <span className={styles.conditions}>
              {combatant.conditions.map((c) => (
                <em key={c.id}>
                  {c.name}
                  {c.rounds ? ` · ${t('tokens.rounds', { count: c.rounds })}` : ''}
                </em>
              ))}
            </span>
          )}
        </span>
        {life && <span className={styles.life}>{t('combat.life', { value: life.value, max: life.max })}</span>}
      </button>
      <span className={styles.rowActs}>
        {grouped && (
          <button
            type="button"
            className={styles.icon}
            aria-label={t('combat.ungroup', { name: combatant.name })}
            title={t('combat.ungroup', { name: combatant.name })}
            onClick={onUngroup}
          >
            <Unlink aria-hidden="true" size={13} />
          </button>
        )}
        <button
          type="button"
          className={styles.icon}
          aria-label={t('combat.remove', { name: combatant.name })}
          title={t('combat.remove', { name: combatant.name })}
          onClick={onRemove}
        >
          <X aria-hidden="true" size={13} />
        </button>
      </span>
    </li>
  )
}

/** «Acabar combate»: confirma y dice qué copias se van (las de 0 PG, todas o ninguna) */
function EndCombat({ campaignId, combat, onClose }: { campaignId: string; combat: CombatView; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const titleId = useId()
  const name = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [remove, setRemove] = useState<'defeated' | 'generic' | 'none'>('defeated')
  const leaving = combat.combatants.filter(
    (c) => c.generic && (remove === 'generic' || (remove === 'defeated' && c.defeated))
  )
  const staying = combat.combatants.filter((c) => c.kind === 'creature' && !leaving.includes(c))
  const end = useMutation({
    mutationFn: () => api.call('endCombat', { campaignId, remove }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['creatures', campaignId] })
      dialog.current?.close()
    }
  })
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.dialog}`}
      onClose={onClose}
    >
      <div className={styles.dialogBody}>
        <h2 id={titleId}>{t('combat.endTitle')}</h2>
        <fieldset className={styles.modes}>
          <legend>{t('combat.removeWhich')}</legend>
          {(['defeated', 'generic', 'none'] as const).map((mode) => (
            <label key={mode}>
              <input type="radio" name={name} checked={remove === mode} onChange={() => setRemove(mode)} />
              {t(`combat.removeModes.${mode}`)}
            </label>
          ))}
        </fieldset>
        <p className={styles.leaving}>
          {leaving.length === 0
            ? t('combat.nobodyLeaves')
            : t('combat.leaving', {
                list: new Intl.ListFormat('es', { type: 'conjunction' }).format(leaving.map((c) => c.name))
              })}
        </p>
        {staying.length > 0 && (
          <p className={styles.staying}>
            {t('combat.staying', {
              list: new Intl.ListFormat('es', { type: 'conjunction' }).format(staying.map((c) => c.name))
            })}
          </p>
        )}
        <FormError message={end.error ? errorText(end.error) : null} />
        <div className={styles.dialogActs}>
          <button type="button" className={styles.danger} disabled={end.isPending} onClick={() => end.mutate()}>
            {t('combat.endConfirm')}
          </button>
          <button type="button" className={styles.ghost} onClick={() => dialog.current?.close()}>
            {t('combat.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
