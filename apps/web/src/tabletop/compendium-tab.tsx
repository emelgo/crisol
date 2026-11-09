/**
 * La pestaña Compendio de la Mesa (lienzo «Campaña en la Mesa»): buscar en el compendio de la campaña por sus apartados
 * (los de su sistema) y en los libros del mundo («Libros», la biblioteca de antes). Las criaturas se arrastran al mapa
 * (o se ponen con su «+»); cualquier entrada se abre en la ventana del compendio, y un libro en la suya
 */
import type { CampaignTableView, TokenView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Eye, EyeOff, Plus } from 'lucide-react'
import { type DragEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { useSettled } from '../components/settled.ts'
import styles from './compendium-tab.module.css'
import { compendiumWindow } from './compendium-window.tsx'
import { libraryWindow } from './library-window.tsx'
import { ImagesList, PLACING_TYPE, type Placing } from './panel.tsx'
import { initialOf } from './tokens.ts'
import { useWindows } from './windows.tsx'

const BOOKS = 'libros'
const ALL = 'todo'

const dragging = (placing: Placing) => (event: DragEvent) => {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(PLACING_TYPE, JSON.stringify(placing))
}

const matches = (text: string, query: string) =>
  !query || text.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))

export function CompendiumTab({
  worldId,
  campaignId,
  table,
  selected,
  canPlace,
  onPlace,
  onImage
}: {
  worldId: string
  campaignId: string
  table: CampaignTableView | null
  /** Las fichas elegidas en el mapa: con alguna, sus imágenes del mundo para ella */
  selected: TokenView[]
  canPlace: boolean
  onPlace: (placing: Placing) => void
  onImage: (fileId: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const windows = useWindows()
  const [query, setQuery] = useState('')
  const wanted = useSettled(query.trim())
  const [section, setSection] = useState(ALL)
  const compendium = useQuery({
    queryKey: ['compendium', campaignId],
    queryFn: () => api.call('getCampaignCompendium', { campaignId })
  })
  const hits = useQuery({
    queryKey: ['compendium', campaignId, 'search', wanted, 'mesa'],
    queryFn: () => api.call('searchCampaignContent', { campaignId, query: wanted || undefined, limit: 80 }),
    enabled: Boolean(compendium.data?.system) && section !== BOOKS
  })
  const books = useQuery({ queryKey: ['library', worldId], queryFn: () => api.call('listLibrary', { worldId }) })
  const client = useQueryClient()
  const hiding = useMutation({
    mutationFn: ({ creatureId, hidden }: { creatureId: string; hidden: boolean }) =>
      api.call('setCreatureHidden', { creatureId, hidden }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['creatures', campaignId] })
  })
  const inPlay = useQuery({
    queryKey: ['creatures', campaignId],
    queryFn: () => api.call('listInPlay', { campaignId })
  })
  if (!compendium.data)
    return failed(compendium) ? <LoadError error={compendium.error} onRetry={() => compendium.refetch()} /> : null
  const { types, sections, system } = compendium.data
  const actors = new Set(types.filter((type) => type.document === 'actor').map((type) => type.key))
  const labelOf = (key: string) => types.find((type) => type.key === key)?.label ?? key
  const current = sections.find((s) => s.key === section)
  const inSection = (type: string) => !current || current.types.some((each) => each.key === type)
  const found = (hits.data?.items ?? []).filter((item) => inSection(item.type))
  const onMap = new Set((table?.tokens ?? []).map((token) => token.actor.id))
  // Todas las que están en juego: las de la escena, sin «+»; cada una, con si la ven los jugadores en su compendio
  const loose = (inPlay.data?.creatures ?? []).filter((c) => matches(c.name, wanted))
  const showLoose = section === ALL || (current?.types.some((each) => actors.has(each.key)) ?? false)
  const bookList = (books.data?.books ?? []).filter((book) => matches(book.name, wanted))
  const title = t('tabletop.sidebar.compendium')
  const openEntry = (key: string) => windows?.open(compendiumWindow(worldId, campaignId, title, key))
  const openBook = (fileId: string, name: string) =>
    windows?.open(libraryWindow(worldId, name, { libro: fileId, ...(wanted ? { q: wanted } : {}) }))
  return (
    <>
      <input
        className={styles.search}
        type="search"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        value={query}
        placeholder={t('tabletop.compendium.search')}
        aria-label={t('tabletop.compendium.search')}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <fieldset className={styles.filters}>
        <legend className={styles.hidden}>{t('tabletop.compendium.sections')}</legend>
        {[
          { key: ALL, label: t('tabletop.compendium.all') },
          ...sections,
          { key: BOOKS, label: t('tabletop.compendium.books') }
        ].map((each) => (
          <button key={each.key} type="button" aria-pressed={section === each.key} onClick={() => setSection(each.key)}>
            {each.label}
          </button>
        ))}
      </fieldset>
      {section === BOOKS ? (
        bookList.length === 0 ? (
          <p className={styles.muted}>{t('library.empty')}</p>
        ) : (
          <ul className={styles.rows} aria-label={t('tabletop.compendium.books')}>
            {bookList.map((book) => (
              <li key={book.fileId} className={styles.row}>
                <BookOpen aria-hidden="true" size={18} className={styles.bookIcon} />
                <button type="button" className={styles.name} onClick={() => openBook(book.fileId, book.name)}>
                  <b>{book.name}</b>
                  <small>{book.pages > 0 ? t('tabletop.compendium.pages', { count: book.pages }) : ''}</small>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {!system && <p className={styles.muted}>{t('compendium.noSystem')}</p>}
          {showLoose && loose.length > 0 && (
            <>
              <h3 className={styles.section}>{t('tabletop.inPlay')}</h3>
              <ul className={styles.rows} aria-label={t('tabletop.inPlay')}>
                {loose.map((creature) => (
                  <Row
                    key={creature.id}
                    name={creature.name}
                    detail={onMap.has(creature.id) ? t('tabletop.onMap') : t('tabletop.compendium.inPlay')}
                    placing={onMap.has(creature.id) ? null : { kind: 'creature', id: creature.id }}
                    canPlace={canPlace}
                    onPlace={onPlace}
                    hidden={creature.hidden ?? false}
                    onHidden={(hidden) => hiding.mutate({ creatureId: creature.id, hidden })}
                  />
                ))}
              </ul>
            </>
          )}
          {found.length > 0 && (
            <ul className={styles.rows} aria-label={t('tabletop.compendium.results')}>
              {found.map((item) => (
                <Row
                  key={item.key}
                  name={item.name}
                  detail={labelOf(item.type)}
                  placing={actors.has(item.type) ? { kind: 'content', key: item.key, count: 1 } : null}
                  canPlace={canPlace}
                  onPlace={onPlace}
                  onOpen={() => openEntry(item.key)}
                />
              ))}
            </ul>
          )}
          {system && hits.data && found.length === 0 && loose.length === 0 && (
            <p className={styles.muted}>{t('tabletop.noMatches')}</p>
          )}
          {selected.length > 0 && (
            <>
              <h3 className={styles.section}>{t('tabletop.tabs.images')}</h3>
              <ImagesList worldId={worldId} selected={selected} onImage={onImage} />
            </>
          )}
        </>
      )}
      <button
        type="button"
        className={styles.all}
        onClick={() => windows?.open(compendiumWindow(worldId, campaignId, title))}
      >
        {t('tabletop.compendium.openAll')}
      </button>
    </>
  )
}

/** Una entrada: se arrastra al mapa si es una criatura; su nombre la abre en la ventana del compendio */
function Row({
  name,
  detail,
  placing,
  canPlace,
  onPlace,
  onOpen,
  hidden,
  onHidden
}: {
  name: string
  detail: string
  placing: Placing | null
  canPlace: boolean
  onPlace: (placing: Placing) => void
  onOpen?: () => void
  /** Las que están en juego: si la ven los jugadores en su compendio, y el ojo para cambiarlo */
  hidden?: boolean
  onHidden?: (hidden: boolean) => void
}) {
  const { t } = useTranslation()
  const draggable = Boolean(placing) && canPlace
  return (
    <li className={styles.row} draggable={draggable} onDragStart={placing ? dragging(placing) : undefined}>
      <span className={styles.avatar} data-actor={placing ? '' : undefined} aria-hidden="true">
        {initialOf(name)}
      </span>
      {onOpen ? (
        <button type="button" className={styles.name} onClick={onOpen}>
          <b>{name}</b>
          <small>{detail}</small>
        </button>
      ) : (
        <span className={styles.name}>
          <b>{name}</b>
          <small>{detail}</small>
        </span>
      )}
      {onHidden && (
        <button
          type="button"
          className={styles.icon}
          aria-pressed={hidden}
          aria-label={t('inPlay.hideFor', { name })}
          title={t(hidden ? 'inPlay.hiddenNote' : 'inPlay.visibleNote')}
          onClick={() => onHidden(!hidden)}
        >
          {hidden ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
        </button>
      )}
      {placing && (
        <button
          type="button"
          className={styles.icon}
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
