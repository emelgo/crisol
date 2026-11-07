/**
 * El panel de la mesa (como el lienzo): las escenas del mundo, sus encuentros, las criaturas (las que ya están en
 * juego y el compendio de la campaña, con cuántas), los personajes de la campaña y las imágenes del mundo (para la
 * imagen de una ficha). Lo que se pone se arrastra al mapa; con el teclado, su «+» lo pone en medio de lo que se ve
 */
import type { CampaignTableView, SceneGrid, TokenView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ImageIcon, Layers, Plus, Search, Swords, Users } from 'lucide-react'
import { type DragEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { useWorldFiles } from '../wiki/cover-look.ts'
import styles from './mesa.module.css'
import { sceneListKey } from './queries.ts'
import { SceneThumb } from './thumb.tsx'
import { formationOf, initialOf } from './tokens.ts'

/** Lo que se suelta en el mapa desde el panel */
export type Placing =
  | { kind: 'character'; id: string }
  | { kind: 'creature'; id: string }
  | { kind: 'content'; key: string; count: number }
  | { kind: 'encounter'; id: string }

export const PLACING_TYPE = 'application/x-crisol-mesa'

const dragging = (placing: Placing) => (event: DragEvent) => {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(PLACING_TYPE, JSON.stringify(placing))
}

type Tab = 'scenes' | 'encounters' | 'creatures' | 'characters' | 'images'

const TABS: Array<{ key: Tab; icon: typeof Layers }> = [
  { key: 'scenes', icon: Layers },
  { key: 'encounters', icon: Swords },
  { key: 'creatures', icon: BookOpen },
  { key: 'characters', icon: Users },
  { key: 'images', icon: ImageIcon }
]

export function TablePanel({
  worldId,
  campaignId,
  systemId,
  table,
  selected,
  onOpen,
  onPlace,
  onImage
}: {
  worldId: string
  campaignId: string
  systemId: string | null
  table: CampaignTableView | null
  /** Las fichas elegidas en el mapa */
  selected: TokenView[]
  onOpen: (sceneId: string) => void
  onPlace: (placing: Placing) => void
  /** Una imagen del mundo para la ficha elegida */
  onImage: (fileId: string) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('scenes')
  const ids = useId()
  const canPlace = Boolean(table?.open?.image?.tiles)
  return (
    <aside className={styles.panel} aria-label={t('tabletop.panel')}>
      <div className={styles.panelTabs} role="tablist" aria-label={t('tabletop.panel')}>
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${ids}-${key}`}
            aria-selected={tab === key}
            aria-controls={`${ids}-panel`}
            tabIndex={tab === key ? 0 : -1}
            data-tour={key === 'scenes' ? 'mesa-escenas' : undefined}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              const at = TABS.findIndex((each) => each.key === tab)
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
              if (!step) return
              const next = TABS[(at + step + TABS.length) % TABS.length]?.key ?? tab
              setTab(next)
              document.getElementById(`${ids}-${next}`)?.focus()
            }}
          >
            <Icon aria-hidden="true" size={18} />
            {t(`tabletop.tabs.${key}`)}
          </button>
        ))}
      </div>
      <div className={styles.panelBody} role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-${tab}`}>
        {tab === 'scenes' && <ScenesList worldId={worldId} table={table} onOpen={onOpen} />}
        {tab === 'encounters' && (
          <EncountersList
            worldId={worldId}
            campaignId={campaignId}
            systemId={systemId}
            table={table}
            selected={selected}
            canPlace={canPlace}
            onPlace={onPlace}
          />
        )}
        {tab === 'creatures' && (
          <CreaturesList campaignId={campaignId} table={table} canPlace={canPlace} onPlace={onPlace} />
        )}
        {tab === 'characters' && (
          <CharactersList campaignId={campaignId} table={table} canPlace={canPlace} onPlace={onPlace} />
        )}
        {tab === 'images' && <ImagesList worldId={worldId} selected={selected} onImage={onImage} />}
      </div>
      <div className={styles.legend} aria-hidden="true">
        {(['group', 'hostile', 'neutral'] as const).map((faction) => (
          <span key={faction}>
            <i data-faction={faction} />
            {t(`tokens.factions.${faction}`)}
          </span>
        ))}
      </div>
    </aside>
  )
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className={styles.search}>
      <Search aria-hidden="true" size={15} />
      <input
        type="search"
        value={value}
        placeholder={label}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

const matches = (text: string, query: string) =>
  !query.trim() || text.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))

