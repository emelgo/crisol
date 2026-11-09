/**
 * La pestaña Compendio de la Mesa, como los compendios de Foundry VTT: una biblioteca de consulta, siempre en carpetas
 * (edición › apartado › tipo › carpeta, las del compendio de la campaña) y, al final, los libros del mundo. Al buscar,
 * lo encontrado sigue en sus carpetas (apartado › tipo). Una entrada se abre en la ventana del compendio; se arrastra al
 * mapa (una criatura), a la pestaña Personajes (una criatura, para tenerla en la campaña) o a una ficha o al grupo (un
 * objeto). Aquí no se cambia nada de la partida: lo de la campaña está en Personajes
 */
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { type DragEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import compendiumStyles from '../campaign/compendium.module.css'
import { Disclosure, type EntryDrag, Library, SystemIdContext } from '../campaign/compendium.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { useSettled } from '../components/settled.ts'
import styles from './compendium-tab.module.css'
import { compendiumWindow } from './compendium-window.tsx'
import { CONTENT_DRAG, type ContentDrag } from './drags.ts'
import { libraryWindow } from './library-window.tsx'
import { PLACING_TYPE } from './panel.tsx'
import { useWindows } from './windows.tsx'

type ContentHit = ActionOutput<'searchCampaignContent'>['items'][number]

const BOOKS = 'libros'

export function CompendiumTab({
  worldId,
  campaignId,
  books = true
}: {
  worldId: string
  campaignId: string
  /** El máster: los libros del mundo (los PDF) y arrastrar a la Mesa y a la campaña */
  books?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const windows = useWindows()
  const [query, setQuery] = useState('')
  const wanted = useSettled(query.trim())
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const compendium = useQuery({
    queryKey: ['compendium', campaignId],
    queryFn: () => api.call('getCampaignCompendium', { campaignId })
  })
  const hits = useQuery({
    queryKey: ['compendium', campaignId, 'search', wanted, 'mesa'],
    queryFn: () => api.call('searchCampaignContent', { campaignId, query: wanted, limit: 120 }),
    enabled: Boolean(compendium.data?.system) && wanted !== ''
  })
  const library = useQuery({
    queryKey: ['library', worldId],
    queryFn: () => api.call('listLibrary', { worldId }),
    enabled: books
  })
  if (!compendium.data)
    return failed(compendium) ? <LoadError error={compendium.error} onRetry={() => compendium.refetch()} /> : null
  const { system, types, sections, world } = compendium.data
  const actors = new Set(types.filter((type) => type.document === 'actor').map((type) => type.key))
  const title = t('tabletop.sidebar.compendium')
  const openEntry = (key: string) => windows?.open(compendiumWindow(worldId, campaignId, title, key))
  const openBook = (fileId: string, name: string) =>
    windows?.open(libraryWindow(worldId, name, { libro: fileId, ...(wanted ? { q: wanted } : {}) }))
  // Lo que lleva el arrastre: al mapa (solo las criaturas) y a la campaña, a una ficha o al grupo
  const drag: EntryDrag = (item) => (event: DragEvent) => {
    const actor = actors.has(item.type)
    const content: ContentDrag = { key: item.key, type: item.type, name: item.name, actor }
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(CONTENT_DRAG, JSON.stringify(content))
    if (actor) event.dataTransfer.setData(PLACING_TYPE, JSON.stringify({ kind: 'content', key: item.key, count: 1 }))
  }
  const toggle = (id: string) =>
    setOpened((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const bookList = (library.data?.books ?? []).filter(
    (book) => !wanted || book.name.toLocaleLowerCase('es').includes(wanted.toLocaleLowerCase('es'))
  )
  const booksFolder = books && bookList.length > 0 && (
    <ul className={compendiumStyles.shelf}>
      <li>
        <Disclosure
          label={t('tabletop.compendium.books')}
          count={bookList.length}
          open={opened.has(BOOKS) || Boolean(wanted)}
          onToggle={() => toggle(BOOKS)}
          edition
        >
          <ul className={compendiumStyles.shelf}>
            {bookList.map((book) => (
              <li key={book.fileId}>
                <button
                  type="button"
                  className={compendiumStyles.entry}
                  onClick={() => openBook(book.fileId, book.name)}
                >
                  <BookOpen size={15} aria-hidden="true" className={styles.bookIcon} />
                  <span className={compendiumStyles.entryName}>{book.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Disclosure>
      </li>
    </ul>
  )
  return (
    <SystemIdContext.Provider value={system?.id ?? null}>
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
      {!system ? (
        <p className={styles.muted}>{t('compendium.noSystem')}</p>
      ) : wanted ? (
        <Found
          hits={hits.data?.items ?? null}
          sections={sections}
          labelOf={(key) => types.find((type) => type.key === key)?.label ?? key}
          drag={drag}
          onOpen={openEntry}
        />
      ) : (
        <Library
          campaignId={campaignId}
          sections={sections}
          types={types}
          layer="all"
          byWorld={world?.byType ?? {}}
          current={null}
          onOpen={openEntry}
          drag={drag}
        />
      )}
      {booksFolder}
      {/* Del máster: lo que se arrastra a la Mesa o a la campaña */}
      {books && <p className={styles.hint}>{t('tabletop.compendium.dragHint')}</p>}
      {/* El compendio entero (con sus ajustes y «Nueva entrada»), en su ventana */}
      <button
        type="button"
        className={styles.all}
        onClick={() => windows?.open(compendiumWindow(worldId, campaignId, title))}
      >
        {t('tabletop.compendium.openAll')}
      </button>
    </SystemIdContext.Provider>
  )
}

/** Lo encontrado, en sus carpetas: apartado › tipo (abiertas) */
function Found({
  hits,
  sections,
  labelOf,
  drag,
  onOpen
}: {
  hits: ContentHit[] | null
  sections: Array<{ key: string; label: string; types: Array<{ key: string; label: string }> }>
  labelOf: (type: string) => string
  drag: EntryDrag
  onOpen: (key: string) => void
}) {
  const { t } = useTranslation()
  if (!hits) return null
  if (hits.length === 0) return <p className={styles.muted}>{t('tabletop.noMatches')}</p>
  const placed = new Set<string>()
  const groups = sections.flatMap((section) => {
    const byType = section.types
      .map((type) => ({ type, items: hits.filter((hit) => hit.type === type.key) }))
      .filter((group) => group.items.length > 0)
    for (const group of byType) placed.add(group.type.key)
    return byType.length > 0 ? [{ section, byType }] : []
  })
  // Lo de un tipo que no está en ningún apartado, al final
  const loose = hits.filter((hit) => !placed.has(hit.type))
  const entry = (hit: ContentHit) => {
    const start = drag({ key: hit.key, type: hit.type, name: hit.name })
    return (
      <li key={hit.key} draggable={Boolean(start)} onDragStart={start ?? undefined}>
        <button type="button" className={compendiumStyles.entry} onClick={() => onOpen(hit.key)}>
          <span className={compendiumStyles.entryName}>{hit.name}</span>
        </button>
      </li>
    )
  }
  return (
    <nav className={compendiumStyles.library} aria-label={t('tabletop.compendium.results')}>
      <ul className={compendiumStyles.shelf}>
        {groups.map(({ section, byType }) => (
          <li key={section.key}>
            <span className={compendiumStyles.folder} data-static="">
              <span className={compendiumStyles.folderName}>{section.label}</span>
              <span className={compendiumStyles.folderCount}>
                {byType.reduce((n, group) => n + group.items.length, 0)}
              </span>
            </span>
            <ul className={compendiumStyles.shelf}>
              {byType.map((group) =>
                byType.length === 1 ? (
                  group.items.map(entry)
                ) : (
                  <li key={group.type.key}>
                    <span className={compendiumStyles.folder} data-static="">
                      <span className={compendiumStyles.folderName}>{group.type.label}</span>
                      <span className={compendiumStyles.folderCount}>{group.items.length}</span>
                    </span>
                    <ul className={compendiumStyles.shelf}>{group.items.map(entry)}</ul>
                  </li>
                )
              )}
            </ul>
          </li>
        ))}
        {loose.length > 0 && (
          <li>
            <span className={compendiumStyles.folder} data-static="">
              <span className={compendiumStyles.folderName}>{labelOf(loose[0]?.type ?? '')}</span>
              <span className={compendiumStyles.folderCount}>{loose.length}</span>
            </span>
            <ul className={compendiumStyles.shelf}>{loose.map(entry)}</ul>
          </li>
        )}
      </ul>
    </nav>
  )
}
