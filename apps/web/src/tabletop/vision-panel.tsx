/**
 * Los paneles de la visión en la mesa del máster (tablero Visión del lienzo «Crisol: la mesa»): muros y puertas (qué
 * se dibuja, el muro elegido y lo que trae el mapa), luces (la oscuridad y la luz elegida), la niebla (visión
 * automática, destapar o tapar todo, reiniciarla, ver como el grupo y los bordes de la tele) y lo que ve el grupo.
 * Encima del mapa, la barra de la niebla a mano y el aviso de «Viendo como el grupo»
 */
import {
  type LightView,
  type Restriction,
  type SceneSoundView,
  type TokenView,
  WALL_PRESETS,
  type WallView
} from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { Brush, Eye, EyeOff, Lasso, RotateCcw, Square, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionInput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import { Modal } from '../components/modal.tsx'
import { playlistsKey } from '../sound/sound-tab.tsx'
import { useSound } from '../sound/use-table-sound.tsx'
import { cssDisc } from './draw.ts'
import mesaStyles from './mesa.module.css'
import { initialOf } from './tokens.ts'
import styles from './vision.module.css'
import type { FogMode, FogShape, Vision } from './vision.tsx'
import { DRAW_KINDS, type DrawKind, drawKindOf, WALL_COLORS, wallInputFor, wallStats } from './walls.ts'

export type VisionPanelMode = 'walls' | 'lights' | 'sounds' | 'fog' | 'group'

type ActionWallPatch = NonNullable<NonNullable<ActionInput<'changeWalls'>['walls']>['update']>[number]

const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/** La muestra de cada tipo en «Dibujar» (como el lienzo) */
const KIND_SWATCH: Record<DrawKind, string> = {
  wall: css(WALL_COLORS.wall),
  door: css(WALL_COLORS.door),
  secret: css(WALL_COLORS.secret),
  window: css(WALL_COLORS.window),
  invisible: `repeating-linear-gradient(90deg, ${css(WALL_COLORS.invisible)} 0 3px, transparent 3px 6px)`,
  low: css(WALL_COLORS.low),
  object: css(WALL_COLORS.object),
  oneWay: `linear-gradient(90deg, ${css(WALL_COLORS.wall)} 60%, ${css(WALL_COLORS.oneWay)} 60%)`
}

const LIGHT_COLORS = [
  ['fire', '#ffb04a'],
  ['candle', '#ffe0a0'],
  ['moon', '#b8d0ff'],
  ['arcane', '#c39bff'],
  ['green', '#7cf0a4'],
  ['white', '#ffffff']
] as const
const ANGLES = [360, 180, 120, 90, 60] as const

export function VisionPanel({
  mode,
  vision,
  tokens,
  notSeen,
  onAsGroup
}: {
  mode: VisionPanelMode
  vision: Vision
  tokens: TokenView[]
  notSeen: readonly string[]
  onAsGroup: () => void
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const title =
    mode === 'walls'
      ? t('vision.walls')
      : mode === 'lights'
        ? t('vision.lights')
        : mode === 'sounds'
          ? t('vision.sounds')
          : mode === 'fog'
            ? t('vision.fog')
            : t('vision.groupTitle')
  return (
    <aside className={mesaStyles.panel} aria-label={title}>
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {mode === 'walls' && <WallsPanel vision={vision} />}
        {mode === 'lights' && <LightsPanel vision={vision} />}
        {mode === 'sounds' && <SoundsPanel vision={vision} />}
        {mode === 'fog' && <FogPanel vision={vision} onAsGroup={onAsGroup} />}
        {mode === 'group' && <GroupPanel vision={vision} tokens={tokens} notSeen={notSeen} />}
        <FormError message={vision.error ? errorText(vision.error) : null} />
      </div>
    </aside>
  )
}

/** Un interruptor (como los del lienzo) */
export function Switch({
  checked,
  onChange,
  children
}: {
  checked: boolean
  onChange: (value: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      {children}
      <span className={styles.toggle} aria-hidden="true" />
    </button>
  )
}

/** Unas opciones de las que se elige una, en una fila con borde */
export function Segments<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>
  onChange: (value: T) => void
}) {
  const name = useId()
  return (
    <fieldset className={styles.segments}>
      <legend className={mesaStyles.hidden}>{label}</legend>
      {options.map((option) => (
        <label key={option.value} title={option.icon ? option.label : undefined}>
          <input
            type="radio"
            name={name}
            checked={option.value === value}
            aria-label={option.icon ? option.label : undefined}
            onChange={() => onChange(option.value)}
          />
          {option.icon ?? option.label}
        </label>
      ))}
    </fieldset>
  )
}

/** Un cuadro que pide confirmar algo que no se deshace del todo */
export function Confirm({
  title,
  text,
  confirm,
  onConfirm,
  onClose
}: {
  title: string
  text: string
  confirm: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{title}</h2>
        <p className={dialogStyles.description}>{text}</p>
        <div className={dialogStyles.actions}>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('vision.cancel')}
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => {
              onConfirm()
              dialog.current?.close()
            }}
          >
            {confirm}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function WallsPanel({ vision }: { vision: Vision }) {
  const { t } = useTranslation()
  const stats = wallStats(vision.walls)
  const imported = vision.scene?.hasImported ?? false
  const empty = vision.walls.length === 0 && vision.lights.length === 0
  return (
    <>
      <div className={styles.field}>
        <span>{t('vision.draw')}</span>
        <div className={styles.kinds}>
          {DRAW_KINDS.map((kind) => (
            <button key={kind} type="button" aria-pressed={vision.kind === kind} onClick={() => vision.setKind(kind)}>
              <i style={{ background: KIND_SWATCH[kind], blockSize: kind === 'window' ? 2 : 4 }} aria-hidden="true" />
              {t(`vision.kinds.${kind}`)}
            </button>
          ))}
        </div>
      </div>
      {imported && empty && (
        <button
          type="button"
          className={styles.ghost}
          disabled={vision.placeImported.isPending}
          onClick={() => vision.placeImported.mutate(false)}
        >
          {t('vision.placeImported')}
        </button>
      )}
      {vision.selectedWall && <SelectedWall key={vision.selectedWall.id} wall={vision.selectedWall} vision={vision} />}
      <span className={styles.stat}>
        {[t('vision.wallCount', { count: stats.walls }), t('vision.doorCount', { count: stats.doors })].join(', ')}
      </span>
    </>
  )
}

/** El muro elegido: su tipo, el estado de su puerta en la campaña y lo que frena */
function SelectedWall({ wall, vision }: { wall: WallView; vision: Vision }) {
  const { t } = useTranslation()
  const kind = drawKindOf(wall)
  const open = vision.doors[wall.id] ?? wall.open
  const update = (patch: Omit<ActionWallPatch, 'id'>) =>
    vision.changeWalls.mutate({ walls: { update: [{ id: wall.id, ...patch }] } })
  const state = open ? 'open' : wall.locked ? 'locked' : 'closed'
  const setState = (next: 'open' | 'closed' | 'locked') => {
    if ((next === 'locked') !== wall.locked) update({ locked: next === 'locked' })
    if ((next === 'open') !== open) vision.setDoor.mutate({ wallId: wall.id, open: next === 'open' })
  }
  const setKind = (next: DrawKind) => {
    const input = wallInputFor(next, wall.a, wall.b)
    update({
      kind: input.kind,
      door: input.door ?? null,
      direction: input.direction ?? 'both',
      ...WALL_PRESETS[input.kind]
    })
  }
  const toggle = (channel: 'sight' | 'light' | 'move' | 'sound') => {
    const next: Restriction = wall[channel] === 'none' ? 'full' : 'none'
    update({ [channel]: next })
  }
  return (
    <section className={styles.selected} aria-label={t(`vision.kinds.${kind}`)}>
      <b>{t(`vision.kinds.${kind}`)}</b>
      {wall.door && (
        <Segments
          label={t('vision.doorState')}
          value={state}
          options={(['closed', 'open', 'locked'] as const).map((value) => ({ value, label: t(`vision.${value}`) }))}
          onChange={setState}
        />
      )}
      <label className={styles.field}>
        <span>{t('vision.kind')}</span>
        <select className={styles.select} value={kind} onChange={(event) => setKind(event.target.value as DrawKind)}>
          {kind === 'custom' && <option value="custom">{t('vision.kinds.custom')}</option>}
          {DRAW_KINDS.map((each) => (
            <option key={each} value={each}>
              {t(`vision.kinds.${each}`)}
            </option>
          ))}
        </select>
      </label>
      {(['sight', 'light', 'move', 'sound'] as const).map((channel) => (
        <Switch key={channel} checked={wall[channel] !== 'none'} onChange={() => toggle(channel)}>
          {t(`vision.blocks.${channel}`)}
        </Switch>
      ))}
      <div className={styles.row}>
        {kind === 'oneWay' && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => update({ direction: wall.direction === 'left' ? 'right' : 'left' })}
          >
            {t('vision.flip')}
          </button>
        )}
        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            vision.changeWalls.mutate({ walls: { remove: [wall.id] } })
            vision.setSelectedWall(null)
          }}
        >
          <Trash2 aria-hidden="true" size={15} />
          {t('vision.removeWall')}
        </button>
      </div>
    </section>
  )
}

