/**
 * La pestaña Escenas de la Mesa (lienzo «Campaña en la Mesa»): las escenas del mundo en tarjetas con su miniatura (la
 * abierta, marcada; la de la tele, con su sello) y «Escena nueva»; debajo, lo que hay en la escena abierta (personajes y
 * criaturas, con su vida, para ocultarlos al grupo o meterlos en el combate) y los encuentros guardados
 */
import type { CampaignTableView, SceneView, TokenView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, MoreHorizontal, Pencil, Play, Plus, Settings2, Swords, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { useWindows } from '../components/windows.tsx'
import cards from '../routes/world-card.module.css'
import { SourcePicker } from '../wiki/scene/source-picker.tsx'
import { sceneListKey } from './queries.ts'
import { sceneWindow } from './scene-window.tsx'
import styles from './scenes-tab.module.css'
import { SceneThumb } from './thumb.tsx'
import { initialOf } from './tokens.ts'
import type { SceneChoice } from './use-preparation.ts'

const matches = (text: string, query: string) =>
  !query.trim() || text.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))

export function ScenesGrid({
  worldId,
  table,
  onOpen,
  onCreate
}: {
  worldId: string
  table: CampaignTableView | null
  onOpen: (sceneId: string) => void
  /** Una escena recién creada: abrirla y preparar su mapa, si se eligió */
  onCreate?: (scene: SceneView, choice: SceneChoice | null) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const [query, setQuery] = useState('')
  // La recién creada entra animada (sube y crece, con el contorno iluminado un momento: docs/diseno.md)
  const [fresh, setFresh] = useState<string | null>(null)
  useEffect(() => {
    if (!fresh) return
    const timer = window.setTimeout(() => setFresh(null), 1400)
    return () => window.clearTimeout(timer)
  }, [fresh])
  const scenes = useQuery({ queryKey: sceneListKey(worldId), queryFn: () => api.call('listScenes', { worldId }) })
  const openId = table?.open?.id ?? null
  const live = table?.presented && !table.screenHidden ? table.presented.id : null
  if (!scenes.data) return failed(scenes) ? <LoadError error={scenes.error} onRetry={() => scenes.refetch()} /> : null
  const all = scenes.data.scenes
  const shown = all.filter((scene) => matches(`${scene.name} ${scene.pageTitle ?? ''}`, query))
  return (
    <>
      {all.length > 4 && (
        <input
          className={styles.search}
          type="search"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          value={query}
          placeholder={t('tabletop.searchScenes')}
          aria-label={t('tabletop.searchScenes')}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      )}
      {query && shown.length === 0 && <p className={styles.muted}>{t('tabletop.noMatches')}</p>}
      <ul className={styles.grid} aria-label={t('tabletop.scenes')}>
        {shown.map((scene) => (
          <SceneCard
            key={scene.id}
            worldId={worldId}
            scene={scene}
            open={scene.id === openId}
            live={scene.id === live}
            onOpen={() => scene.id !== openId && onOpen(scene.id)}
            fresh={scene.id === fresh}
          />
        ))}
        {!query && (
          <NewScene
            worldId={worldId}
            onCreated={(scene, choice) => {
              setFresh(scene.id)
              if (onCreate) onCreate(scene, choice)
              else onOpen(scene.id)
            }}
          />
        )}
      </ul>
    </>
  )
}

/**
 * Una escena: pulsarla la abre en la Mesa; con el botón derecho (o «⋯»), lo demás: abrirla, su rejilla y sus ajustes
 * (su página, en una ventana), cambiarle el nombre y borrarla
 */
function SceneCard({
  worldId,
  scene,
  open,
  live,
  onOpen,
  fresh = false
}: {
  worldId: string
  scene: SceneView
  open: boolean
  live: boolean
  onOpen: () => void
  /** Recién creada: entra animada */
  fresh?: boolean
}) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const more = useRef<HTMLButtonElement>(null)
  const openMenu = (x: number, y: number) => setMenu({ x, y })
  return (
    <li
      className={fresh ? `${styles.card} ${styles.fresh}` : styles.card}
      data-open={open || undefined}
      onContextMenu={(event) => {
        event.preventDefault()
        openMenu(event.clientX, event.clientY)
      }}
    >
      <button
        type="button"
        className={styles.cardButton}
        aria-current={open || undefined}
        aria-label={open ? `${scene.name}, ${t('tabletop.opened')}` : t('tabletop.openScene', { name: scene.name })}
        onClick={onOpen}
      >
        <span className={styles.thumb}>
          <SceneThumb scene={scene} />
        </span>
        <span className={styles.name}>{scene.name}</span>
      </button>
      <button
        ref={more}
        type="button"
        className={styles.more}
        aria-label={t('tabletop.sceneMenu', { name: scene.name })}
        title={t('tabletop.sceneMenu', { name: scene.name })}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        onClick={() => {
          const box = more.current?.getBoundingClientRect()
          if (box) openMenu(box.left, box.bottom + 4)
        }}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {live && <span className={styles.live}>{t('tabletop.live')}</span>}
      {menu && (
        <SceneMenu
          worldId={worldId}
          scene={scene}
          at={menu}
          onOpen={onOpen}
          onClose={() => {
            setMenu(null)
            more.current?.focus()
          }}
        />
      )}
    </li>
  )
}

