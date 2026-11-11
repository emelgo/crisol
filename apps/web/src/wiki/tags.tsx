import type { TagView } from '@crisol/contracts'
import { tagKey } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Hash, Search, Settings, X } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { NewCard } from '../components/new-card.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { dropMove, type Move, outdentTarget, type TreeNode, type Zone, zoneAt } from '../components/tree/moves.ts'
import cards from '../routes/world-card.module.css'
import { ColorChoices } from '../routes/world-card.tsx'
import { colorHex } from '../routes/world-look.ts'
import files from './files.module.css'
import { useNarrow } from './panel.tsx'
import { useReadAs } from './read-as.tsx'
import styles from './tags.module.css'

/** El color de una etiqueta, para su punto */
export const tagDot = (color: TagView['color']) =>
  ({ '--tag-color': colorHex(color) ?? 'var(--color-muted)' }) as CSSProperties

/** El último tramo de una etiqueta («ciudad» de «lugar/ciudad») y la de arriba («lugar»; «» si no tiene) */
const leafOf = (name: string) => name.split('/').at(-1) ?? name
const parentOf = (name: string) => name.split('/').slice(0, -1).join('/')
const joinTag = (parent: string, leaf: string) => (parent ? `${parent}/${leaf}` : leaf)
const sameTag = (a: string, b: string) => tagKey(a) === tagKey(b)
/** Una etiqueta como elemento del árbol (components/tree): su id es su nombre y su madre, la de arriba */
const nodeOf = (name: string): TreeNode => ({ id: name, parentId: parentOf(name) || null })
/** Cuánto hay que llevarla a la izquierda para sacarla un nivel (como en el árbol de páginas) */
const OUTDENT_STEP = 24

