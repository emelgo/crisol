/**
 * La pestaña Sonido de la Mesa del máster (docs/specs/sonido.md, lienzo «Sala de jugadores», tablero E): arriba lo que
 * suena (pista, tiempo, pausa, siguiente, fundido y volumen); debajo, las listas del mundo para lanzar (el ambiente, en
 * filas; los efectos, en su botonera) y, al final, el volumen de este aparato
 */
import type { SoundPlaylistView, SoundView, SoundVoice } from '@crisol/contracts'
import { expectedPosition } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AudioWaveform,
  ListOrdered,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Plus,
  Shuffle,
  SkipForward,
  Square,
  SquarePlay,
  Volume2,
  X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import roomStyles from '../tabletop/room.module.css'
import { PlaylistDialog } from './playlist-dialog.tsx'
import styles from './sound.module.css'
import { useSound } from './use-table-sound.tsx'
import { clockText } from './view.ts'

export const playlistsKey = (worldId: string) => ['soundPlaylists', worldId]

/** Se vuelve a pintar cada medio segundo mientras haga falta (la barra de tiempo) */
function useTicking(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [active])
}

const MODE_ICON = { sequential: ListOrdered, random: Shuffle, simultaneous: AudioWaveform, soundboard: AudioWaveform }

export function SoundTab({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const sound = useSound()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<SoundPlaylistView | 'ambient' | 'effects' | null>(null)
  const playlists = useQuery({
    queryKey: playlistsKey(worldId),
    queryFn: () => api.call('listSoundPlaylists', { campaignId })
  })
  const act = useMutation({
    mutationFn: (run: () => Promise<SoundView>) => run(),
    onSuccess: (view) => sound?.setView(view)
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.call('deleteSoundPlaylist', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playlistsKey(worldId) })
  })
  const view = sound?.view ?? null
  const lists = playlists.data?.playlists ?? []
  const ambient = lists.filter((p) => p.kind === 'ambient')
  const boards = lists.filter((p) => p.kind === 'effects' && p.mode === 'soundboard')
  // Una lista de efectos que no es botonera se lanza entera, como una de ambiente
  const effectLists = lists.filter((p) => p.kind === 'effects' && p.mode !== 'soundboard')
  const playingLists = new Set((view?.lists ?? []).filter((l) => l.stopAt === null).map((l) => l.playlistId))
  const playingTracks = new Set((view?.voices ?? []).map((v) => v.trackId))
  const play = (input: { playlistId?: string; trackId?: string }) =>
    act.mutate(() => api.call('playSound', { campaignId, ...input }))
  const row = (list: SoundPlaylistView) => (
    <ListRow
      key={list.id}
      list={list}
      playing={playingLists.has(list.id)}
      onPlay={() => play({ playlistId: list.id })}
      onStop={() => act.mutate(() => api.call('stopSound', { campaignId, playlistId: list.id, fade: list.fade }))}
      onEdit={() => setEditing(list)}
      onDelete={() => remove.mutate(list.id)}
    />
  )
  return (
    <div className={styles.tab}>
      <h3 className={styles.section}>{t('sound.playing')}</h3>
      <NowPlaying campaignId={campaignId} view={view} onAct={act.mutate} />
      <FormError message={act.error ? errorText(act.error) : remove.error ? errorText(remove.error) : null} />

      <h3 className={styles.section}>{t('sound.ambient')}</h3>
      <div className={styles.lists}>
        {ambient.length === 0 && playlists.isSuccess && <p className={styles.empty}>{t('sound.noLists')}</p>}
        {ambient.map(row)}
        <button type="button" className={styles.newList} onClick={() => setEditing('ambient')}>
          <Plus aria-hidden="true" size={15} />
          {t('sound.newList')}
        </button>
      </div>

      <h3 className={styles.section}>{t('sound.effects')}</h3>
      {boards.length === 0 && effectLists.length === 0 && playlists.isSuccess && (
        <p className={styles.empty}>{t('sound.noEffects')}</p>
      )}
      {effectLists.length > 0 && <div className={styles.lists}>{effectLists.map(row)}</div>}
      {boards.map((board) => (
        <div key={board.id}>
          <div className={styles.track}>
            <p className={`${styles.boardName} ${styles.trackText}`}>{board.name}</p>
            <BoardMenu name={board.name} onEdit={() => setEditing(board)} onDelete={() => remove.mutate(board.id)} />
          </div>
          <div className={styles.pads}>
            {board.tracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className={styles.pad}
                data-playing={playingTracks.has(track.id) ? '' : undefined}
                title={track.name}
                onClick={() => play({ trackId: track.id })}
              >
                {track.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className={styles.newList} onClick={() => setEditing('effects')}>
        <Plus aria-hidden="true" size={15} />
        {t('sound.newList')}
      </button>

      <h3 className={styles.section}>{t('sound.device')}</h3>
      <DeviceControls />

      {editing && (
        <PlaylistDialog
          worldId={worldId}
          playlist={typeof editing === 'string' ? null : editing}
          kind={typeof editing === 'string' ? editing : editing.kind}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void queryClient.invalidateQueries({ queryKey: playlistsKey(worldId) })
          }}
        />
      )}
    </div>
  )
}

/** Lo que suena: cada pista de las listas, con su tiempo; los efectos, en fichas con su X */
function NowPlaying({
  campaignId,
  view,
  onAct
}: {
  campaignId: string
  view: SoundView | null
  onAct: (run: () => Promise<SoundView>) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const sound = useSound()
  const voices = view?.voices ?? []
  useTicking(voices.length > 0 && !view?.paused)
  const [volume, setVolume] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!view || voices.length === 0) return <p className={styles.empty}>{t('sound.nothing')}</p>
  const listVoices = voices.filter((v) => !v.effectId)
  const effects = voices.filter((v) => v.effectId)
  // El fundido de lo que suena (sin él, unos segundos)
  const fade = Math.max(0, ...voices.map((v) => v.fade)) || 3
  const changeVolume = (value: number) => {
    setVolume(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onAct(() => api.call('setSoundVolume', { campaignId, volume: value }))
      setVolume(null)
    }, 250)
  }
  return (
    <>
      {listVoices.map((voice) => (
        <VoiceNow key={voice.key} voice={voice} view={view} serverNow={sound?.clock.now() ?? Date.now()} />
      ))}
      {effects.length > 0 && (
        <div className={styles.effectsNow}>
          {effects.map((voice) => (
            <span key={voice.key} className={styles.chip}>
              {voice.name}
              <button
                type="button"
                aria-label={t('sound.stopList', { name: voice.name })}
                title={t('sound.stop')}
                onClick={() =>
                  onAct(() => api.call('stopSound', { campaignId, effectId: voice.effectId ?? undefined }))
                }
              >
                <X aria-hidden="true" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.big}
          aria-label={view.paused ? t('sound.resume') : t('sound.pause')}
          title={view.paused ? t('sound.resume') : t('sound.pause')}
          onClick={() => onAct(() => api.call('pauseSound', { campaignId, paused: !view.paused }))}
        >
          {view.paused ? <Play aria-hidden="true" size={17} /> : <Pause aria-hidden="true" size={17} />}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('sound.next')}
          title={t('sound.next')}
          disabled={!view.lists.some((l) => l.mode === 'sequential' || l.mode === 'random')}
          onClick={() => onAct(() => api.call('nextTrack', { campaignId }))}
        >
          <SkipForward aria-hidden="true" size={17} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('sound.fadeOut')}
          title={t('sound.fadeOut')}
          onClick={() => onAct(() => api.call('stopSound', { campaignId, fade }))}
        >
          <AudioWaveform aria-hidden="true" size={17} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('sound.stop')}
          title={t('sound.stop')}
          onClick={() => onAct(() => api.call('stopSound', { campaignId }))}
        >
          <Square aria-hidden="true" size={15} />
        </button>
        <label className={styles.volume}>
          <Volume2 aria-hidden="true" size={16} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            aria-label={t('sound.volume')}
            value={volume ?? view.volume}
            onChange={(event) => changeVolume(Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </>
  )
}

function VoiceNow({ voice, view, serverNow }: { voice: SoundVoice; view: SoundView; serverNow: number }) {
  const { t } = useTranslation()
  const position =
    expectedPosition(voice, { serverNow, paused: view.paused, pausedAt: view.pausedAt }) ?? voice.duration
  const list = view.lists.find((l) => l.playlistId === voice.playlistId)
  const Icon = voice.source.type === 'youtube' ? SquarePlay : Music
  return (
    <div className={styles.now}>
      <div className={styles.track}>
        <span className={styles.art} data-kind={voice.kind} aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className={styles.trackText}>
          <b>{voice.name}</b>
          <span>
            {t('sound.ofList', {
              kind: t(voice.kind === 'ambient' ? 'sound.ambient' : 'sound.effects'),
              name: list?.name ?? ''
            })}
          </span>
        </div>
      </div>
      <div className={styles.progress}>
        <span>{clockText(position)}</span>
        <span className={styles.bar}>
          <i
            className={styles.fill}
            style={{ inlineSize: `${Math.min(100, (position / Math.max(1, voice.duration)) * 100)}%` }}
          />
        </span>
        <span>{clockText(voice.duration)}</span>
      </div>
    </div>
  )
}

function ListRow({
  list,
  playing,
  onPlay,
  onStop,
  onEdit,
  onDelete
}: {
  list: SoundPlaylistView
  playing: boolean
  onPlay: () => void
  onStop: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const ModeIcon = MODE_ICON[list.mode]
  const youtube = list.tracks.length > 0 && list.tracks.every((track) => track.source.type === 'youtube')
  return (
    <div className={styles.row} data-playing={playing ? '' : undefined}>
      <button
        type="button"
        className={styles.play}
        aria-label={playing ? t('sound.stopList', { name: list.name }) : t('sound.play', { name: list.name })}
        title={playing ? t('sound.stop') : undefined}
        onClick={playing ? onStop : onPlay}
      >
        {playing ? (
          <span className={styles.bars} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <Play aria-hidden="true" size={13} />
        )}
      </button>
      <div className={styles.rowText}>
        <b>{list.name}</b>
        <span>
          {youtube ? <SquarePlay aria-hidden="true" size={12} /> : <ModeIcon aria-hidden="true" size={12} />}
          {t(`sound.modes.${list.mode}`)} · {t('sound.tracks', { count: list.tracks.length })}
        </span>
      </div>
      <BoardMenu name={list.name} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

/** «…»: editar o borrar una lista (borrar se deshace desde el historial) */
function BoardMenu({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, menu, button)
  return (
    <span className={roomStyles.menuWrap}>
      <button
        ref={button}
        type="button"
        className={styles.iconButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('sound.moreOf', { name })}
        title={t('sound.moreOf', { name })}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal aria-hidden="true" size={16} />
      </button>
      {open && (
        <div ref={menu} className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          >
            {t('sound.edit')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.danger}
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            {t('sound.delete')}
          </button>
        </div>
      )}
    </span>
  )
}

/** El volumen de este aparato: ambiente, efectos y silenciar */
function DeviceControls() {
  const { t } = useTranslation()
  const sound = useSound()
  if (!sound) return null
  const { device, setDevice } = sound
  return (
    <div>
      <label className={styles.deviceRow}>
        {t('sound.ambient')}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={device.ambient}
          onChange={(event) => setDevice({ ambient: Number(event.currentTarget.value) })}
        />
      </label>
      <label className={styles.deviceRow}>
        {t('sound.effects')}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={device.effects}
          onChange={(event) => setDevice({ effects: Number(event.currentTarget.value) })}
        />
      </label>
      <label className={styles.deviceRow}>
        {t('sound.mute')}
        <input
          type="checkbox"
          role="switch"
          aria-checked={device.muted}
          className={roomStyles.switch}
          checked={device.muted}
          onChange={(event) => setDevice({ muted: event.currentTarget.checked })}
        />
      </label>
    </div>
  )
}