/** El menú de una escena, donde se pulsó (o bajo su «⋯»): Escape o pulsar fuera lo cierran */
function SceneMenu({
  worldId,
  scene,
  at,
  onOpen,
  onClose
}: {
  worldId: string
  scene: SceneView
  at: { x: number; y: number }
  onOpen: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const windows = useWindows()
  const root = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'menu' | 'rename' | 'delete'>('menu')
  const [name, setName] = useState(scene.name)
  const refresh = () => client.invalidateQueries({ queryKey: ['pages', worldId] })
  const rename = useMutation({
    mutationFn: (next: string) => api.call('renameScene', { sceneId: scene.id, name: next }),
    onSuccess: async () => {
      await refresh()
      onClose()
    }
  })
  const remove = useMutation({
    mutationFn: () => api.call('deleteScene', { sceneId: scene.id }),
    onSuccess: async () => {
      await refresh()
      onClose()
    }
  })
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role="menuitem"], input, button')?.focus()
  }, [step])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [onClose])
  const error = rename.error ?? remove.error
  // Que no se salga de la pantalla
  const left = Math.min(at.x, window.innerWidth - 252)
  const top = Math.min(at.y, window.innerHeight - 200)
  return createPortal(
    // biome-ignore lint/a11y/useSemanticElements: un fieldset pondría su marco; es el grupo del menú y sus pasos
    <div
      ref={root}
      role="group"
      aria-label={scene.name}
      className={styles.sceneMenu}
      style={{ left, top }}
      data-popover=""
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
        }
        if (step !== 'menu' || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
        event.preventDefault()
        const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }}
    >
      {step === 'menu' && (
        <div role="menu" aria-label={t('tabletop.sceneMenu', { name: scene.name })}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpen()
              onClose()
            }}
          >
            <Play size={14} aria-hidden="true" />
            {t('tabletop.open')}
          </button>
          {windows && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                windows.open(sceneWindow(worldId, scene))
                onClose()
              }}
            >
              <Settings2 size={14} aria-hidden="true" />
              {t('tabletop.sceneSettings')}
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => setStep('rename')}>
            <Pencil size={14} aria-hidden="true" />
            {t('tabletop.renameScene')}
          </button>
          <button type="button" role="menuitem" className={styles.danger} onClick={() => setStep('delete')}>
            <Trash2 size={14} aria-hidden="true" />
            {t('tabletop.deleteScene')}
          </button>
        </div>
      )}
      {step === 'rename' && (
        <form
          className={styles.menuForm}
          onSubmit={(event) => {
            event.preventDefault()
            const next = name.trim()
            if (next && next !== scene.name) rename.mutate(next)
            else onClose()
          }}
        >
          <label>
            {t('tabletop.newSceneName')}
            <input value={name} maxLength={80} onChange={(event) => setName(event.currentTarget.value)} />
          </label>
          <div className={styles.newActions}>
            <button type="submit" className={styles.primary} disabled={rename.isPending}>
              {t('tabletop.renameScene')}
            </button>
            <button type="button" className={styles.ghost} onClick={onClose}>
              {t('list.cancel')}
            </button>
          </div>
        </form>
      )}
      {step === 'delete' && (
        <div className={styles.menuForm}>
          <p>{t('tabletop.deleteSceneWarning', { name: scene.name })}</p>
          <div className={styles.newActions}>
            <button
              type="button"
              className={styles.primary}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('tabletop.deleteScene')}
            </button>
            <button type="button" className={styles.ghost} onClick={onClose}>
              {t('list.cancel')}
            </button>
          </div>
        </div>
      )}
      <FormError message={error ? errorText(error) : null} />
    </div>,
    document.body
  )
}

/**
 * «Escena nueva»: un cuadro con todo lo que hace falta (su nombre y su mapa) y, al crearla, se cierra y la escena se abre
 * en la Mesa con su mapa preparándose (Enrique, 2026-11-10: «así solo hacemos una transición»). Suelta, sin página
 * (ADR-0020); la rejilla, después, en sus ajustes
 */
