/**
 * Los paneles y las barras de las herramientas de la mesa (tablero Herramientas del lienzo «Crisol: la mesa»): junto a
 * la columna, lo de la herramienta (la forma de medir y «Dejar como plantilla», los colores, el grosor y la goma, los
 * sellos, lo del máster); a la derecha, su panel (las plantillas con sus fichas de dentro, la regla de las diagonales y
 * «La tele ve lo que mides»; los dibujos; los pines; las imágenes). Y el campo donde se escribe un texto nuevo
 */
import type { MarkView, SceneView, TokenView } from '@crisol/contracts'
import type { Point, Viewport } from '@crisol/tabletop'
import { useQuery } from '@tanstack/react-query'
import {
  Circle,
  Eraser,
  Eye,
  EyeOff,
  ImageIcon,
  MapPin,
  Pencil,
  Pin,
  Slash,
  Square,
  Stamp,
  Trash2,
  Triangle,
  Type
} from 'lucide-react'
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { useWorldFiles } from '../wiki/cover-look.ts'
import { PageLink } from '../wiki/read-as.tsx'
import { STAMP_ICONS, StampGlyph, type StampIcon } from './marks-layer.tsx'
import mesaStyles from './mesa.module.css'
import styles from './tools.module.css'
import { DAMAGE_TYPES, MARK_COLORS, newTextSize, type TemplateShape, templateSize } from './tools.ts'
import { DRAW_WIDTHS, type DrawTool, type DrawWidth, type MarkTool, type TableTools } from './use-table-tools.ts'
import visionStyles from './vision.module.css'
import { Confirm, Segments, Switch } from './vision-panel.tsx'

const SHAPE_ICONS: Record<TemplateShape, ReactNode> = {
  line: <Slash aria-hidden="true" size={15} />,
  circle: <Circle aria-hidden="true" size={15} />,
  cone: <Triangle aria-hidden="true" size={15} style={{ transform: 'rotate(90deg)' }} />,
  square: <Square aria-hidden="true" size={15} />
}

const DRAW_ICONS: Record<DrawTool, ReactNode> = {
  pen: <Pencil aria-hidden="true" size={15} />,
  line: <Slash aria-hidden="true" size={15} />,
  rectangle: <Square aria-hidden="true" size={15} />,
  circle: <Circle aria-hidden="true" size={15} />,
  eraser: <Eraser aria-hidden="true" size={15} />
}

const COLOR_NAMES = ['red', 'gold', 'blue', 'white'] as const

/** Los colores de lo nuevo, en una fila */
function Swatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className={styles.swatches}>
      <legend className={mesaStyles.hidden}>{t('tools.color')}</legend>
      {MARK_COLORS.map((color, i) => (
        <label
          key={color}
          className={styles.swatch}
          style={{ background: color }}
          title={t(`tools.colors.${COLOR_NAMES[i] ?? 'red'}`)}
        >
          <input
            type="radio"
            name={name}
            checked={value === color}
            aria-label={t(`tools.colors.${COLOR_NAMES[i] ?? 'red'}`)}
            onChange={() => onChange(color)}
          />
        </label>
      ))}
    </fieldset>
  )
}

/** «Solo para mí»: lo nuevo no llega a la tele */
function SecretToggle({ tools }: { tools: TableTools }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className={styles.toggleButton}
      aria-pressed={tools.secret}
      title={t('tools.secretHint')}
      onClick={() => tools.setSecret(!tools.secret)}
    >
      {tools.secret ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
      {t('tools.secret')}
    </button>
  )
}

