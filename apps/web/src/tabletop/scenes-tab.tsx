/**
 * La pestaña Escenas de la Mesa (lienzo «Campaña en la Mesa»): las escenas del mundo en tarjetas con su miniatura (la
 * abierta, marcada; la de la tele, con su sello) y «Escena nueva»; debajo, lo que hay en la escena abierta (personajes y
 * criaturas, con su vida, para ocultarlos al grupo o meterlos en el combate) y los encuentros guardados
 */
import type { CampaignTableView, SceneView, TokenView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Plus, Swords } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { sceneListKey } from './queries.ts'
import styles from './scenes-tab.module.css'
import { SceneThumb } from './thumb.tsx'
import { initialOf } from './tokens.ts'

const matches = (text: string, query: string) =>
  !query.trim() || text.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))

export function ScenesGrid({
  worldId,
  table,
  onOpen
}: {
  worldId: string
  table: CampaignTableView | null
  onOpen: (sceneId: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const [query, setQuery] = useState('')
  const scenes = useQuery({ queryKey: sceneListKey(worldId), queryFn: () => api.call('listScenes', { worldId }) })
  const openId = table?.open?.id ?? null
  const live = table?.presented && !table.screenHidden ? table.presented.id : null
  if (!scenes.data) return failed(scenes) ? <LoadError error={scenes.error} onRetry={() => scenes.refetch()} /> : null
  const all = scenes.data.scenes
  const shown = all.filter((scene) => matches(`${scene.name} ${scene.pageTitle}`, query))
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
            scene={scene}
            open={scene.id === openId}
            live={scene.id === live}
            onOpen={() => scene.id !== openId && onOpen(scene.id)}
          />
        ))}
        {!query && <NewScene worldId={worldId} onCreated={onOpen} />}
      </ul>
    </>
  )
}

function SceneCard({
  scene,
  open,
  live,
  onOpen
}: {
  scene: SceneView
  open: boolean
  live: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <li className={styles.card} data-open={open || undefined}>
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
      {live && <span className={styles.live}>{t('tabletop.live')}</span>}
    </li>
  )
}

/** «Escena nueva»: una página con ese nombre y su pestaña de escena, que se abre en la Mesa */
function NewScene({ worldId, onCreated }: { worldId: string; onCreated: (sceneId: string) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const inputId = useId()
  const [writing, setWriting] = useState(false)
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: async (title: string) => {
      const page = await api.call('createPage', { worldId, title })
      const tab = await api.call('createPageTab', { pageId: page.id, kind: 'scene', name: title })
      return api.call('getScene', { tabId: tab.id })
    },
    onSuccess: async (scene) => {
      setWriting(false)
      setName('')
      await client.invalidateQueries({ queryKey: sceneListKey(worldId) })
      onCreated(scene.id)
    }
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) create.mutate(name.trim())
  }
  if (!writing)
    return (
      <li className={styles.card}>
        <button type="button" className={`${styles.cardButton} ${styles.new}`} onClick={() => setWriting(true)}>
          <span className={styles.thumb}>
            <Plus aria-hidden="true" size={28} strokeWidth={1.5} />
          </span>
          <span className={styles.name}>{t('tabletop.newScene')}</span>
        </button>
      </li>
    )
  return (
    <li className={`${styles.card} ${styles.wide}`}>
      <form className={styles.newForm} onSubmit={submit}>
        <label htmlFor={inputId}>{t('tabletop.newSceneName')}</label>
        <input
          id={inputId}
          // biome-ignore lint/a11y/noAutofocus: se acaba de pedir escribir su nombre
          autoFocus
          autoComplete="off"
          value={name}
          maxLength={200}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setWriting(false)
          }}
        />
        <div className={styles.newActions}>
          <button type="submit" className={styles.primary} disabled={!name.trim() || create.isPending}>
            {t('tabletop.createScene')}
          </button>
          <button type="button" className={styles.ghost} onClick={() => setWriting(false)}>
            {t('list.cancel')}
          </button>
        </div>
        <FormError message={create.error ? errorText(create.error) : null} />
      </form>
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
