/**
 * La pestaña Actores del máster (Enrique, 2026-11-10): un solo buscador para personajes y criaturas en juego y carpetas
 * para agruparlos, como en Foundry. Se arrastra uno sobre una carpeta para meterlo, y a «Sin carpeta» para sacarlo; desde
 * dentro de una carpeta se sigue arrastrando al mapa
 */
import type { CampaignTableView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Folder, FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { type DragEvent, type FormEvent, type ReactNode, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import styles from './actor-folders.module.css'
import { CampaignCreatures } from './campaign-creatures.tsx'
import mesa from './mesa.module.css'
import { CharactersList, PLACING_TYPE, type Placing, SearchBox } from './panel.tsx'

type Kind = 'character' | 'creature'

export const actorFoldersKey = (campaignId: string) => ['actorFolders', campaignId]

/** Lo que se arrastra desde una fila (un personaje o una criatura), si es eso */
function draggedActor(event: DragEvent): { kind: Kind; id: string } | null {
  try {
    const placing = JSON.parse(event.dataTransfer.getData(PLACING_TYPE)) as Placing
    return placing.kind === 'character' || placing.kind === 'creature' ? { kind: placing.kind, id: placing.id } : null
  } catch {
    return null
  }
}

/** Un sitio donde soltar un personaje o una criatura */
function useDrop(onDrop: (actor: { kind: Kind; id: string }) => void) {
  const [over, setOver] = useState(false)
  return {
    over,
    props: {
      onDragOver: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes(PLACING_TYPE)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      },
      onDragLeave: (event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      },
      onDrop: (event: DragEvent) => {
        setOver(false)
        const actor = draggedActor(event)
        if (!actor) return
        event.preventDefault()
        onDrop(actor)
      }
    }
  }
}

const openKey = (folderId: string) => `crisol.mesa.carpeta.${folderId}`
const wasOpen = (folderId: string) => {
  try {
    return localStorage.getItem(openKey(folderId)) !== 'cerrada'
  } catch {
    return true
  }
}

export function ActorsTab({
  campaignId,
  systemId,
  table,
  canPlace,
  onPlace,
  onOpenCharacter,
  children
}: {
  campaignId: string
  systemId: string | null
  table: CampaignTableView | null
  canPlace: boolean
  onPlace: (placing: Placing) => void
  onOpenCharacter: (character: { id: string; name: string }) => void
  /** Lo que va debajo (las imágenes elegidas, la leyenda) */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const key = actorFoldersKey(campaignId)
  const folders = useQuery({ queryKey: key, queryFn: () => api.call('listActorFolders', { campaignId }) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const create = useMutation({
    mutationFn: (folderName: string) => api.call('createActorFolder', { campaignId, name: folderName }),
    onSuccess: () => {
      setNaming(false)
      setName('')
      void refresh()
    }
  })
  const move = useMutation({
    mutationFn: (input: { kind: Kind; id: string; folderId: string | null }) =>
      api.call('moveToActorFolder', { campaignId, ...input }),
    onSuccess: () => void refresh()
  })
  const items = folders.data?.items ?? []
  const folderOf = (kind: Kind, id: string) => items.find((item) => item.kind === kind && item.id === id)?.folderId
  const loose = useDrop((actor) => move.mutate({ ...actor, folderId: null }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() && !create.isPending) create.mutate(name.trim())
  }
  const lists = (folderId: string | null, quiet: boolean) => (
    <>
      <CharactersList
        campaignId={campaignId}
        table={table}
        canPlace={canPlace}
        onPlace={onPlace}
        query={query}
        include={(id) => (folderOf('character', id) ?? null) === folderId}
        quiet={quiet}
        onOpen={onOpenCharacter}
      />
      {quiet ? null : <h3 className={mesa.tabSection}>{t('tabletop.campaignCreatures.title')}</h3>}
      <CampaignCreatures
        campaignId={campaignId}
        systemId={systemId}
        table={table}
        canPlace={canPlace}
        onPlace={onPlace}
        query={query}
        include={(id) => (folderOf('creature', id) ?? null) === folderId}
        quiet={quiet}
      />
    </>
  )
  const error = create.error ?? move.error
  return (
    <>
      <div className={styles.top}>
        <SearchBox value={query} onChange={setQuery} label={t('tabletop.searchActors')} />
        <button
          type="button"
          className={styles.newFolder}
          aria-label={t('actorFolders.new')}
          title={t('actorFolders.new')}
          onClick={() => setNaming(true)}
        >
          <FolderPlus size={17} aria-hidden="true" />
        </button>
      </div>
      {naming && (
        <form className={styles.naming} onSubmit={submit}>
          <Folder size={15} aria-hidden="true" />
          <input
            // biome-ignore lint/a11y/noAutofocus: se acaba de pedir una carpeta nueva
            autoFocus
            value={name}
            maxLength={80}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            placeholder={t('actorFolders.name')}
            aria-label={t('actorFolders.name')}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setNaming(false)
            }}
            onBlur={() => {
              if (!name.trim()) setNaming(false)
            }}
          />
        </form>
      )}
      {(folders.data?.folders ?? []).map((folder) => (
        <FolderGroup
          key={folder.id}
          campaignId={campaignId}
          folder={folder}
          onDrop={(actor) => move.mutate({ ...actor, folderId: folder.id })}
          onChanged={() => void refresh()}
        >
          {lists(folder.id, true)}
        </FolderGroup>
      ))}
      <div className={loose.over ? `${styles.loose} ${styles.over}` : styles.loose} {...loose.props}>
        {(folders.data?.folders.length ?? 0) > 0 && <h3 className={mesa.tabSection}>{t('actorFolders.loose')}</h3>}
        <h3 className={mesa.tabSection}>{t('tabletop.tabs.characters')}</h3>
        {lists(null, false)}
      </div>
      <FormError message={error ? errorText(error) : null} />
      {children}
    </>
  )
}

function FolderGroup({
  campaignId,
  folder,
  onDrop,
  onChanged,
  children
}: {
  campaignId: string
  folder: { id: string; name: string }
  onDrop: (actor: { kind: Kind; id: string }) => void
  onChanged: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const [open, setOpenState] = useState(() => wasOpen(folder.id))
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(folder.name)
  const button = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setMenu(false), [])
  useDismiss(menu, close, box, button)
  const drop = useDrop(onDrop)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try {
      localStorage.setItem(openKey(folder.id), next ? 'abierta' : 'cerrada')
    } catch {
      // Sin almacenamiento, solo mientras dure la pestaña
    }
  }
  const rename = useMutation({
    mutationFn: (next: string) => api.call('renameActorFolder', { campaignId, folderId: folder.id, name: next }),
    onSuccess: () => {
      setRenaming(false)
      onChanged()
    }
  })
  const remove = useMutation({
    mutationFn: () => api.call('deleteActorFolder', { campaignId, folderId: folder.id }),
    onSuccess: onChanged
  })
  return (
    <section className={drop.over ? `${styles.folder} ${styles.over}` : styles.folder} {...drop.props}>
      <div className={styles.head}>
        {renaming ? (
          <form
            className={styles.naming}
            onSubmit={(event) => {
              event.preventDefault()
              if (name.trim()) rename.mutate(name.trim())
            }}
          >
            <Folder size={15} aria-hidden="true" />
            <input
              // biome-ignore lint/a11y/noAutofocus: se acaba de pedir cambiarle el nombre
              autoFocus
              value={name}
              maxLength={80}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              aria-label={t('actorFolders.name')}
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setRenaming(false)
              }}
              onBlur={() => setRenaming(false)}
            />
          </form>
        ) : (
          <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronRight size={14} aria-hidden="true" className={styles.chevron} />
            <Folder size={15} aria-hidden="true" />
            <span>{folder.name}</span>
          </button>
        )}
        <span className={styles.menuWrap}>
          <button
            ref={button}
            type="button"
            className={styles.dots}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t('actorFolders.actionsOf', { name: folder.name })}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </button>
          {menu && (
            <div ref={box} className={styles.menu} role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  setName(folder.name)
                  setRenaming(true)
                }}
              >
                <Pencil size={14} aria-hidden="true" />
                {t('actorFolders.rename')}
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.danger}
                onClick={() => {
                  close()
                  remove.mutate()
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                {t('actorFolders.delete')}
              </button>
            </div>
          )}
        </span>
      </div>
      {open && (
        <div className={styles.inside} data-empty={t('actorFolders.empty')}>
          {children}
        </div>
      )}
    </section>
  )
}