function NewScene({
  worldId,
  onCreated
}: {
  worldId: string
  onCreated: (scene: SceneView, choice: SceneChoice | null) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [choice, setChoice] = useState<SceneChoice | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const windows = useWindows()
  const create = useMutation({
    mutationFn: (title: string) => api.call('createScene', { worldId, name: title }),
    onSuccess: async (scene) => {
      await client.invalidateQueries({ queryKey: sceneListKey(worldId) })
      const chosen = choice
      dialog.current?.close()
      onCreated(scene, chosen)
      // Y sus ajustes, para colocar la rejilla sobre el mapa (Enrique: «falta el paso de la rejilla»)
      windows?.open(sceneWindow(worldId, scene))
    }
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() && !create.isPending) create.mutate(name.trim())
  }
  return (
    <li className={styles.card}>
      <button
        type="button"
        className={`${styles.cardButton} ${styles.new}`}
        onClick={() => {
          create.reset()
          setName('')
          setChoice(null)
          setOpen(true)
        }}
      >
        <span className={styles.thumb}>
          <Plus aria-hidden="true" size={28} strokeWidth={1.5} />
        </span>
        <span className={styles.name}>{t('tabletop.newScene')}</span>
      </button>
      {open && (
        <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => setOpen(false)}>
          <form className={cards.form} onSubmit={submit}>
            <h2 id={titleId}>{t('tabletop.newScene')}</h2>
            <Field
              label={t('tabletop.newSceneName')}
              value={name}
              required
              maxLength={200}
              autoComplete="off"
              data-autofocus
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <SourcePicker worldId={worldId} value={choice} onChange={setChoice} />
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton type="submit" className={form.button} busy={create.isPending} disabled={!name.trim()}>
                {t('tabletop.createScene')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('list.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </li>
  )
}

/** Lo que hay en la escena abierta: los personajes primero, luego las criaturas */
export function InScene({
  campaignId,
  table,
  tokens,
  onPick
}: {
  campaignId: string
  table: CampaignTableView | null
  tokens: TokenView[]
  onPick: (tokenId: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const headingId = useId()
  const hide = useMutation({
    mutationFn: (token: TokenView) => api.call('updateToken', { tokenId: token.id, hidden: !token.hidden })
  })
  const fight = useMutation({
    mutationFn: (token: TokenView) => api.call('addCombatants', { campaignId, tokenIds: [token.id] })
  })
  if (!table?.open) return null
  const combat = table.combat
  const fighting = new Set((combat?.combatants ?? []).map((c) => c.tokenId).filter(Boolean))
  const sorted = [...tokens].sort(
    (a, b) =>
      Number(a.actor.kind === 'creature') - Number(b.actor.kind === 'creature') ||
      a.label.localeCompare(b.label, 'es', { numeric: true })
  )
  const error = hide.error ?? fight.error
  return (
    // biome-ignore lint/a11y/useSemanticElements: una sección con título se enmarca como recuadro de hoja (base.css); aquí no
    <div role="region" className={styles.inScene} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.section}>
        {t('tabletop.inScene')}
      </h3>
      {sorted.length === 0 ? (
        <p className={styles.muted}>{t('tabletop.inSceneEmpty')}</p>
      ) : (
        <ul className={styles.rows}>
          {sorted.map((token) => {
            const life = token.actor.life
            const ratio = life && life.max > 0 ? Math.max(0, Math.min(1, life.value / life.max)) : null
            return (
              <li key={token.id} className={styles.row} data-hidden={token.hidden || undefined}>
                <span className={styles.avatar} data-faction={token.faction} aria-hidden="true">
                  {initialOf(token.label)}
                </span>
                <button type="button" className={styles.who} onClick={() => onPick(token.id)}>
                  <b>{token.label}</b>
                  <small>
                    {token.hidden
                      ? t('tabletop.hiddenFromGroup')
                      : life
                        ? t('tokens.lifeValue', { value: life.value, max: life.max })
                        : token.actor.name}
                  </small>
                </button>
                {ratio !== null && (
                  <span className={styles.bar} aria-hidden="true">
                    <i
                      style={{ inlineSize: `${ratio * 100}%` }}
                      data-level={ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'mid' : undefined}
                    />
                  </span>
                )}
                <span className={styles.actions}>
                  {combat && !fighting.has(token.id) && (
                    <button
                      type="button"
                      className={styles.icon}
                      aria-label={t('tabletop.toCombat', { name: token.label })}
                      title={t('tabletop.toCombat', { name: token.label })}
                      disabled={fight.isPending}
                      onClick={() => fight.mutate(token)}
                    >
                      <Swords aria-hidden="true" size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.icon}
                    aria-pressed={token.hidden}
                    aria-label={t('tabletop.hideFromGroup', { name: token.label })}
                    title={t(token.hidden ? 'tabletop.showToGroup' : 'tabletop.hideFromGroup', { name: token.label })}
                    disabled={hide.isPending}
                    onClick={() => hide.mutate(token)}
                  >
                    {token.hidden ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
}
