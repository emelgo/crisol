/**
 * El panel de bloques de una página (ADR-0008), como el de LegendKeeper y el de Everlore: datos de toda la página al lado
 * del texto. Se guarda entero con setPagePanel; los clics seguidos (estrellas, fichas, + y −) van juntos
 */
import { type Page, type PanelBlock, WORLD_COLORS } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  GripVertical,
  Hash,
  Image as ImageIcon,
  ListPlus,
  ListTree,
  Minus,
  Plus,
  RectangleHorizontal,
  Star,
  Tag,
  Trash2,
  Type
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { colorHex, PRESET_COLORS } from '../routes/world-look.ts'
import { useWorldFiles } from './cover.tsx'
import styles from './panel-blocks.module.css'
import { childrenKey } from './tree.tsx'

type Kind = 'text' | 'image' | 'bar' | 'circle' | 'rating' | 'tokens' | 'subpages' | 'tagged'

const GROUPS: { group: 'notes' | 'meters' | 'lists'; kinds: { kind: Kind; icon: ReactNode }[] }[] = [
  {
    group: 'notes',
    kinds: [
      { kind: 'text', icon: <Type size={16} aria-hidden="true" /> },
      { kind: 'image', icon: <ImageIcon size={16} aria-hidden="true" /> }
    ]
  },
  {
    group: 'meters',
    kinds: [
      { kind: 'bar', icon: <RectangleHorizontal size={16} aria-hidden="true" /> },
      { kind: 'circle', icon: <Circle size={16} aria-hidden="true" /> },
      { kind: 'rating', icon: <Star size={16} aria-hidden="true" /> },
      { kind: 'tokens', icon: <CircleDot size={16} aria-hidden="true" /> }
    ]
  },
  {
    group: 'lists',
    kinds: [
      { kind: 'subpages', icon: <ListTree size={16} aria-hidden="true" /> },
      { kind: 'tagged', icon: <Tag size={16} aria-hidden="true" /> }
    ]
  }
]

/** Un id corto, como pide el contrato */
const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join('')

function blockOf(kind: Kind): PanelBlock {
  const id = newId()
  switch (kind) {
    case 'text':
      return { id, type: 'text', title: '', text: '' }
    case 'image':
      return { id, type: 'image', fileId: null, caption: '' }
    case 'bar':
    case 'circle':
      return { id, type: 'meter', title: '', style: kind, value: 0, max: 10, color: 'wine' }
    case 'rating':
      return { id, type: 'rating', title: '', value: 0, max: 5 }
    case 'tokens':
      return { id, type: 'tokens', title: '', value: 0, max: 5, color: 'sea' }
    case 'subpages':
      return { id, type: 'subpages', title: '' }
    case 'tagged':
      return { id, type: 'tagged', title: '', tag: '' }
  }
}

const kindOf = (block: PanelBlock): Kind => (block.type === 'meter' ? block.style : block.type)

const same = (a: readonly PanelBlock[], b: readonly PanelBlock[]) => JSON.stringify(a) === JSON.stringify(b)