/** El tipo de daño de una plantilla (su trama) */
function DamageSelect({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const { t } = useTranslation()
  return (
    <select
      className={visionStyles.select}
      aria-label={t('tools.damageType')}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{t('tools.noDamage')}</option>
      {Object.keys(DAMAGE_TYPES).map((type) => (
        <option key={type} value={type}>
          {t(`tools.damage.${type as keyof typeof DAMAGE_TYPES}`)}
        </option>
      ))}
    </select>
  )
}

/** La barra de la herramienta, junto a la columna */
export function ToolBar({ tool, tools }: { tool: MarkTool; tools: TableTools }) {
  const { t } = useTranslation()
  const [stamps, setStamps] = useState(false)
  if (tool === 'measure' || tool === 'template')
    return (
      <div className={visionStyles.subtools} role="toolbar" aria-label={t(`tools.${tool}`)}>
        <Segments
          label={t('tools.shape')}
          value={tools.shape}
          options={(['line', 'circle', 'cone', 'square'] as const).map((value) => ({
            value,
            label: t(`tools.shapes.${value}`),
            icon: SHAPE_ICONS[value]
          }))}
          onChange={tools.setShape}
        />
        {tool === 'measure' ? (
          <>
            <button
              type="button"
              className={visionStyles.ghost}
              disabled={!tools.measured || tools.measured.points.length < 2}
              onClick={tools.keepAsTemplate}
            >
              <Pin aria-hidden="true" size={15} />
              {t('tools.keep')}
            </button>
            {tools.shape === 'line' && <span className={styles.hint}>{t('tools.lineHint')}</span>}
          </>
        ) : (
          <>
            <Swatches value={tools.color} onChange={tools.setColor} />
            <DamageSelect value={tools.damageType} onChange={tools.setDamageType} />
            <SecretToggle tools={tools} />
          </>
        )}
      </div>
    )
  if (tool === 'draw')
    return (
      <div className={visionStyles.subtools} role="toolbar" aria-label={t('tools.draw')}>
        <Segments
          label={t('tools.drawTool')}
          value={tools.drawTool}
          options={(['pen', 'line', 'rectangle', 'circle', 'eraser'] as const).map((value) => ({
            value,
            label: t(`tools.drawTools.${value}`),
            icon: DRAW_ICONS[value]
          }))}
          onChange={tools.setDrawTool}
        />
        <Swatches value={tools.color} onChange={tools.setColor} />
        <select
          className={visionStyles.select}
          aria-label={t('tools.width')}
          value={tools.drawWidth}
          onChange={(event) => tools.setDrawWidth(event.target.value as DrawWidth)}
        >
          {(Object.keys(DRAW_WIDTHS) as DrawWidth[]).map((width) => (
            <option key={width} value={width}>
              {t(`tools.widths.${width}`)}
            </option>
          ))}
        </select>
        <SecretToggle tools={tools} />
      </div>
    )
  if (tool === 'text')
    return (
      <div className={visionStyles.subtools} role="toolbar" aria-label={t('tools.text')}>
        <Swatches value={tools.color} onChange={tools.setColor} />
        <SecretToggle tools={tools} />
      </div>
    )
  if (tool === 'stamp')
    return (
      <div className={visionStyles.subtools} role="toolbar" aria-label={t('tools.stamp')}>
        <button type="button" className={styles.toggleButton} aria-expanded={stamps} onClick={() => setStamps(!stamps)}>
          <span className={styles.stampPreview}>
            <StampGlyph icon={tools.stamp.icon} size={16} />
          </span>
          {t('tools.stamps')}
        </button>
        <SecretToggle tools={tools} />
        {stamps && <StampPicker tools={tools} onPicked={() => setStamps(false)} />}
      </div>
    )
  if (tool === 'image')
    return (
      <div className={visionStyles.subtools} role="toolbar" aria-label={t('tools.image')}>
        <SecretToggle tools={tools} />
      </div>
    )
  return null
}

/** Los sellos para elegir: los de Lucide */
function StampPicker({ tools, onPicked }: { tools: TableTools; onPicked: () => void }) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className={styles.stamps}>
      <legend className={mesaStyles.hidden}>{t('tools.stamps')}</legend>
      {(Object.keys(STAMP_ICONS) as StampIcon[]).map((icon) => (
        <label key={icon} title={t(`tools.stampNames.${icon}`)}>
          <input
            type="radio"
            name={name}
            checked={tools.stamp.icon === icon && !tools.stamp.fileId}
            aria-label={t(`tools.stampNames.${icon}`)}
            onChange={() => {
              tools.setStamp({ icon, fileId: null })
              onPicked()
            }}
          />
          <StampGlyph icon={icon} size={18} />
        </label>
      ))}
    </fieldset>
  )
}

