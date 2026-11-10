/**
 * Crear o cambiar una lista de sonido del mundo (docs/specs/sonido.md), en un cuadro como los de crear de la app: su
 * nombre, clase, modo y fundido, y sus pistas: audios del mundo, uno que se sube o un enlace de YouTube. La duración
 * la mide este navegador al añadirla (la de YouTube, su reproductor, que también dice si deja insertarse)
 */
import { type SoundPlaylistView, type SoundTrackInput, youtubeVideoId } from '@crisol/contracts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload, X } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import styles from './sound.module.css'
import { clockText } from './view.ts'
import { probeYoutube } from './youtube.tsx'

type Kind = SoundPlaylistView['kind']
type Mode = SoundPlaylistView['mode']

interface Draft {
  key: string
  id?: string
  name: string
  source: { type: 'file'; fileId: string } | { type: 'youtube'; url: string }
  duration: number
  loop: boolean
  volume: number
}

/** Cuánto dura un audio (s), con los metadatos que carga el navegador */
export function measureAudio(url: string, timeoutMs = 10_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const timer = setTimeout(() => fail(), timeoutMs)
    const done = () => {
      clearTimeout(timer)
      audio.removeAttribute('src')
    }
    const fail = () => {
      done()
      reject(new ApiError('AUDIO_UNREADABLE', 0))
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = audio.duration
      done()
      if (Number.isFinite(duration) && duration > 0) resolve(duration)
      else reject(new ApiError('AUDIO_UNREADABLE', 0))
    }
    audio.onerror = fail
    audio.src = url
  })
}

const draftOf = (playlist: SoundPlaylistView | null): Draft[] =>
  (playlist?.tracks ?? []).flatMap((track): Draft[] => {
    const base = { key: track.id, id: track.id, name: track.name, duration: track.duration, loop: track.loop }
    if (track.source.type === 'file')
      return [{ ...base, volume: track.volume, source: { type: 'file', fileId: track.source.fileId } }]
    if (track.source.type === 'youtube')
      return [{ ...base, volume: track.volume, source: { type: 'youtube', url: track.source.videoId } }]
    return []
  })

const withoutExtension = (name: string) => name.replace(/\.[a-z0-9]{2,5}$/i, '')