/** Una fila que se arrastra al mapa, con su «+» para el teclado */
function PlaceRow({
  placing,
  name,
  detail,
  avatar,
  canPlace,
  onPlace,
  done
}: {
  placing: Placing
  name: string
  detail: string
  avatar: ReactNode
  canPlace: boolean
  onPlace: (placing: Placing) => void
  /** Ya está en el mapa */
  done?: boolean
}) {
  const { t } = useTranslation()
  return (
    <li className={styles.sceneRow} draggable={canPlace && !done} onDragStart={dragging(placing)} data-place="">
      {avatar}
      <div className={styles.sceneName}>
        <b>{name}</b>
        <span>{detail}</span>
      </div>
      {!done && (
        <button
          type="button"
          className={styles.iconSmall}
          disabled={!canPlace}
          aria-label={t('tabletop.place', { name })}
          title={t('tabletop.place', { name })}
          onClick={() => onPlace(placing)}
        >
          <Plus aria-hidden="true" size={15} />
        </button>
      )}
    </li>
  )
}

const Avatar = ({ name, faction }: { name: string; faction: 'group' | 'hostile' }) => (
  <span className={styles.avatar} data-faction={faction} aria-hidden="true">
    {initialOf(name)}
  </span>
)

/** Las escenas del mundo, con su miniatura y un buscador; la abierta y la que está en la tele, marcadas */
function ScenesList({
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
  // La mesa cambia (otra escena con mapa nuevo, por ejemplo): la lista, al día
  const openId = table?.open?.id
  const openVersion = table?.open?.image?.tiles?.version
  const { refetch } = scenes
  useEffect(() => {
    if (openId) void refetch()
  }, [openId, openVersion, refetch])
  const all = scenes.data?.scenes ?? []
  const shown = all.filter((scene) => matches(`${scene.name} ${scene.pageTitle}`, query))
  const live = table?.presented && !table.screenHidden ? table.presented.id : null
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('tabletop.searchScenes')} />
      {!scenes.data ? (
        failed(scenes) ? (
          <LoadError error={scenes.error} onRetry={() => scenes.refetch()} />
        ) : null
      ) : shown.length === 0 ? (
        <p className={styles.muted}>{all.length === 0 ? t('tabletop.noScenes') : t('tabletop.noMatches')}</p>
      ) : (
        <ul className={styles.scenes} aria-label={t('tabletop.scenes')}>
          {shown.map((scene) => {
            const isOpen = scene.id === openId
            return (
              <li key={scene.id} className={styles.sceneRow} data-open={isOpen || undefined}>
                <SceneThumb scene={scene} />
                <div className={styles.sceneName}>
                  <b>{scene.name}</b>
                  <span>{isOpen ? t('tabletop.opened') : scene.pageTitle}</span>
                  {live === scene.id && <span className={`${styles.chip} ${styles.live}`}>{t('tabletop.live')}</span>}
                </div>
                {!isOpen && (
                  <button
                    type="button"
                    className={styles.small}
                    aria-label={`${t('tabletop.open')} ${scene.name}`}
                    onClick={() => onOpen(scene.id)}
                  >
                    {t('tabletop.open')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** Los personajes de la campaña: los que aún no están en esta escena se arrastran al mapa */
function CharactersList({
  campaignId,
  table,
  canPlace,
  onPlace
}: {
  campaignId: string
  table: CampaignTableView | null
  canPlace: boolean
  onPlace: (placing: Placing) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const [query, setQuery] = useState('')
  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () => api.call('listCharacters', { campaignId })
  })
  const onMap = new Set((table?.tokens ?? []).map((token) => token.actor.id))
  const shown = (characters.data?.characters ?? []).filter((c) => matches(c.name, query))
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('tabletop.searchCharacters')} />
      {characters.data && shown.length === 0 ? (
        <p className={styles.muted}>{t('tabletop.noCharacters')}</p>
      ) : (
        <ul className={styles.scenes} aria-label={t('tabletop.tabs.characters')}>
          {shown.map((character) => (
            <PlaceRow
              key={character.id}
              placing={{ kind: 'character', id: character.id }}
              name={character.name}
              detail={[character.owner?.name, onMap.has(character.id) ? t('tabletop.onMap') : null]
                .filter(Boolean)
                .join(' · ')}
              avatar={<Avatar name={character.name} faction="group" />}
              canPlace={canPlace}
              onPlace={onPlace}
              done={onMap.has(character.id)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

/** Las criaturas: las que están en juego sin ficha aquí y el compendio de la campaña, con cuántas se ponen */
function CreaturesList({
  campaignId,
  table,
  canPlace,
  onPlace
}: {
  campaignId: string
  table: CampaignTableView | null
  canPlace: boolean
  onPlace: (placing: Placing) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const countId = useId()
  const [query, setQuery] = useState('')
  const [count, setCount] = useState('1')
  const inPlay = useQuery({
    queryKey: ['creatures', campaignId],
    queryFn: () => api.call('listInPlay', { campaignId })
  })
  const compendium = useQuery({
    queryKey: ['compendium', campaignId, 'overview'],
    queryFn: () => api.call('getCampaignCompendium', { campaignId })
  })
  const actors = new Set(compendium.data?.types.filter((type) => type.document === 'actor').map((type) => type.key))
  const found = useQuery({
    queryKey: ['compendium', campaignId, 'search', query.trim()],
    queryFn: () => api.call('searchCampaignContent', { campaignId, query: query.trim() || undefined, limit: 60 }),
    enabled: Boolean(compendium.data?.system)
  })
  const onMap = new Set((table?.tokens ?? []).map((token) => token.actor.id))
  const loose = (inPlay.data?.creatures ?? []).filter((c) => !onMap.has(c.id) && matches(c.name, query))
  const hits = (found.data?.items ?? []).filter((item) => actors.has(item.type))
  const copies = Math.max(1, Math.min(20, Math.round(Number(count)) || 1))
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('tabletop.searchCreatures')} />
      {loose.length > 0 && (
        <>
          <h3 className={styles.listTitle}>{t('tabletop.inPlay')}</h3>
          <ul className={styles.scenes} aria-label={t('tabletop.inPlay')}>
            {loose.map((creature) => (
              <PlaceRow
                key={creature.id}
                placing={{ kind: 'creature', id: creature.id }}
                name={creature.name}
                detail={
                  creature.life ? t('tokens.lifeValue', { value: creature.life.value, max: creature.life.max }) : ''
                }
                avatar={<Avatar name={creature.name} faction="hostile" />}
                canPlace={canPlace}
                onPlace={onPlace}
              />
            ))}
          </ul>
        </>
      )}
      <div className={styles.compendiumHead}>
        <h3 className={styles.listTitle}>{t('tabletop.compendium')}</h3>
        <label htmlFor={countId}>{t('tabletop.count')}</label>
        <input
          id={countId}
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(event) => setCount(event.currentTarget.value)}
        />
      </div>
      {!compendium.data?.system ? (
        <p className={styles.muted}>{t('tabletop.noSystem')}</p>
      ) : (
        <ul className={styles.scenes} aria-label={t('tabletop.compendium')}>
          {hits.map((item) => (
            <PlaceRow
              key={item.key}
              placing={{ kind: 'content', key: item.key, count: copies }}
              name={item.name}
              detail={item.world ? t('tabletop.ofWorld') : (item.source ?? '')}
              avatar={<Avatar name={item.name} faction="hostile" />}
              canPlace={canPlace}
              onPlace={onPlace}
            />
          ))}
        </ul>
      )}
    </>
  )
}

/** Los encuentros del mundo; con fichas elegidas, «Guardar como encuentro» (su formación, en casillas) */
function EncountersList({
  worldId,
  campaignId,
  systemId,
  table,
  selected,
  canPlace,
  onPlace
}: {
  worldId: string
  campaignId: string
  systemId: string | null
  table: CampaignTableView | null
  selected: TokenView[]
  canPlace: boolean
  onPlace: (placing: Placing) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const nameId = useId()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const encounters = useQuery({
    queryKey: ['encounters', worldId],
    queryFn: () => api.call('listEncounters', { worldId })
  })
  const inPlay = useQuery({
    queryKey: ['creatures', campaignId],
    queryFn: () => api.call('listInPlay', { campaignId })
  })
  const creatures = new Map((inPlay.data?.creatures ?? []).map((c) => [c.id, c]))
  // Solo las criaturas (por su clave del compendio): los personajes no van en un encuentro
  const members = selected.flatMap((token) => {
    const creature = token.actor.kind === 'creature' ? creatures.get(token.actor.id) : undefined
    return creature ? [{ key: creature.key, unique: creature.unique, x: token.x, y: token.y }] : []
  })
  const grid: SceneGrid | undefined = table?.open?.grid
  const save = useMutation({
    mutationFn: () =>
      api.call('saveEncounter', {
        worldId,
        systemId,
        name: name.trim(),
        members: grid ? formationOf(members, grid) : []
      }),
    onSuccess: () => {
      setName('')
      void client.invalidateQueries({ queryKey: ['encounters', worldId] })
    }
  })
  const shown = (encounters.data?.encounters ?? []).filter((each) => matches(each.name, query))
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('tabletop.searchEncounters')} />
      {encounters.data && shown.length === 0 ? (
        <p className={styles.muted}>{t('tabletop.noEncounters')}</p>
      ) : (
        <ul className={styles.scenes} aria-label={t('tabletop.tabs.encounters')}>
          {shown.map((encounter) => (
            <PlaceRow
              key={encounter.id}
              placing={{ kind: 'encounter', id: encounter.id }}
              name={encounter.name}
              detail={t('tabletop.creatures', { count: encounter.members.reduce((n, m) => n + m.at.length, 0) })}
              avatar={<Avatar name={encounter.name} faction="hostile" />}
              canPlace={canPlace}
              onPlace={onPlace}
            />
          ))}
        </ul>
      )}
      {members.length > 0 && (
        <form
          className={styles.saveEncounter}
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) save.mutate()
          }}
        >
          <label htmlFor={nameId}>{t('tabletop.saveEncounter', { count: members.length })}</label>
          <div>
            <input
              id={nameId}
              value={name}
              maxLength={80}
              placeholder={t('tabletop.encounterName')}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <button type="submit" className={styles.small} disabled={!name.trim() || save.isPending}>
              {t('tabletop.save')}
            </button>
          </div>
          <FormError message={save.error ? errorText(save.error) : null} />
        </form>
      )}
    </>
  )
}

/** Las imágenes del mundo: con una ficha elegida, una de ellas es su imagen (se encuadra en redondo) */
function ImagesList({
  worldId,
  selected,
  onImage
}: {
  worldId: string
  selected: TokenView[]
  onImage: (fileId: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const files = useWorldFiles(worldId)
  const images = (files.data?.files ?? []).filter((file) => file.kind === 'image' && matches(file.name, query))
  const token = selected.length === 1 ? selected[0] : null
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('tabletop.searchImages')} />
      <p className={styles.muted}>{token ? t('tabletop.imageFor', { name: token.label }) : t('tabletop.pickToken')}</p>
      <ul className={styles.images} aria-label={t('tabletop.tabs.images')}>
        {images.map((file) => (
          <li key={file.id}>
            <button type="button" disabled={!token} onClick={() => onImage(file.id)}>
              <img src={file.url} alt="" loading="lazy" />
              <span>{file.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