function LightsPanel({ vision }: { vision: Vision }) {
  const { t } = useTranslation()
  const [darkness, setDarkness] = useState(Math.round(vision.darkness * 100))
  const shown = useRef(vision.darkness)
  // Lo que llega de la mesa manda, salvo mientras se mueve el deslizador
  const moving = useRef(false)
  if (!moving.current && shown.current !== vision.darkness) {
    shown.current = vision.darkness
    setDarkness(Math.round(vision.darkness * 100))
  }
  const commit = () => {
    moving.current = false
    if (Math.round(vision.darkness * 100) !== darkness) vision.updateVision.mutate({ darkness: darkness / 100 })
  }
  const index = vision.lights.findIndex((l) => l.id === vision.selectedLight?.id)
  return (
    <>
      <label className={styles.field}>
        <span>{t('vision.darkness')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={darkness}
          className={styles.range}
          onChange={(event) => {
            moving.current = true
            setDarkness(Number(event.target.value))
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={() => moving.current && commit()}
        />
      </label>
      {vision.selectedLight && (
        <SelectedLight key={vision.selectedLight.id} light={vision.selectedLight} index={index} vision={vision} />
      )}
    </>
  )
}

/** Un número que se guarda al salir del campo o con Intro */
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const next = Number(text.replace(',', '.'))
    if (Number.isFinite(next) && next >= 0 && next !== value) onCommit(next)
    else setText(String(value))
  }
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        className={styles.input}
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
      />
    </label>
  )
}