export function PlaylistDialog({
  worldId,
  playlist,
  kind,
  onClose,
  onSaved
}: {
  worldId: string
  playlist: SoundPlaylistView | null
  kind: Kind
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const probe = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [name, setName] = useState(playlist?.name ?? '')
  const [listKind, setListKind] = useState<Kind>(playlist?.kind ?? kind)
  const [mode, setMode] = useState<Mode>(playlist?.mode ?? (kind === 'effects' ? 'soundboard' : 'sequential'))
  const [fade, setFade] = useState(playlist?.fade ?? (kind === 'ambient' ? 2 : 0))
  const [tracks, setTracks] = useState<Draft[]>(() => draftOf(playlist))
  const [link, setLink] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<unknown>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const audios = (files.data?.files ?? []).filter((f) => f.mime.startsWith('audio/'))

  const add = async (make: () => Promise<Draft>) => {
    setAdding(true)
    setAddError(null)
    try {
      const draft = await make()
      setTracks((current) => [...current, draft])
    } catch (error) {
      setAddError(error)
    } finally {
      setAdding(false)
    }
  }
  const addFile = (fileId: string) => {
    const file = audios.find((f) => f.id === fileId)
    if (!file) return
    void add(async () => ({
      key: crypto.randomUUID(),
      name: withoutExtension(file.name),
      source: { type: 'file', fileId: file.id },
      duration: await measureAudio(file.url),
      loop: false,
      volume: 1
    }))
  }
  const upload = (file: File) =>
    add(async () => {
      const local = URL.createObjectURL(file)
      try {
        const duration = await measureAudio(local)
        const stored = await api.uploadFile({ worldId, name: file.name }, file)
        return {
          key: crypto.randomUUID(),
          name: withoutExtension(file.name),
          source: { type: 'file', fileId: stored.id },
          duration,
          loop: false,
          volume: 1
        }
      } finally {
        URL.revokeObjectURL(local)
      }
    })
  const addYoutube = () => {
    const videoId = youtubeVideoId(link)
    if (!videoId) {
      setAddError(new ApiError('BAD_YOUTUBE', 400))
      return
    }
    void add(async () => {
      if (!probe.current) throw new ApiError('YOUTUBE_UNAVAILABLE', 0)
      const found = await probeYoutube(videoId, probe.current).catch((error: Error) => {
        throw new ApiError(error.message, 0)
      })
      setLink('')
      return {
        key: crypto.randomUUID(),
        name: found.title || `YouTube ${videoId}`,
        source: { type: 'youtube', url: videoId },
        duration: found.duration,
        loop: false,
        volume: 1
      }
    })
  }

  const save = useMutation({
    mutationFn: () => {
      const input: SoundTrackInput[] = tracks.map((track) => ({
        ...(track.id ? { id: track.id } : {}),
        name: track.name.trim() || '—',
        source: track.source,
        duration: track.duration,
        volume: track.volume,
        loop: track.loop
      }))
      const values = { name: name.trim(), kind: listKind, mode, fade, tracks: input }
      return playlist
        ? api.call('updateSoundPlaylist', { id: playlist.id, ...values })
        : api.call('createSoundPlaylist', { worldId, ...values })
    },
    onSuccess: onSaved
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  const patch = (key: string, change: Partial<Draft>) =>
    setTracks((current) => current.map((track) => (track.key === key ? { ...track, ...change } : track)))

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.dialog}`}
      onClose={onClose}
    >
      <form className={dialogStyles.body} onSubmit={submit}>
        <h2 id={titleId}>{playlist ? t('sound.dialog.edit') : t('sound.dialog.create')}</h2>
        <label className={styles.add}>
          <span>{t('sound.dialog.name')}</span>
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={200}
            required
            autoFocus
            autoComplete="off"
            data-1p-ignore
          />
        </label>
        <div className={styles.fields}>
          <label>
            {t('sound.dialog.kind')}
            <select value={listKind} onChange={(event) => setListKind(event.currentTarget.value as Kind)}>
              <option value="ambient">{t('sound.ambient')}</option>
              <option value="effects">{t('sound.effects')}</option>
            </select>
          </label>
          <label>
            {t('sound.dialog.mode')}
            <select value={mode} onChange={(event) => setMode(event.currentTarget.value as Mode)}>
              {(['sequential', 'random', 'simultaneous', 'soundboard'] as const).map((m) => (
                <option key={m} value={m}>
                  {t(`sound.modes.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('sound.dialog.fade')}
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={fade}
              onChange={(event) => setFade(Math.min(30, Math.max(0, Number(event.currentTarget.value) || 0)))}
            />
          </label>
        </div>

        <h3 className={styles.section}>{t('sound.dialog.tracks')}</h3>
        {tracks.length === 0 ? (
          <p className={styles.empty}>{t('sound.dialog.noTracks')}</p>
        ) : (
          <ul className={styles.trackList}>
            {tracks.map((track) => (
              <li key={track.key} className={styles.trackRow}>
                <input
                  type="text"
                  aria-label={t('sound.dialog.trackName')}
                  value={track.name}
                  maxLength={200}
                  onChange={(event) => patch(track.key, { name: event.currentTarget.value })}
                />
                <small>{clockText(track.duration)}</small>
                <label>
                  <input
                    type="checkbox"
                    checked={track.loop}
                    onChange={(event) => patch(track.key, { loop: event.currentTarget.checked })}
                  />
                  {t('sound.dialog.loop')}
                </label>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t('sound.dialog.remove', { name: track.name })}
                  title={t('sound.dialog.remove', { name: track.name })}
                  onClick={() => setTracks((current) => current.filter((x) => x.key !== track.key))}
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.add}>
          <label>
            {t('sound.dialog.fromWorld')}
            <select
              value=""
              disabled={adding || audios.length === 0}
              onChange={(event) => addFile(event.currentTarget.value)}
            >
              <option value="">{audios.length === 0 ? t('sound.dialog.noAudio') : t('sound.dialog.pickFile')}</option>
              {audios.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.addButton}>
            <Upload aria-hidden="true" size={14} />
            {t('sound.dialog.upload')}
            <input
              type="file"
              accept="audio/*"
              hidden
              disabled={adding}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void upload(file)
              }}
            />
          </label>
        </div>
        <div className={styles.add}>
          <label>
            {t('sound.dialog.youtube')}
            <input
              value={link}
              inputMode="url"
              autoComplete="off"
              placeholder="https://youtu.be/…"
              onChange={(event) => setLink(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addYoutube()
                }
              }}
            />
          </label>
          <button type="button" className={styles.addButton} disabled={adding || !link.trim()} onClick={addYoutube}>
            {adding ? t('sound.dialog.measuring') : t('sound.dialog.addYoutube')}
          </button>
        </div>
        {/* El reproductor que mide el vídeo: a la vista mientras lo hace, como pide YouTube */}
        <div ref={probe} className={styles.probe} />
        <FormError message={addError ? errorText(addError) : save.error ? errorText(save.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={save.isPending} disabled={adding}>
            {playlist ? t('sound.dialog.save') : t('sound.dialog.createSubmit')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('list.cancel')}
          </button>
        </div>
      </form>
    </dialog>
  )
}