export function PanelBlocks({
  page,
  onAddProperty
}: {
  page: Page
  /** Las etiquetas y las propiedades son de la página (no bloques): se añaden en su ficha, de arriba */
  onAddProperty?: (kind: 'tags' | 'property') => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const root = useRef<HTMLDivElement>(null)
  const [blocks, setBlocks] = useState<PanelBlock[]>(page.panel)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<PanelBlock[] | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  // Los guardados van en fila (uno detrás de otro, en orden); mientras quede alguno, lo de fuera no pisa lo de aquí
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const inFlight = useRef(0)
  const [error, setError] = useState<unknown>(null)
  const pageId = page.id
  const worldId = page.worldId
  const send = useRef((next: PanelBlock[]) => {
    inFlight.current++
    queue.current = queue.current
      .then(() => api.call('setPagePanel', { pageId, blocks: next }))
      .then(
        () => setError(null),
        (failure: unknown) => setError(failure)
      )
      .finally(() => {
        inFlight.current--
        if (!inFlight.current) void queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
      })
  }).current
  // Lo que llega de fuera (otra pestaña, la IA) entra si no se está tocando aquí
  useEffect(() => {
    if (inFlight.current || pending.current || root.current?.contains(document.activeElement)) return
    setBlocks((current) => (same(current, page.panel) ? current : page.panel))
  }, [page.panel])
  // Al irse, lo que faltase por guardar se guarda
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current) send(pending.current)
    },
    [send]
  )
  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    pending.current = null
    if (next) send(next)
  }
  /** Cambia los bloques; se guarda enseguida o, si son clics seguidos, al parar */
  const commit = (next: PanelBlock[], soon = false) => {
    setBlocks(next)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    if (soon) timer.current = setTimeout(flush, 600)
    else flush()
  }
  const update = (id: string, patch: Partial<PanelBlock>, soon = false) =>
    commit(
      blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as PanelBlock) : block)),
      soon
    )
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    commit(next)
  }
  const add = (kind: Kind) => {
    const block = blockOf(kind)
    commit([...blocks, block])
    setFocusId(block.id)
  }

  return (
    <div ref={root} className={styles.panel}>
      {blocks.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t('panelBlocks.empty')}</p>
          <p>{t('panelBlocks.emptyHint')}</p>
        </div>
      )}
      {blocks.map((block, index) => (
        <BlockFrame
          key={block.id}
          page={page}
          block={block}
          index={index}
          count={blocks.length}
          autoFocus={focusId === block.id}
          dragging={dragging === index}
          onDragStart={() => setDragging(index)}
          onDragEnd={() => setDragging(null)}
          onDrop={() => {
            if (dragging !== null) move(dragging, index)
            setDragging(null)
          }}
          onMove={(to) => move(index, to)}
          onRemove={() => commit(blocks.filter((b) => b.id !== block.id))}
          onChange={(patch, soon) => update(block.id, patch, soon)}
        />
      ))}
      <AddBlock onAdd={add} onAddProperty={onAddProperty} />
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
}

/** Un desplegable con su botón: pulsar fuera o Escape lo cierran (y el foco vuelve al botón) */
function usePopover() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])
  return { open, setOpen, root, trigger }
}