/** El campo de un texto nuevo, donde se pulsó: Intro lo deja, Escape lo deja estar */
export function TextInput({ tools, view, scene }: { tools: TableTools; view: Viewport; scene: SceneView }) {
  const { t } = useTranslation()
  const box = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const at = tools.writing as Point
  useLayoutEffect(() => box.current?.focus(), [])
  const commit = () => {
    const value = text.trim()
    tools.setWriting(null)
    if (!value) return
    tools.add(
      {
        kind: 'text',
        x: at.x,
        y: at.y,
        text: value,
        color: tools.color,
        size: newTextSize(scene.grid),
        hidden: tools.secret
      },
      false
    )
  }
  return (
    <input
      ref={box}
      className={styles.textInput}
      style={{ left: at.x * view.scale + view.x, top: at.y * view.scale + view.y, color: tools.color }}
      aria-label={t('tools.newText')}
      placeholder={t('tools.newText')}
      value={text}
      maxLength={500}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') {
          event.stopPropagation()
          tools.setWriting(null)
        }
      }}
    />
  )
}

/** El panel de la derecha de una herramienta (null si no tiene) */
export function ToolsPanel({
  tool,
  tools,
  scene,
  worldId,
  tokens,
  onChoose
}: {
  tool: MarkTool
  tools: TableTools
  scene: SceneView
  worldId: string
  tokens: TokenView[]
  /** Elegir las fichas de dentro de una plantilla, para hacerles daño */
  onChoose: (tokenIds: string[]) => void
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const title =
    tool === 'measure' || tool === 'template'
      ? t('tools.templates')
      : tool === 'pin'
        ? t('tools.pins')
        : tool === 'image'
          ? t('tools.images')
          : t('tools.drawings')
  return (
    <aside className={mesaStyles.panel} aria-label={title}>
      <div className={visionStyles.body}>
        <h2 className={visionStyles.title}>{title}</h2>
        {(tool === 'measure' || tool === 'template') && (
          <TemplatesPanel tools={tools} scene={scene} tokens={tokens} onChoose={onChoose} />
        )}
        {(tool === 'draw' || tool === 'text' || tool === 'stamp') && <DrawingsPanel tools={tools} />}
        {tool === 'pin' && <PinsPanel tools={tools} worldId={worldId} />}
        {tool === 'image' && <ImagesPanel tools={tools} worldId={worldId} />}
        <FormError message={tools.error ? errorText(tools.error) : null} />
      </div>
    </aside>
  )
}

/** Mostrar u ocultar en la tele y quitar: los botones de una fila */
function RowActions({ mark, tools, label }: { mark: MarkView; tools: TableTools; label: string }) {
  const { t } = useTranslation()
  return (
    <>
      <button
        type="button"
        className={styles.icon}
        aria-pressed={!mark.hidden}
        aria-label={t('tools.onScreenOf', { name: label })}
        title={t(mark.hidden ? 'tools.onlyYou' : 'tools.onScreen')}
        onClick={() => tools.change.mutate({ update: [{ id: mark.id, hidden: !mark.hidden }] })}
      >
        {mark.hidden ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-label={t('tools.removeOf', { name: label })}
        title={t('tools.remove')}
        onClick={() => {
          tools.change.mutate({ remove: [mark.id] })
          if (tools.selected?.id === mark.id) tools.setSelected(null)
        }}
      >
        <Trash2 aria-hidden="true" size={15} />
      </button>
    </>
  )
}

function TemplatesPanel({
  tools,
  scene,
  tokens,
  onChoose
}: {
  tools: TableTools
  scene: SceneView
  tokens: TokenView[]
  onChoose: (tokenIds: string[]) => void
}) {
  const { t } = useTranslation()
  const templates = tools.marks.filter((m): m is Extract<MarkView, { kind: 'template' }> => m.kind === 'template')
  const nameOf = (mark: Extract<MarkView, { kind: 'template' }>) =>
    t('tools.templateName', { shape: t(`tools.shapes.${mark.shape}`), size: templateSize(mark, scene.grid) })
  const selected = tools.selected?.kind === 'template' ? tools.selected : null
  const inside = selected ? tokens.filter((token) => tools.targets.includes(token.id)) : []
  return (
    <>
      {templates.length === 0 && <span className={visionStyles.stat}>{t('tools.noTemplates')}</span>}
      <ul className={styles.rows} aria-label={t('tools.templates')}>
        {templates.map((mark) => (
          <li key={mark.id}>
            <div className={styles.row} data-selected={mark.id === selected?.id || undefined}>
              <span className={styles.rowIcon} style={{ color: mark.color }}>
                {SHAPE_ICONS[mark.shape]}
              </span>
              <button
                type="button"
                className={styles.rowName}
                aria-pressed={mark.id === selected?.id}
                onClick={() => tools.setSelected(mark.id === selected?.id ? null : mark.id)}
              >
                {nameOf(mark)}
                {mark.damageType && mark.damageType in DAMAGE_TYPES && (
                  <small>{t(`tools.damage.${mark.damageType as keyof typeof DAMAGE_TYPES}`)}</small>
                )}
              </button>
              <RowActions mark={mark} tools={tools} label={nameOf(mark)} />
            </div>
            {mark.id === selected?.id && (
              <section className={visionStyles.selected} aria-label={nameOf(mark)}>
                <div className={styles.inside}>
                  <span>{t('tools.inside', { count: inside.length })}</span>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={inside.length === 0}
                    onClick={() => onChoose(inside.map((token) => token.id))}
                  >
                    {t('tools.choose')}
                  </button>
                </div>
                {inside.length > 0 && (
                  <span className={visionStyles.stat}>{inside.map((token) => token.label).join(', ')}</span>
                )}
                <Swatches
                  value={mark.color}
                  onChange={(color) => tools.change.mutate({ update: [{ id: mark.id, set: { color } }] })}
                />
                <DamageSelect
                  value={mark.damageType ?? null}
                  onChange={(damageType) => tools.change.mutate({ update: [{ id: mark.id, set: { damageType } }] })}
                />
              </section>
            )}
          </li>
        ))}
      </ul>
      <label className={visionStyles.field}>
        <span>{t('tools.diagonals')}</span>
        <select
          className={visionStyles.select}
          value={scene.grid.diagonals}
          onChange={(event) => tools.setDiagonals.mutate(event.target.value as 'equal' | 'alternate' | 'euclidean')}
        >
          {(['equal', 'alternate', 'euclidean'] as const).map((rule) => (
            <option key={rule} value={rule}>
              {t(`tools.rules.${rule}`)}
            </option>
          ))}
        </select>
      </label>
      <Switch checked={tools.measureOnScreen} onChange={(on) => tools.setMeasureOnScreen.mutate(on)}>
        {t('tools.measureOnScreen')}
      </Switch>
    </>
  )
}

function DrawingsPanel({ tools }: { tools: TableTools }) {
  const { t } = useTranslation()
  const [clearing, setClearing] = useState(false)
  const drawings = tools.marks.filter((m) => m.kind === 'drawing')
  const texts = tools.marks.filter((m): m is Extract<MarkView, { kind: 'text' }> => m.kind === 'text')
  const stamps = tools.marks.filter((m) => m.kind === 'stamp')
  const all = [...drawings, ...texts, ...stamps]
  return (
    <>
      {all.length === 0 && <span className={visionStyles.stat}>{t('tools.noDrawings')}</span>}
      <ul className={styles.rows} aria-label={t('tools.drawings')}>
        {drawings.length > 0 && (
          <li className={styles.row}>
            <span className={styles.rowIcon}>
              <Pencil aria-hidden="true" size={15} />
            </span>
            <span className={styles.rowText}>{t('tools.strokes', { count: drawings.length })}</span>
          </li>
        )}
        {texts.map((mark) => (
          <li key={mark.id} className={styles.row} data-selected={tools.selected?.id === mark.id || undefined}>
            <span className={styles.rowIcon}>
              <Type aria-hidden="true" size={15} />
            </span>
            <button type="button" className={styles.rowName} onClick={() => tools.setSelected(mark.id)}>
              {mark.text}
            </button>
            <RowActions mark={mark} tools={tools} label={mark.text} />
          </li>
        ))}
        {stamps.length > 0 && (
          <li className={styles.row}>
            <span className={styles.rowIcon}>
              <Stamp aria-hidden="true" size={15} />
            </span>
            <span className={styles.rowText}>{t('tools.stampCount', { count: stamps.length })}</span>
          </li>
        )}
      </ul>
      {all.length > 0 && (
        <button
          type="button"
          className={`${visionStyles.ghost} ${visionStyles.start}`}
          onClick={() => setClearing(true)}
        >
          <Trash2 aria-hidden="true" size={15} />
          {t('tools.clearDrawings')}
        </button>
      )}
      {clearing && (
        <Confirm
          title={t('tools.clearDrawings')}
          text={t('tools.clearText')}
          confirm={t('tools.clearConfirm')}
          onConfirm={() => tools.change.mutate({ remove: all.map((mark) => mark.id) })}
          onClose={() => setClearing(false)}
        />
      )}
    </>
  )
}

function PinsPanel({ tools, worldId }: { tools: TableTools; worldId: string }) {
  const { t } = useTranslation()
  const pins = tools.marks.filter((m): m is Extract<MarkView, { kind: 'pin' }> => m.kind === 'pin')
  const selected = tools.selected?.kind === 'pin' ? tools.selected : null
  return (
    <>
      {pins.length === 0 && <span className={visionStyles.stat}>{t('tools.noPins')}</span>}
      <ul className={styles.rows} aria-label={t('tools.pins')}>
        {pins.map((pin) => (
          <li key={pin.id}>
            <div className={styles.row} data-selected={pin.id === selected?.id || undefined}>
              <span className={styles.rowIcon}>
                <MapPin aria-hidden="true" size={15} />
              </span>
              <button
                type="button"
                className={styles.rowName}
                aria-pressed={pin.id === selected?.id}
                onClick={() => tools.setSelected(pin.id === selected?.id ? null : pin.id)}
              >
                {pin.label || t('tools.pin')}
              </button>
              <RowActions mark={pin} tools={tools} label={pin.label || t('tools.pin')} />
            </div>
            {pin.id === selected?.id && <PinSettings key={pin.version} pin={pin} tools={tools} worldId={worldId} />}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Un pin elegido: su rótulo y la página a la que lleva (una que ya hay, por su título) */
function PinSettings({
  pin,
  tools,
  worldId
}: {
  pin: Extract<MarkView, { kind: 'pin' }>
  tools: TableTools
  worldId: string
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const pages = names.data?.pages ?? []
  const page = pages.find((each) => each.id === pin.pageId) ?? null
  const [label, setLabel] = useState(pin.label)
  const [title, setTitle] = useState(page?.title ?? '')
  useEffect(() => setTitle(page?.title ?? ''), [page?.title])
  const save = (set: Record<string, unknown>) => tools.change.mutate({ update: [{ id: pin.id, set }] })
  const commitPage = () => {
    const key = title.trim().toLocaleLowerCase('es')
    if (!key) return pin.pageId && save({ pageId: null })
    const found = pages.find((each) => each.title.toLocaleLowerCase('es') === key)
    if (found && found.id !== pin.pageId) save({ pageId: found.id })
    else if (!found) setTitle(page?.title ?? '')
  }
  return (
    <section className={visionStyles.selected} aria-label={pin.label || t('tools.pin')}>
      <label className={visionStyles.field}>
        <span>{t('tools.pinLabel')}</span>
        <input
          className={visionStyles.input}
          value={label}
          maxLength={60}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => label.trim() !== pin.label && save({ label: label.trim() })}
          onKeyDown={(event) => event.key === 'Enter' && label.trim() !== pin.label && save({ label: label.trim() })}
        />
      </label>
      <label className={visionStyles.field}>
        <span>{t('tools.pinPage')}</span>
        <input
          className={visionStyles.input}
          list={`${id}-pages`}
          value={title}
          placeholder={t('tools.noPage')}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitPage}
          onKeyDown={(event) => event.key === 'Enter' && commitPage()}
        />
        <datalist id={`${id}-pages`}>
          {pages.map((each) => (
            <option key={each.id} value={each.title} />
          ))}
        </datalist>
      </label>
      {pin.pageId && (
        <PageLink worldId={worldId} pageId={pin.pageId} className={styles.noteLink}>
          {t('tools.openPage')}
        </PageLink>
      )}
    </section>
  )
}

function ImagesPanel({ tools, worldId }: { tools: TableTools; worldId: string }) {
  const { t } = useTranslation()
  const files = useWorldFiles(worldId)
  const images = (files.data?.files ?? []).filter((file) => file.kind === 'image')
  const selected = tools.selected?.kind === 'image' ? tools.selected : null
  const arm = (file: { id: string; url: string }) => {
    const probe = new Image()
    probe.onload = () =>
      tools.setArmedImage({ fileId: file.id, url: file.url, width: probe.naturalWidth, height: probe.naturalHeight })
    probe.onerror = () => tools.setArmedImage({ fileId: file.id, url: file.url, width: 1, height: 1 })
    probe.src = file.url
    tools.setArmedImage({ fileId: file.id, url: file.url, width: 1, height: 1 })
  }
  return (
    <>
      {selected && (
        <section className={visionStyles.selected} aria-label={t('tools.selectedImage')}>
          <b>{t('tools.selectedImage')}</b>
          <Switch
            checked={selected.above ?? false}
            onChange={(above) => tools.change.mutate({ update: [{ id: selected.id, set: { above } }] })}
          >
            {t('tools.above')}
          </Switch>
          <Switch
            checked={!selected.hidden}
            onChange={(shown) => tools.change.mutate({ update: [{ id: selected.id, hidden: !shown }] })}
          >
            {t('tools.onScreen')}
          </Switch>
          <button
            type="button"
            className={`${visionStyles.ghost} ${visionStyles.start}`}
            onClick={() => {
              tools.change.mutate({ remove: [selected.id] })
              tools.setSelected(null)
            }}
          >
            <Trash2 aria-hidden="true" size={15} />
            {t('tools.remove')}
          </button>
        </section>
      )}
      <span className={visionStyles.stat}>{t(tools.armedImage ? 'tools.placeImage' : 'tools.pickImage')}</span>
      {images.length === 0 && files.data && <span className={visionStyles.stat}>{t('tools.noImages')}</span>}
      <ul className={mesaStyles.images} aria-label={t('tools.worldImages')}>
        {images.map((file) => (
          <li key={file.id}>
            <button type="button" aria-pressed={tools.armedImage?.fileId === file.id} onClick={() => arm(file)}>
              {file.url ? <img src={file.url} alt="" loading="lazy" /> : <ImageIcon aria-hidden="true" size={20} />}
              <span>{file.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