/** La luz elegida: sus radios, su color, su ángulo y si la frenan los muros */
function SelectedLight({ light, index, vision }: { light: LightView; index: number; vision: Vision }) {
  const { t } = useTranslation()
  const units = vision.grid?.units ?? ''
  const update = (patch: Partial<Omit<LightView, 'id'>>) =>
    vision.changeWalls.mutate({ lights: { update: [{ id: light.id, ...patch }] } })
  const colorName = useId()
  return (
    <section className={styles.selected} aria-label={t('vision.lightName', { n: index + 1 })}>
      <b>{t('vision.lightName', { n: index + 1 })}</b>
      <div className={styles.row}>
        <NumberField
          label={t('vision.bright', { units })}
          value={light.bright}
          onCommit={(bright) => update({ bright })}
        />
        <NumberField label={t('vision.dim', { units })} value={light.dim} onCommit={(dim) => update({ dim })} />
      </div>
      <div className={styles.field}>
        <span id={colorName}>{t('vision.color')}</span>
        <fieldset className={styles.swatches} aria-labelledby={colorName}>
          {LIGHT_COLORS.map(([name, color]) => (
            <label
              key={name}
              className={styles.swatch}
              title={t(`vision.colors.${name}`)}
              style={{ background: color }}
            >
              <input
                type="radio"
                name={colorName}
                checked={light.color.toLowerCase() === color}
                aria-label={t(`vision.colors.${name}`)}
                onChange={() => update({ color })}
              />
            </label>
          ))}
        </fieldset>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>{t('vision.angle')}</span>
          <select
            className={styles.select}
            value={light.angle}
            onChange={(event) => update({ angle: Number(event.target.value) })}
          >
            {(ANGLES.includes(light.angle as (typeof ANGLES)[number]) ? ANGLES : [...ANGLES, light.angle]).map(
              (angle) => (
                <option key={angle} value={angle}>
                  {t('vision.angleValue', { value: angle })}
                </option>
              )
            )}
          </select>
        </label>
        {light.angle < 360 && (
          <NumberField
            label={t('vision.rotation')}
            value={light.rotation}
            onCommit={(rotation) => update({ rotation: rotation % 360 })}
          />
        )}
      </div>
      <Switch checked={light.walls} onChange={(walls) => update({ walls })}>
        {t('vision.lightWalls')}
      </Switch>
      <Switch checked={light.enabled} onChange={(enabled) => update({ enabled })}>
        {t('vision.enabled')}
      </Switch>
      <Switch checked={light.darkness} onChange={(darkness) => update({ darkness })}>
        {t('vision.magicDark')}
      </Switch>
      <button
        type="button"
        className={`${styles.ghost} ${styles.start}`}
        onClick={() => {
          vision.changeWalls.mutate({ lights: { remove: [light.id] } })
          vision.setSelectedLight(null)
        }}
      >
        <Trash2 aria-hidden="true" size={15} />
        {t('vision.removeLight')}
      </button>
    </section>
  )
}