/** «Dentro de»: arriba del todo o una de las etiquetas (sin ella misma ni sus hijas, al cambiarla de sitio) */
function ParentSelect({
  value,
  onChange,
  moving
}: {
  value: string
  onChange: (parent: string) => void
  moving?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const tags = useAccountTags().data?.tags ?? []
  const choices = tags.filter(
    (tag) => !moving || (!sameTag(tag.name, moving) && !tagKey(tag.name).startsWith(`${tagKey(moving)}/`))
  )
  return (
    <div className={form.field}>
      <label htmlFor={id}>{t('tags.parent')}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="">{t('tags.top')}</option>
        {choices.map((tag) => (
          <option key={tag.name} value={tag.name}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Las etiquetas de la cuenta (ADR-0006), para quien las ve: el catálogo, que también usan los filtros */
export function useAccountTags(enabled = true) {
  const api = useApi()
  return useQuery({ queryKey: ['tags'], queryFn: () => api.call('listAccountTags', {}), enabled })
}

/** El color de una etiqueta puesta, por su nombre (sin mirar mayúsculas); sin catálogo aún, ninguno */
export function useTagColor() {
  // Las etiquetas son de la cuenta del máster: leyendo desde una campaña, sin colores
  const tags = useAccountTags(!useReadAs())
  return (name: string) => tags.data?.tags.find((tag) => tagKey(tag.name) === tagKey(name))?.color ?? null
}

/** Una etiqueta puesta: su nombre con su punto de color */
export function TagChip({ name, color }: { name: string; color: TagView['color'] }) {
  return (
    <span className={styles.chip} style={tagDot(color)}>
      {name}
    </span>
  )
}

const TAG = /^[^\s/]+(\/[^\s/]+)*$/u

/**
 * Las etiquetas de algo (un archivo): las puestas, que se quitan con su ×, y un campo para añadir otra, con las de la
 * cuenta como sugerencias; una que no está se crea sola (ADR-0006). Cada cambio se guarda al momento
 */
export function TagsField({
  value,
  onChange,
  disabled = false,
  label,
  hideLabel = false,
  id,
  onPending
}: {
  value: readonly string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  /** Sin él, «Etiquetas» */
  label?: string
  /** Solo para los lectores de pantalla (en una fila de propiedades, el nombre ya lo dice) */
  hideLabel?: boolean
  id?: string
  /**
   * Lo escrito aún sin poner, para quien lo guarda con lo demás (las propiedades): así no se pone al salir del campo
   * (moverlo todo justo al pulsar «Guardar» haría fallar el clic)
   */
  onPending?: (text: string) => void
}) {
  const { t } = useTranslation()
  const tags = useAccountTags()
  const colorOf = useTagColor()
  const ownId = useId()
  const inputId = id ?? ownId
  const listId = useId()
  const [draft, setOwnDraft] = useState('')
  const setDraft = (text: string) => {
    setOwnDraft(text)
    onPending?.(text)
  }
  // Una o varias, separadas por comas; con la forma del catálogo si ya están, y sin repetir
  const add = (raw: string) => {
    setDraft('')
    const next = [...value]
    for (const part of raw.split(',')) {
      const name = part.trim().replace(/\s/g, '').replace(/^#/, '')
      if (!TAG.test(name) || next.some((tag) => tagKey(tag) === tagKey(name))) continue
      next.push(tags.data?.tags.find((tag) => tagKey(tag.name) === tagKey(name))?.name ?? name)
    }
    if (next.length > value.length) onChange(next)
  }
  return (
    <div className={hideLabel ? styles.fieldInline : styles.field}>
      <label htmlFor={inputId} className={hideLabel ? styles.hidden : undefined}>
        {label ?? t('tags.label')}
      </label>
      {value.length > 0 && (
        <ul className={styles.chips} aria-label={label ?? t('tags.label')}>
          {value.map((tag) => (
            <li key={tag} className={styles.chip} style={tagDot(colorOf(tag))}>
              {tag}
              <button
                type="button"
                className={styles.unchip}
                aria-label={t('tags.remove', { name: tag })}
                disabled={disabled}
                onClick={() => onChange(value.filter((other) => other !== tag))}
              >
                <X aria-hidden="true" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        list={listId}
        value={draft}
        placeholder={t('tags.add')}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => {
          const next = event.currentTarget.value
          // Elegida de las sugerencias: se pone ya
          const picked = (event.nativeEvent as InputEvent).inputType === 'insertReplacementText'
          if (picked) add(next)
          else setDraft(next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add(draft)
          }
        }}
        onBlur={() => !onPending && draft.trim() && add(draft)}
      />
      <datalist id={listId}>
        {(tags.data?.tags ?? [])
          .filter((tag) => !value.some((other) => tagKey(other) === tagKey(tag.name)))
          .map((tag) => (
            <option key={tag.name} value={tag.name} />
          ))}
      </datalist>
    </div>
  )
}

/** Antes, cada mundo tenía las suyas: ahora son de la cuenta */
export function WorldTagsRedirect() {
  return <Navigate to="/etiquetas" replace />
}

/**
 * Las etiquetas de la cuenta, en la zona de Mis mundos: en árbol (las hijas, «lugar/ciudad», bajo su madre), con
 * cuántas páginas y archivos las llevan; al pasar el ratón, en qué mundos. Se crean con la fila discontinua del final
 * y, desde su engranaje, se renombran, se les pone color y se borran
 */
export function AccountTags() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const tags = useAccountTags(Boolean(account))
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  useEffect(() => setHovered(null), [query])
  const api = useApi()
  const announce = useAnnounce()
  const errorText = useErrorText()
  // Arrastrar, como en el árbol de páginas: una raya delante o detrás de una fila, o la fila resaltada si va dentro;
  // llevada a la izquierda, sale de su madre
  const [dragging, setDragging] = useState<string | null>(null)
  const dragStartX = useRef(0)
  const [drop, setDrop] = useState<{ name: string; zone: Zone; level?: number } | null>(null)
  const [received, setReceived] = useState<string | null>(null)
  const move = useMutation({
    mutationFn: async ({ tag, to }: { tag: string; to: Move }) => {
      const moved = await api.call('moveTag', {
        tag,
        parent: to.parentId,
        ...(to.before ? { before: to.before } : {}),
        ...(to.after ? { after: to.after } : {})
      })
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
      return moved
    },
    onSuccess: (moved) => {
      setReceived(moved.name)
      announce(t('tags.moved', { name: moved.name }))
    },
    onError: (error) => announce(errorText(error))
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tags'] })
  const wanted = query.trim().toLocaleLowerCase('es')
  const all = tags.data?.tags ?? []
  const shown = wanted ? all.filter((tag) => tag.name.toLocaleLowerCase('es').includes(wanted)) : all
  const detail = shown.find((tag) => tag.name === hovered)
  // Cada fila, con su nivel y su puesto entre sus hermanas: para saber adónde sale al llevarla a la izquierda
  const rows = shown.map((tag) => {
    const siblings = shown.filter((other) => sameTag(parentOf(other.name), parentOf(tag.name)))
    return {
      tag,
      level: tag.depth + 1,
      posinset: siblings.indexOf(tag) + 1,
      setsize: siblings.length,
      expanded: shown.some((other) => sameTag(parentOf(other.name), tag.name))
    }
  })
  const rowOf = (name: string) => rows.find((row) => sameTag(row.tag.name, name))
  /** Adónde iría la que se arrastra al soltarla en esa fila (y la fila a la que sale, si se lleva a la izquierda) */
  const dropAt = (name: string, zone: Zone, clientX: number) => {
    const row = rowOf(name)
    if (!dragging || !row) return null
    const out = outdentTarget(
      row,
      (r) => nodeOf(r.tag.name),
      rowOf,
      zone,
      Math.floor((dragStartX.current - clientX) / OUTDENT_STEP),
      dragging
    )
    const to = dropMove(
      nodeOf(dragging),
      nodeOf(name),
      zone,
      (id) => parentOf(id) || null,
      out ? nodeOf(out.tag.name) : null
    )
    // Dentro de su propia madre (sin delante ni detrás): ya está ahí
    if (to && !to.before && !to.after && sameTag(to.parentId ?? '', parentOf(dragging))) return null
    return to ? { to, level: out?.level } : null
  }
  return (
    <section className={files.page}>
      <div className={files.layout}>
        <div className={files.center}>
          <PageTitle>{t('tags.title')}</PageTitle>
          <div className={files.tools}>
            <label className={files.search} data-tour="etiquetas-buscar">
              <Search aria-hidden="true" size={16} />
              <input
                type="search"
                value={query}
                placeholder={t('tags.search')}
                aria-label={t('tags.search')}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
          </div>
          {failed(tags) && <LoadError error={tags.error} onRetry={() => tags.refetch()} />}
          {tags.data && (
            <>
              {all.length === 0 ? (
                <p className={files.empty}>{t('tags.empty')}</p>
              ) : (
                shown.length === 0 && <p className={files.empty}>{t('tags.noResults')}</p>
              )}
              <ul className={files.rows} aria-label={t('tags.title')} data-tour="etiquetas-lista">
                {shown.map((tag) => (
                  <TagRow
                    key={tag.name}
                    tag={tag}
                    indent={!wanted}
                    movable={!wanted}
                    drop={drop && sameTag(drop.name, tag.name) ? drop : null}
                    received={received !== null && sameTag(received, tag.name)}
                    onDrag={(on, x) => {
                      setDragging(on ? tag.name : null)
                      dragStartX.current = x
                      setDrop(null)
                      setReceived(null)
                    }}
                    onDragOver={(zone, clientX) => {
                      const at = dropAt(tag.name, zone, clientX)
                      setDrop(
                        at
                          ? {
                              name: tag.name,
                              zone: at.level ? 'after' : zone,
                              ...(at.level ? { level: at.level } : {})
                            }
                          : null
                      )
                      return at !== null
                    }}
                    onDrop={(zone, clientX) => {
                      const at = dropAt(tag.name, zone, clientX)
                      if (dragging && at) move.mutate({ tag: dragging, to: at.to })
                      setDragging(null)
                      setDrop(null)
                    }}
                    onPreview={(on) => setHovered((current) => (on ? tag.name : current === tag.name ? null : current))}
                    onChanged={refresh}
                  />
                ))}
                {/* «Nueva etiqueta», una fila más tras la última, vacía (docs/diseno.md) */}
                <li className={styles.newItem}>
                  <NewTag onCreated={refresh} />
                </li>
              </ul>
            </>
          )}
        </div>
        <aside className={files.detail} aria-label={t('tags.detail')}>
          {detail && <TagDetail key={detail.name} tag={detail} />}
        </aside>
      </div>
      {tags.data && (
        <Tour
          id="etiquetas"
          steps={[
            { target: '[data-tour="etiquetas-nueva"]', text: t('tour.tags.create') },
            { target: '[data-tour="etiquetas-lista"]', text: t('tour.tags.list') },
            { target: '[data-tour="etiquetas-buscar"]', text: t('tour.tags.search') }
          ]}
        />
      )}
    </section>
  )
}

/** Cuántas páginas y archivos: «3 páginas · 1 archivo», o «Sin usar» */
function useUses() {
  const { t } = useTranslation()
  return (tag: TagView) => {
    const parts = [
      tag.pages > 0 ? t('tags.count', { count: tag.pages }) : '',
      tag.files > 0 ? t('tags.files', { count: tag.files }) : ''
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : t('tags.unused')
  }
}

function TagRow({
  tag,
  indent,
  movable,
  drop,
  received,
  onDrag,
  onDragOver,
  onDrop,
  onPreview,
  onChanged
}: {
  tag: TagView
  /** En árbol (sin buscar): la hija, con sangría y solo su último tramo */
  indent: boolean
  /** Se puede arrastrar (en árbol, con ratón) */
  movable: boolean
  /** Mientras se arrastra otra encima: dónde caería (delante, dentro o detrás) y, si sale de su madre, a qué nivel */
  drop: { zone: Zone; level?: number } | null
  /** Acaba de moverse: se ilumina un momento */
  received: boolean
  /** Empieza o acaba de arrastrarse (con dónde estaba el puntero al empezar) */
  onDrag: (dragging: boolean, x: number) => void
  /** Pasa otra por encima: devuelve si puede soltarse ahí */
  onDragOver: (zone: Zone, clientX: number) => boolean
  onDrop: (zone: Zone, clientX: number) => void
  onPreview: (shown: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const uses = useUses()
  const name = indent && tag.depth > 0 ? tag.name.split('/').at(-1) : tag.name
  // En el móvil (sin ratón que pase por encima), tocarla sube su hoja: lo que es y sus ajustes
  const narrow = useNarrow()
  const [open, setOpen] = useState<'sheet' | 'settings' | null>(null)
  return (
    <li
      className={`${files.row} ${styles.tagRow} ${received ? files.received : ''}`}
      style={
        {
          ...(indent ? { paddingInlineStart: `calc(${tag.depth} * 1.5rem + var(--space-2))` } : {}),
          // La raya empieza en el nivel donde cae: el de la fila o, si sale de su madre, el de fuera
          '--drop-indent': `calc(${drop?.level ? drop.level - 1 : indent ? tag.depth : 0} * 1.5rem)`
        } as CSSProperties
      }
      data-drop={drop?.zone}
      draggable={movable && !narrow}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', tag.name)
        onDrag(true, event.clientX)
      }}
      onDragEnd={(event) => onDrag(false, event.clientX)}
      onDragOver={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        if (!onDragOver(zoneAt((event.clientY - box.top) / (box.height || 1)), event.clientX)) return
        event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const box = event.currentTarget.getBoundingClientRect()
        onDrop(zoneAt((event.clientY - box.top) / (box.height || 1)), event.clientX)
      }}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      <span className={styles.dot} style={tagDot(tag.color)} aria-hidden="true" />
      <span className={files.rowText}>
        {narrow ? (
          <button
            type="button"
            className={`${files.rowName} ${files.open} ${styles.name}`}
            aria-haspopup="dialog"
            onClick={() => setOpen('sheet')}
          >
            {name}
          </button>
        ) : (
          <span className={styles.name}>{name}</span>
        )}
      </span>
      <span className={`${files.rowMeta} ${styles.usesAside}`}>{uses(tag)}</span>
      <TagSettings tag={tag} onChanged={onChanged} />
      {open === 'sheet' && (
        <Modal
          aria-label={tag.name}
          className={`${dialogStyles.dialog} ${files.sheet}`}
          onClose={() => setOpen((current) => (current === 'sheet' ? null : current))}
        >
          <TagDetail tag={tag} />
          <div className={files.sheetActions}>
            <button
              type="button"
              className={`${form.button} ${files.sheetSecondary}`}
              onClick={() => setOpen('settings')}
            >
              <Settings aria-hidden="true" size={16} />
              {t('tags.settings')}
            </button>
          </div>
        </Modal>
      )}
      {open === 'settings' && <TagDialog tag={tag} onChanged={onChanged} onClose={() => setOpen(null)} />}
    </li>
  )
}

/** La etiqueta bajo el ratón: su nombre entero, su color y dónde se usa */
function TagDetail({ tag }: { tag: TagView }) {
  const { t } = useTranslation()
  return (
    <div className={files.detailBody}>
      <div className={`${files.preview} ${styles.big}`} style={tagDot(tag.color)}>
        <Hash aria-hidden="true" size={48} strokeWidth={1.25} />
      </div>
      <h2 className={files.detailName}>{tag.name}</h2>
      <dl className={files.facts}>
        <dt>{t('tags.pagesLabel')}</dt>
        <dd>{tag.pages}</dd>
        <dt>{t('tags.filesLabel')}</dt>
        <dd>{tag.files}</dd>
        {tag.worlds.length > 0 && (
          <>
            <dt>{t('tags.inWorlds')}</dt>
            <dd>
              {tag.worlds
                .map((world) => `${world.name} (${world.pages})`)
                .sort((a, b) => a.localeCompare(b, 'es'))
                .join(' · ')}
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}

function NewTag({ onCreated }: { onCreated: () => Promise<unknown> }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const [color, setColor] = useState<TagView['color']>(null)
  const create = useMutation({
    mutationFn: async () => {
      await api.call('createTag', { name: joinTag(parent, name.trim()), color })
      await onCreated()
    },
    onSuccess: () => dialog.current?.close()
  })
  return (
    <>
      <NewCard
        ref={trigger}
        shape="row"
        label={t('tags.new')}
        aria-haspopup="dialog"
        data-tour="etiquetas-nueva"
        onClick={() => {
          setName('')
          setParent('')
          setColor(null)
          create.reset()
          setOpen(true)
        }}
      />
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={dialogStyles.dialog}
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
        >
          <form
            className={dialogStyles.body}
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate()
            }}
          >
            <h2 id={titleId}>{t('tags.new')}</h2>
            {/* El nombre, sin espacios ni «/»: dónde va se elige en «Dentro de» */}
            <Field
              label={t('tags.name')}
              value={name}
              required
              maxLength={100}
              autoComplete="off"
              data-autofocus=""
              onChange={(event) => setName(event.currentTarget.value.replace(/[\s/]/g, ''))}
            />
            <ParentSelect value={parent} onChange={setParent} />
            <ColorChoices value={color} onChange={setColor} />
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton type="submit" className={form.button} busy={create.isPending}>
                {t('tags.create')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('tags.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/** El engranaje de una etiqueta: abre su ventana */
function TagSettings({ tag, onChanged }: { tag: TagView; onChanged: () => Promise<unknown> }) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={files.smallGear}
        aria-label={t('tags.settingsOf', { name: tag.name })}
        title={t('tags.settingsOf', { name: tag.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {open && (
        <TagDialog
          tag={tag}
          onChanged={onChanged}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/** La ventana de una etiqueta: su nombre (con la ruta), su color y borrarla. onClose(gone): si se borró */
function TagDialog({
  tag,
  onChanged,
  onClose
}: {
  tag: TagView
  onChanged: () => Promise<unknown>
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [leaf, setLeaf] = useState(leafOf(tag.name))
  const [parent, setParent] = useState(parentOf(tag.name))
  const [color, setColor] = useState(tag.color)
  const name = joinTag(parent, leaf.trim())
  const changed = name !== tag.name || color !== tag.color
  const save = useMutation({
    mutationFn: async () => {
      await api.call('updateTag', {
        tag: tag.name,
        ...(name !== tag.name ? { name } : {}),
        ...(color !== tag.color ? { color } : {})
      })
      await onChanged()
    },
    onSuccess: () => dialog.current?.close()
  })
  const remove = async () => {
    await api.call('deleteTag', { tag: tag.name })
    gone.current = true
    dialog.current?.close()
    await onChanged()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <div className={`${files.preview} ${styles.big}`} style={tagDot(color)}>
        <Hash aria-hidden="true" size={48} strokeWidth={1.25} />
      </div>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) save.mutate()
        }}
      >
        <h2 id={titleId}>{t('tags.settingsOf', { name: tag.name })}</h2>
        <Field
          label={t('tags.name')}
          value={leaf}
          required
          maxLength={100}
          autoComplete="off"
          onChange={(event) => setLeaf(event.currentTarget.value.replace(/[\s/]/g, ''))}
        />
        {/* Cambiarla de sitio, también con el teclado (en la lista, arrastrándola) */}
        <ParentSelect value={parent} onChange={setParent} moving={tag.name} />
        <ColorChoices value={color} onChange={setColor} />
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('tags.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setLeaf(leafOf(tag.name))
              setParent(parentOf(tag.name))
              setColor(tag.color)
            }}
          >
            {t('tags.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={tag.name}
            action={t('tags.delete')}
            title={t('tags.deleteTitle', { name: tag.name })}
            warning={t('tags.deleteWarning')}
            label={t('tags.name')}
            typed={false}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}