function AddBlock({
  onAdd,
  onAddProperty
}: {
  onAdd: (kind: Kind) => void
  onAddProperty?: ((kind: 'tags' | 'property') => void) | undefined
}) {
  const { t } = useTranslation()
  const { open, setOpen, root, trigger } = usePopover()
  const menuId = useId()
  return (
    <div ref={root} className={styles.addWrap}>
      <button
        ref={trigger}
        type="button"
        className={styles.add}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
      >
        <Plus size={14} aria-hidden="true" />
        {t('panelBlocks.add')}
      </button>
      {open && (
        <div id={menuId} className={styles.picker}>
          {/* Lo de la página: sus etiquetas y sus propiedades */}
          {onAddProperty && (
            <div className={styles.pickerGroup}>
              <p>{t('panelBlocks.groups.data')}</p>
              <ul>
                {(['tags', 'property'] as const).map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onAddProperty(kind)
                      }}
                    >
                      {kind === 'tags' ? (
                        <Hash size={16} aria-hidden="true" />
                      ) : (
                        <ListPlus size={16} aria-hidden="true" />
                      )}
                      {t(`panelBlocks.kinds.${kind}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {GROUPS.map(({ group, kinds }) => (
            <div key={group} className={styles.pickerGroup}>
              <p>{t(`panelBlocks.groups.${group}`)}</p>
              <ul>
                {kinds.map(({ kind, icon }) => (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onAdd(kind)
                      }}
                    >
                      {icon}
                      {t(`panelBlocks.kinds.${kind}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Change = (patch: Partial<PanelBlock>, soon?: boolean) => void

function BlockFrame({
  page,
  block,
  index,
  count,
  autoFocus,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onRemove,
  onChange
}: {
  page: Page
  block: PanelBlock
  index: number
  count: number
  autoFocus: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
  onMove: (to: number) => void
  onRemove: () => void
  onChange: Change
}) {
  const { t } = useTranslation()
  const kind = kindOf(block)
  const name = ('title' in block && block.title) || t(`panelBlocks.kinds.${kind}`)
  const [over, setOver] = useState(false)
  return (
    <section
      className={styles.block}
      aria-label={name}
      data-dragging={dragging || undefined}
      data-over={over || undefined}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        onDrop()
      }}
    >
      <div className={styles.blockHead}>
        {/* Los seis puntos: se arrastran para mover el bloque y, al pulsarlos, sus opciones (como en el texto) */}
        <BlockMenu
          name={name}
          block={block}
          index={index}
          count={count}
          onMove={onMove}
          onRemove={onRemove}
          onChange={onChange}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        {'title' in block ? (
          <TitleField
            value={block.title}
            placeholder={t(`panelBlocks.kinds.${kind}`)}
            autoFocus={autoFocus}
            onCommit={(title) => onChange({ title })}
          />
        ) : (
          <span className={styles.kindLabel}>{t(`panelBlocks.kinds.${kind}`)}</span>
        )}
      </div>
      <BlockBody page={page} block={block} onChange={onChange} />
    </section>
  )
}

/** Un campo que se guarda al salir de él (o con Intro) */
function TitleField({
  value,
  placeholder,
  autoFocus,
  onCommit
}: {
  value: string
  placeholder: string
  autoFocus: boolean
  onCommit: (value: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className={styles.title}
      value={draft}
      placeholder={placeholder}
      aria-label={t('panelBlocks.title')}
      maxLength={80}
      // biome-ignore lint/a11y/noAutofocus: el bloque recién añadido, para ponerle nombre
      autoFocus={autoFocus}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft.trim() !== value) onCommit(draft.trim())
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

function BlockMenu({
  name,
  block,
  index,
  count,
  onMove,
  onRemove,
  onChange,
  onDragStart,
  onDragEnd
}: {
  name: string
  block: PanelBlock
  index: number
  count: number
  onMove: (to: number) => void
  onRemove: () => void
  onChange: Change
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const { t } = useTranslation()
  const { open, setOpen, root, trigger } = usePopover()
  const menuId = useId()
  const maxId = useId()
  const tagId = useId()
  return (
    <div ref={root} className={styles.menuWrap}>
      <button
        ref={trigger}
        type="button"
        className={styles.grip}
        draggable
        aria-label={t('panelBlocks.options', { name })}
        title={t('panelBlocks.gripHint')}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        onDragStart={(event) => {
          setOpen(false)
          event.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          {(block.type === 'meter' || block.type === 'rating' || block.type === 'tokens') && (
            <div className={styles.field}>
              <label htmlFor={maxId}>{t('panelBlocks.max')}</label>
              <input
                id={maxId}
                type="number"
                min={1}
                max={block.type === 'meter' ? 9999 : block.type === 'rating' ? 10 : 30}
                defaultValue={block.max}
                onBlur={(event) => {
                  const limit = block.type === 'meter' ? 9999 : block.type === 'rating' ? 10 : 30
                  const max = Math.min(limit, Math.max(1, Math.round(Number(event.currentTarget.value) || 1)))
                  if (max !== block.max) onChange({ max, value: Math.min(block.value, max) })
                }}
              />
            </div>
          )}
          {block.type === 'meter' && (
            <fieldset className={styles.choice}>
              <legend>{t('panelBlocks.style')}</legend>
              {(['bar', 'circle'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={block.style === style}
                  onClick={() => onChange({ style })}
                >
                  {t(`panelBlocks.kinds.${style}`)}
                </button>
              ))}
            </fieldset>
          )}
          {(block.type === 'meter' || block.type === 'tokens') && (
            <fieldset className={styles.swatches}>
              <legend>{t('panelBlocks.color')}</legend>
              {WORLD_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-pressed={block.color === color}
                  aria-label={t(`worlds.colors.${color}`)}
                  title={t(`worlds.colors.${color}`)}
                  style={{ background: PRESET_COLORS[color] }}
                  onClick={() => onChange({ color })}
                />
              ))}
            </fieldset>
          )}
          {block.type === 'tagged' && (
            <div className={styles.field}>
              <label htmlFor={tagId}>{t('panelBlocks.tag')}</label>
              <input
                id={tagId}
                defaultValue={block.tag}
                maxLength={200}
                onBlur={(event) => {
                  const tag = event.currentTarget.value.trim().replace(/^#/, '')
                  if (tag !== block.tag) onChange({ tag })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            </div>
          )}
          <div className={styles.menuActions}>
            <button type="button" disabled={index === 0} onClick={() => onMove(index - 1)}>
              <ChevronUp size={14} aria-hidden="true" />
              {t('panelBlocks.up')}
            </button>
            <button type="button" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
              <ChevronDown size={14} aria-hidden="true" />
              {t('panelBlocks.down')}
            </button>
            <button type="button" className={styles.danger} onClick={onRemove}>
              <Trash2 size={14} aria-hidden="true" />
              {t('panelBlocks.remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BlockBody({ page, block, onChange }: { page: Page; block: PanelBlock; onChange: Change }) {
  switch (block.type) {
    case 'text':
      return <TextBody value={block.text} onCommit={(text) => onChange({ text })} />
    case 'image':
      return <ImageBody page={page} fileId={block.fileId} caption={block.caption} onChange={onChange} />
    case 'meter':
      return block.style === 'bar' ? (
        <BarBody block={block} onChange={onChange} />
      ) : (
        <CircleBody block={block} onChange={onChange} />
      )
    case 'rating':
      return <RatingBody block={block} onChange={onChange} />
    case 'tokens':
      return <TokensBody block={block} onChange={onChange} />
    case 'subpages':
      return <SubpagesBody page={page} />
    case 'tagged':
      return <TaggedBody page={page} tag={block.tag} />
  }
}

function TextBody({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <textarea
      className={styles.text}
      value={draft}
      rows={2}
      maxLength={5000}
      placeholder={t('panelBlocks.textPlaceholder')}
      aria-label={t('panelBlocks.kinds.text')}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
    />
  )
}

function ImageBody({
  page,
  fileId,
  caption,
  onChange
}: {
  page: Page
  fileId: string | null
  caption: string
  onChange: Change
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const files = useWorldFiles(page.worldId)
  const upload = useRef<HTMLInputElement>(null)
  const selectId = useId()
  const [draft, setDraft] = useState(caption)
  useEffect(() => setDraft(caption), [caption])
  const images = files.data?.files.filter((file) => file.kind === 'image') ?? []
  const file = fileId ? images.find((f) => f.id === fileId) : undefined
  const send = useMutation({
    mutationFn: async (chosen: File) => {
      const stored = await api.uploadFile({ worldId: page.worldId, name: chosen.name }, chosen)
      await queryClient.invalidateQueries({ queryKey: ['files', page.worldId] })
      if (stored.kind === 'image') onChange({ fileId: stored.id })
    }
  })
  if (file) {
    return (
      <figure className={styles.figure}>
        <img src={file.url} alt={caption || file.name} />
        <input
          className={styles.caption}
          value={draft}
          placeholder={t('panelBlocks.caption')}
          aria-label={t('panelBlocks.caption')}
          maxLength={200}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => {
            if (draft.trim() !== caption) onChange({ caption: draft.trim() })
          }}
        />
      </figure>
    )
  }
  return (
    <div className={styles.imagePick}>
      <label htmlFor={selectId} className={styles.visuallyHidden}>
        {t('panelBlocks.chooseImage')}
      </label>
      <select id={selectId} value="" onChange={(event) => onChange({ fileId: event.currentTarget.value || null })}>
        <option value="">{t('panelBlocks.noImage')}</option>
        {images.map((image) => (
          <option key={image.id} value={image.id}>
            {image.name}
          </option>
        ))}
      </select>
      <button type="button" className={styles.link} onClick={() => upload.current?.click()}>
        {t('panelBlocks.upload')}
      </button>
      <input
        ref={upload}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (chosen) send.mutate(chosen)
        }}
      />
      <FormError message={send.error ? errorText(send.error) : null} />
    </div>
  )
}

type Meter = Extract<PanelBlock, { type: 'meter' }>

/** − valor / máximo + */
function Stepper({ block, onChange }: { block: Meter; onChange: Change }) {
  const { t } = useTranslation()
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.icon}
        aria-label={t('panelBlocks.less')}
        disabled={block.value <= 0}
        onClick={() => onChange({ value: block.value - 1 }, true)}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className={styles.count}>
        {block.value} / {block.max}
      </span>
      <button
        type="button"
        className={styles.icon}
        aria-label={t('panelBlocks.more')}
        disabled={block.value >= block.max}
        onClick={() => onChange({ value: block.value + 1 }, true)}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

const hex = (color: Meter['color']) => colorHex(color) ?? PRESET_COLORS.wine

function BarBody({ block, onChange }: { block: Meter; onChange: Change }) {
  const { t } = useTranslation()
  const share = block.max ? block.value / block.max : 0
  return (
    <div className={styles.meter}>
      {/* Pulsar en la barra la deja hasta ahí */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: con el teclado, los botones − y + */}
      {/* biome-ignore lint/a11y/useSemanticElements: <meter> no deja pintar la barra con el color del bloque */}
      <div
        className={styles.track}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={block.max}
        aria-valuenow={block.value}
        aria-valuetext={t('panelBlocks.value', { value: block.value, max: block.max })}
        aria-label={block.title || t('panelBlocks.kinds.bar')}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const value = Math.round(((event.clientX - box.left) / box.width) * block.max)
          onChange({ value: Math.min(block.max, Math.max(0, value)) }, true)
        }}
      >
        <span style={{ inlineSize: `${share * 100}%`, background: hex(block.color) }} />
      </div>
      <Stepper block={block} onChange={onChange} />
    </div>
  )
}

function CircleBody({ block, onChange }: { block: Meter; onChange: Change }) {
  const { t } = useTranslation()
  const share = block.max ? block.value / block.max : 0
  const length = 2 * Math.PI * 40
  return (
    <div className={styles.circle}>
      {/* biome-ignore lint/a11y/useSemanticElements: un anillo dibujado; <meter> no sirve */}
      <svg
        viewBox="0 0 100 100"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={block.max}
        aria-valuenow={block.value}
        aria-valuetext={t('panelBlocks.value', { value: block.value, max: block.max })}
        aria-label={block.title || t('panelBlocks.kinds.circle')}
      >
        <circle cx="50" cy="50" r="40" className={styles.ring} />
        <circle
          cx="50"
          cy="50"
          r="40"
          className={styles.ringFill}
          style={{ stroke: hex(block.color) }}
          strokeDasharray={`${share * length} ${length}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central">
          {Math.round(share * 100)}%
        </text>
      </svg>
      <Stepper block={block} onChange={onChange} />
    </div>
  )
}

function RatingBody({ block, onChange }: { block: Extract<PanelBlock, { type: 'rating' }>; onChange: Change }) {
  const { t } = useTranslation()
  return (
    <div className={styles.stars}>
      {Array.from({ length: block.max }, (_, i) => {
        const count = i + 1
        const fill = block.value >= count ? 'full' : block.value >= count - 0.5 ? 'half' : 'none'
        return (
          <button
            key={count}
            type="button"
            data-fill={fill}
            aria-label={t('panelBlocks.star', { count, max: block.max })}
            aria-pressed={block.value >= count - 0.5}
            // Pulsar la última encendida la deja a media; otra vez, apagada
            onClick={() =>
              onChange(
                { value: block.value === count ? count - 0.5 : block.value === count - 0.5 ? count - 1 : count },
                true
              )
            }
          >
            <Star size={20} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

function TokensBody({ block, onChange }: { block: Extract<PanelBlock, { type: 'tokens' }>; onChange: Change }) {
  const { t } = useTranslation()
  return (
    <div className={styles.tokens} style={{ '--token': hex(block.color) } as CSSProperties}>
      {Array.from({ length: block.max }, (_, i) => {
        const count = i + 1
        return (
          <button
            key={count}
            type="button"
            aria-pressed={block.value >= count}
            aria-label={t('panelBlocks.token', { count, max: block.max })}
            onClick={() => onChange({ value: block.value >= count ? count - 1 : count }, true)}
          />
        )
      })}
    </div>
  )
}

function SubpagesBody({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const children = useQuery({
    queryKey: childrenKey(page.worldId, page.id),
    queryFn: () => api.call('listPageChildren', { worldId: page.worldId, parentId: page.id })
  })
  const list = children.data?.pages ?? []
  if (children.data && list.length === 0) return <p className={styles.muted}>{t('panelBlocks.noSubpages')}</p>
  return (
    <ul className={styles.pages}>
      {list.map((child) => (
        <li key={child.id}>
          <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId: page.worldId, pageId: child.id }}>
            {child.icon && <span aria-hidden="true">{child.icon} </span>}
            {child.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TaggedBody({ page, tag }: { page: Page; tag: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const names = useQuery({
    queryKey: ['pages', page.worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId: page.worldId }),
    enabled: Boolean(tag)
  })
  if (!tag) return <p className={styles.muted}>{t('panelBlocks.chooseTag')}</p>
  const wanted = tag.toLocaleLowerCase('es')
  const found = (names.data?.pages ?? []).filter(
    (p) =>
      p.id !== page.id &&
      p.tags.some((each) => {
        const own = each.toLocaleLowerCase('es')
        return own === wanted || own.startsWith(`${wanted}/`)
      })
  )
  return (
    <>
      <p className={styles.tagChip}>#{tag}</p>
      {names.data && found.length === 0 ? (
        <p className={styles.muted}>{t('panelBlocks.noTagged')}</p>
      ) : (
        <ul className={styles.pages}>
          {found.map((p) => (
            <li key={p.id}>
              <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId: page.worldId, pageId: p.id }}>
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