/** Los sonidos del mapa: oírlos desde la vista y el elegido (docs/specs/sonido-mapa.md) */
function SoundsPanel({ vision }: { vision: Vision }) {
  const { t } = useTranslation()
  const sound = useSound()
  const index = vision.sounds.findIndex((s) => s.id === vision.selectedSound?.id)
  return (
    <>
      {!vision.selectedSound && <span className={styles.stat}>{t('vision.soundsHint')}</span>}
      {sound && (
        <Switch checked={sound.device.map} onChange={(map) => sound.setDevice({ map })}>
          {t('vision.soundFromView')}
        </Switch>
      )}
      {vision.selectedSound && (
        <SelectedSound key={vision.selectedSound.id} sound={vision.selectedSound} index={index} vision={vision} />
      )}
    </>
  )
}

/** El sonido elegido: su nombre, qué suena, su radio, su volumen, el suavizado, los muros y la oscuridad */
function SelectedSound({ sound, index, vision }: { sound: SceneSoundView; index: number; vision: Vision }) {
  const { t } = useTranslation()
  const api = useApi()
  const files = useQuery({
    queryKey: ['files', vision.worldId],
    queryFn: () => api.call('listFiles', { worldId: vision.worldId }),
    enabled: Boolean(vision.worldId)
  })
  const playlists = useQuery({
    queryKey: playlistsKey(vision.worldId),
    queryFn: () => api.call('listSoundPlaylists', { worldId: vision.worldId }),
    enabled: Boolean(vision.worldId)
  })
  const audios = (files.data?.files ?? []).filter((f) => f.mime.startsWith('audio/'))
  const lists = (playlists.data?.playlists ?? [])
    .map((p) => ({ ...p, tracks: p.tracks.filter((track) => track.source.type === 'file') }))
    .filter((p) => p.tracks.length > 0)
  const update = (patch: Omit<Parameters<typeof vision.changeSound.mutate>[0], 'id'>) =>
    vision.changeSound.mutate({ id: sound.id, ...patch })
  const [volume, setVolume] = useState(Math.round(sound.volume * 100))
  useEffect(() => setVolume(Math.round(sound.volume * 100)), [sound.volume])
  const [name, setName] = useState(sound.name)
  const label = sound.name || t('vision.soundName', { n: index + 1 })
  const chosen =
    sound.source.type === 'file'
      ? `file:${sound.source.fileId}`
      : sound.source.type === 'track'
        ? `track:${sound.source.trackId}`
        : sound.source.type === 'url'
          ? 'url'
          : ''
  const pick = (value: string) => {
    const [kind, id] = value.split(':')
    if (kind === 'file' && id) update({ source: { type: 'file', fileId: id } })
    else if (kind === 'track' && id) update({ source: { type: 'track', trackId: id } })
    else if (!value) update({ source: { type: 'none' } })
  }
  return (
    <section className={styles.selected} aria-label={label}>
      <b>{label}</b>
      <label className={styles.field}>
        <span>{t('vision.soundLabel')}</span>
        <input
          className={styles.input}
          value={name}
          maxLength={200}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() !== sound.name && update({ name: name.trim() })}
          onKeyDown={(event) => event.key === 'Enter' && name.trim() !== sound.name && update({ name: name.trim() })}
        />
      </label>
      <label className={styles.field}>
        <span>{t('vision.soundSource')}</span>
        <select className={styles.select} value={chosen} onChange={(event) => pick(event.target.value)}>
          <option value="">{t('vision.soundNone')}</option>
          {sound.source.type === 'url' && <option value="url">{sound.source.url}</option>}
          {audios.length > 0 && (
            <optgroup label={t('vision.soundFiles')}>
              {audios.map((file) => (
                <option key={file.id} value={`file:${file.id}`}>
                  {file.name}
                </option>
              ))}
            </optgroup>
          )}
          {lists.map((list) => (
            <optgroup key={list.id} label={t('vision.soundTracks', { name: list.name })}>
              {list.tracks.map((track) => (
                <option key={track.id} value={`track:${track.id}`}>
                  {track.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className={styles.row}>
        <NumberField
          label={t('vision.soundRadius')}
          value={sound.radius}
          onCommit={(radius) => radius > 0 && update({ radius })}
        />
        <label className={styles.field}>
          <span>{t('vision.soundVolume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            className={styles.range}
            onChange={(event) => setVolume(Number(event.target.value))}
            onPointerUp={() => volume / 100 !== sound.volume && update({ volume: volume / 100 })}
            onKeyUp={() => volume / 100 !== sound.volume && update({ volume: volume / 100 })}
          />
        </label>
      </div>
      <div className={styles.field}>
        <span>{t('vision.soundWalls')}</span>
        <Segments
          label={t('vision.soundWalls')}
          value={sound.walls}
          options={[
            { value: 'block' as const, label: t('vision.soundWallsBlock') },
            { value: 'muffle' as const, label: t('vision.soundWallsMuffle') }
          ]}
          onChange={(walls) => update({ walls })}
        />
      </div>
      <Switch checked={sound.easing} onChange={(easing) => update({ easing })}>
        {t('vision.soundEasing')}
      </Switch>
      <Switch checked={sound.darkOnly} onChange={(darkOnly) => update({ darkOnly })}>
        {t('vision.soundDarkOnly')}
      </Switch>
      <Switch
        checked={sound.enabled !== false}
        onChange={(enabled) => update({ campaignId: vision.campaignId, enabled })}
      >
        {t('vision.soundOn')}
      </Switch>
      <button
        type="button"
        className={`${styles.ghost} ${styles.start}`}
        onClick={() => {
          vision.removeSound.mutate(sound.id)
          vision.setSelectedSound(null)
        }}
      >
        <Trash2 aria-hidden="true" size={15} />
        {t('vision.removeSound')}
      </button>
    </section>
  )
}

function FogPanel({ vision, onAsGroup }: { vision: Vision; onAsGroup: () => void }) {
  const { t } = useTranslation()
  const [resetting, setResetting] = useState(false)
  const image = vision.scene?.image
  const all = (mode: FogMode) =>
    image && vision.changeFog.mutate({ mode, shape: 'rectangle', x: 0, y: 0, width: image.width, height: image.height })
  return (
    <>
      <Switch
        checked={vision.automaticVision}
        onChange={(automaticVision) => vision.updateVision.mutate({ automaticVision })}
      >
        {t('vision.automatic')}
      </Switch>
      {!vision.automaticVision && <span className={styles.stat}>{t('vision.manualOnly')}</span>}
      <div className={styles.row}>
        <button type="button" className={styles.ghost} disabled={!image} onClick={() => all('reveal')}>
          {t('vision.revealAll')}
        </button>
        <button type="button" className={styles.ghost} disabled={!image} onClick={() => all('cover')}>
          {t('vision.coverAll')}
        </button>
      </div>
      <button type="button" className={`${styles.ghost} ${styles.start}`} onClick={() => setResetting(true)}>
        <RotateCcw aria-hidden="true" size={15} />
        {t('vision.reset')}
      </button>
      <button type="button" className={`${styles.ghost} ${styles.start}`} onClick={onAsGroup}>
        <Eye aria-hidden="true" size={15} />
        {t('vision.asGroup')}
      </button>
      <div className={`${styles.field} ${styles.tileFit}`}>
        <span>{t('vision.tileFit')}</span>
        <Segments
          label={t('vision.tileFit')}
          value={vision.tileFit}
          options={(['whole', 'cropped'] as const).map((value) => ({ value, label: t(`vision.${value}`) }))}
          onChange={(fit) => vision.setTileFit.mutate(fit)}
        />
        <span className={styles.stat}>{t('vision.tileFitHint')}</span>
      </div>
      {resetting && (
        <Confirm
          title={t('vision.reset')}
          text={t('vision.resetText')}
          confirm={t('vision.resetConfirm')}
          onConfirm={() => vision.resetFog.mutate()}
          onClose={() => setResetting(false)}
        />
      )}
    </>
  )
}

/** Quién mira (los personajes de la campaña en la escena) y lo que no ve el grupo */
function GroupPanel({ vision, tokens, notSeen }: { vision: Vision; tokens: TokenView[]; notSeen: readonly string[] }) {
  const { t } = useTranslation()
  const looking = tokens.filter((token) => token.actor.kind === 'character' && !token.hidden)
  const missing = tokens.filter((token) => notSeen.includes(token.id))
  const secret = vision.walls.filter((wall) => wall.door === 'secret' && !(vision.doors[wall.id] ?? wall.open)).length
  return (
    <>
      <div className={styles.field}>
        <span>{t('vision.looking')}</span>
        {looking.length === 0 ? (
          <span className={styles.stat}>{t('vision.noGroup')}</span>
        ) : (
          <ul className={styles.looking}>
            {looking.map((token) => (
              <li
                key={token.id}
                title={token.actor.name}
                style={{ background: cssDisc(token.actor.name, token.faction) }}
              >
                <span aria-hidden="true">{initialOf(token.label)}</span>
                <span className={mesaStyles.hidden}>{token.actor.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.field}>
        <span>{t('vision.notSeen')}</span>
        {missing.length === 0 && secret === 0 ? (
          <span className={styles.stat}>{t('vision.allSeen')}</span>
        ) : (
          <ul className={styles.missing}>
            {missing.map((token) => (
              <li key={token.id}>
                <EyeOff aria-hidden="true" size={15} />
                {t(token.hidden ? 'vision.hiddenToken' : 'vision.outOfSight', {
                  name: token.label || token.actor.name
                })}
              </li>
            ))}
            {secret > 0 && (
              <li>
                <EyeOff aria-hidden="true" size={15} />
                {t('vision.secretDoors', { count: secret })}
              </li>
            )}
          </ul>
        )}
      </div>
    </>
  )
}

/** La barra de la niebla a mano, junto a la columna de herramientas: destapar o tapar, la forma y el pincel */
export function FogTools({ vision }: { vision: Vision }) {
  const { t } = useTranslation()
  const shapes: ReadonlyArray<{ value: FogShape; label: string; icon: ReactNode }> = [
    { value: 'brush', label: t('vision.brush'), icon: <Brush aria-hidden="true" size={15} /> },
    { value: 'rectangle', label: t('vision.rectangle'), icon: <Square aria-hidden="true" size={15} /> },
    { value: 'lasso', label: t('vision.lasso'), icon: <Lasso aria-hidden="true" size={15} /> }
  ]
  return (
    <div className={styles.subtools} role="toolbar" aria-label={t('vision.fog')}>
      <Segments
        label={t('vision.fogMode')}
        value={vision.fogMode}
        options={(['reveal', 'cover'] as const).map((value) => ({ value, label: t(`vision.${value}`) }))}
        onChange={vision.setFogMode}
      />
      <Segments label={t('vision.shape')} value={vision.fogShape} options={shapes} onChange={vision.setFogShape} />
      {vision.fogShape === 'brush' && (
        <input
          type="range"
          min={1}
          max={8}
          value={vision.brushCells}
          aria-label={t('vision.brushSize')}
          title={t('vision.brushSize')}
          className={styles.brush}
          onChange={(event) => vision.setBrushCells(Number(event.target.value))}
        />
      )}
    </div>
  )
}

/** «Viendo como el grupo», arriba en medio, con su «Volver» */
export function AsGroupBanner({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.asGroup} role="status">
      <Eye aria-hidden="true" size={15} />
      {t('vision.viewing')}
      <button type="button" onClick={onBack}>
        {t('vision.back')}
      </button>
    </div>
  )
}
