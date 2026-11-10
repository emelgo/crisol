/**
 * Las escenas y aventuras de un zip, a un mundo (docs/specs/escenas-foundry.md): se eligen cuáles y bajo qué página;
 * el servidor crea sus páginas con su pestaña «Escena» (rejilla, muros, puertas, luces y criaturas preparadas) y aquí
 * se saca la imagen de cada una del zip y se trocea, como la de una escena nueva. Sin su imagen en el zip, un mapa
 * liso de su tamaño, para que sus muros y sus fichas caigan en su sitio
 */
import type { FoundryAdventureSummary, FoundryPlaylistSummary, FoundrySceneSummary } from '@crisol/contracts'
import { imageSize } from '@crisol/tabletop'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BookOpen, Map as MapIcon, Music } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type ActionOutput, ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import type { PrepareSource } from '../tabletop/prepare.ts'
import { usePreparer } from '../tabletop/preparer.ts'
import styles from './foundry-scenes.module.css'
import { type FoundryZip, filesFromZip, slimZip, toBase64 } from './foundry-zip.ts'

/** Una miniatura sacada del zip: hasta tanto (un fondo grande no se descomprime para eso) */
const THUMB_BYTES = 4 * 1024 * 1024
/** Lo más que mide de lado un mapa liso (sin su imagen en el zip) */
const BLANK_SIDE = 16_384
const VIDEO = /\.(webm|mp4|m4v|ogv)$/i
const MIME: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml'
}

type Imported = ActionOutput<'importFoundryScenes'>

const AUDIO_MIME: Record<string, string> = {
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  aac: 'audio/aac'
}

/** Lo que dura un audio (s), medido por el navegador; undefined si no se puede (en unos segundos) */
function measureAudio(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    let url: string
    try {
      url = URL.createObjectURL(blob)
    } catch {
      return resolve(undefined)
    }
    const audio = new Audio()
    const done = (value: number | undefined) => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => done(undefined), 5000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined)
    audio.onerror = () => done(undefined)
    audio.src = url
  })
}

/**
 * Sube al mundo los audios del zip que usa lo elegido (los ya subidos no) y mide lo que dura cada uno: lo que el
 * servidor necesita para las listas y los sonidos de las escenas (docs/specs/sonido-foundry.md)
 */
async function uploadAudio(
  api: ReturnType<typeof useApi>,
  input: {
    bytes: Uint8Array
    foundry: FoundryZip
    worldId: string
    audio: ReadonlyArray<{ path: string; usedBy: string[]; fileId: string | null }>
    chosen: ReadonlySet<string>
  },
  onProgress: (index: number, total: number) => void
) {
  const needed = input.audio.filter((a) => a.usedBy.some((key) => input.chosen.has(key)))
  if (needed.length === 0) return []
  const files = filesFromZip(
    input.bytes,
    input.foundry,
    needed.map((a) => a.path)
  )
  const out: Array<{ path: string; fileId?: string; duration?: number }> = []
  for (const [index, item] of needed.entries()) {
    onProgress(index + 1, needed.length)
    const data = files.get(item.path)
    // Lo que no viene en el zip lo dice el servidor
    if (!data) continue
    const name = decodeURIComponent(item.path.split('/').at(-1) ?? 'audio')
    const blob = new Blob([data as BlobPart], { type: AUDIO_MIME[name.split('.').at(-1)?.toLowerCase() ?? ''] ?? '' })
    const duration = await measureAudio(blob)
    const fileId = item.fileId ?? (await api.uploadFile({ worldId: input.worldId, name }, blob)).id
    out.push({ path: item.path, fileId, ...(duration ? { duration } : {}) })
  }
  return out
}

/** Lo que se le pasa al hilo que trocea: la imagen del zip (a las medidas de la escena) o un mapa liso */
async function sourceFor(bytes: Uint8Array | undefined, path: string | null, width: number, height: number) {
  if (bytes && path && !VIDEO.test(path)) {
    const extension = path.split('.').at(-1)?.toLowerCase() ?? ''
    const blob = new Blob([bytes as BlobPart], { type: MIME[extension] ?? 'application/octet-stream' })
    const size = imageSize(bytes.subarray(0, 65_536))
    // A su tamaño en la escena: si la imagen mide otra cosa, se estira como la estira la escena
    if (!size || (size.width === width && size.height === height))
      return { source: { kind: 'image', blob } as PrepareSource, blank: false }
    const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
    return { source: { kind: 'bitmap', bitmap } as PrepareSource, blank: false }
  }
  if (width > BLANK_SIDE || height > BLANK_SIDE) return null
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = '#8f8a80'
  context.fillRect(0, 0, width, height)
  return { source: { kind: 'bitmap', bitmap: canvas.transferToImageBitmap() } as PrepareSource, blank: true }
}

export function FoundryScenes({
  bytes,
  foundry,
  systemId,
  onDone
}: {
  bytes: Uint8Array
  foundry: FoundryZip
  /** El sistema recién traído del mismo zip: sus criaturas se buscan en él */
  systemId?: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const preparer = usePreparer()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const worldFieldId = useId()
  const parentFieldId = useId()
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const own = (worlds.data?.worlds ?? []).filter((w) => w.role === 'master')
  const [worldId, setWorldId] = useState<string | null>(null)
  const world = worldId ?? own[0]?.id ?? null
  const [parentId, setParentId] = useState('')
  // Solo el manifiesto y los paquetes de escenas, en base64
  const zip = useMemo(
    () =>
      toBase64(
        slimZip(
          bytes,
          foundry,
          foundry.scenePacks.map((p) => p.name)
        )
      ),
    [bytes, foundry]
  )
  const tree = useQuery({
    queryKey: ['pages', world, 'tree', 4],
    queryFn: () => api.call('listPageTree', { worldId: world ?? '', levels: 4 }),
    enabled: world !== null
  })
  const read = useQuery({
    queryKey: ['foundryScenes', world, zip.length, foundry.id],
    queryFn: () => api.call('inspectFoundryScenes', { worldId: world ?? '', zip }),
    enabled: world !== null
  })
  const adventures = read.data?.adventures ?? []
  const loose = (read.data?.scenes ?? []).filter((s) => !s.adventure)
  // Las listas de sonido de sus paquetes de listas (las de una aventura van con ella)
  const playlists = (read.data?.playlists ?? []).filter((p) => !p.adventure)
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set())
  const keyOf = (item: { pack: string; id: string }) => `${item.pack}/${item.id}`
  const chosenScenes = loose.filter((s) => !unchecked.has(keyOf(s)))
  const chosenAdventures = adventures.filter((a) => !unchecked.has(keyOf(a)))
  const chosenPlaylists = playlists.filter((p) => !unchecked.has(keyOf(p)))
  const count =
    chosenScenes.length +
    (read.data?.scenes ?? []).filter((s) => s.adventure && chosenAdventures.some((a) => a.id === s.adventure)).length
  const thumbs = useThumbnails(bytes, foundry, read.data?.scenes ?? [], adventures)
  const [progress, setProgress] = useState<{ name: string; index: number; total: number; done: number } | null>(null)
  const [uploading, setUploading] = useState<{ index: number; total: number } | null>(null)
  const [blank, setBlank] = useState<string[]>([])

  const run = useMutation({
    mutationFn: async () => {
      if (!world) throw new ApiError('NOT_FOUND', 404)
      // Antes, los audios del zip que usa lo elegido, subidos al mundo
      const audio = await uploadAudio(
        api,
        {
          bytes,
          foundry,
          worldId: world,
          audio: read.data?.audio ?? [],
          chosen: new Set([...chosenScenes, ...chosenAdventures, ...chosenPlaylists].map(keyOf))
        },
        (index, total) => setUploading({ index, total })
      )
      setUploading(null)
      const imported = await api.call('importFoundryScenes', {
        worldId: world,
        zip,
        parentId: parentId || null,
        scenes: chosenScenes.map((s) => ({ pack: s.pack, id: s.id })),
        adventures: chosenAdventures.map((a) => ({ pack: a.pack, id: a.id })),
        playlists: chosenPlaylists.map((p) => ({ pack: p.pack, id: p.id })),
        audio,
        ...(systemId ? { systemId } : {})
      })
      // Las imágenes, del zip, una escena tras otra
      const images = filesFromZip(
        bytes,
        foundry,
        imported.scenes.flatMap((s) => s.background ?? [])
      )
      const plain: string[] = []
      for (const [index, scene] of imported.scenes.entries()) {
        setProgress({ name: scene.name, index: index + 1, total: imported.scenes.length, done: 0 })
        const found = await sourceFor(
          scene.background ? images.get(scene.background) : undefined,
          scene.background,
          scene.width,
          scene.height
        )
        if (!found) continue
        if (found.blank) plain.push(scene.name)
        const prepared = await preparer.prepare(scene.sceneId, found.source, {
          onProgress: (done, total) =>
            setProgress((current) => (current ? { ...current, done: total ? done / total : 0 } : current))
        }).done
        await api.call('setSceneImage', {
          sceneId: scene.sceneId,
          width: prepared.width,
          height: prepared.height,
          tiles: prepared.tiles
        })
      }
      setBlank(plain)
      setProgress(null)
      await queryClient.invalidateQueries({ queryKey: ['pages', world] })
      return imported
    },
    onError: () => {
      setProgress(null)
      setUploading(null)
    }
  })

  if (worlds.data && own.length === 0)
    return (
      <section className={styles.scenes} aria-label={t('systems.scenes.title')}>
        <p className={styles.note}>{t('systems.scenes.noWorld')}</p>
      </section>
    )

  if (run.data) return <ImportedScenes worldId={world ?? ''} imported={run.data} blank={blank} onDone={onDone} />

  return (
    <section className={styles.scenes} aria-labelledby={`${worldFieldId}-title`}>
      <h3 id={`${worldFieldId}-title`} className={styles.title}>
        {t('systems.scenes.title')}
      </h3>
      <div className={styles.where}>
        <div className={form.field}>
          <label htmlFor={worldFieldId}>{t('systems.scenes.world')}</label>
          <select
            id={worldFieldId}
            value={world ?? ''}
            onChange={(event) => {
              setWorldId(event.currentTarget.value)
              setParentId('')
            }}
          >
            {own.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className={form.field}>
          <label htmlFor={parentFieldId}>{t('systems.scenes.parent')}</label>
          <select id={parentFieldId} value={parentId} onChange={(event) => setParentId(event.currentTarget.value)}>
            <option value="">{t('systems.scenes.topLevel')}</option>
            {(tree.data?.pages ?? []).map((page) => (
              <option key={page.id} value={page.id}>
                {`${'  '.repeat(Math.max(0, page.level - 1))}${page.title}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      {read.isPending && world && <p className={styles.note}>{t('systems.scenes.reading')}</p>}
      <FormError message={read.error ? errorText(read.error) : null} />
      {read.data && (
        <fieldset className={styles.list}>
          <legend>{t('systems.scenes.chosen')}</legend>
          {adventures.map((adventure) => (
            <AdventureRow
              key={keyOf(adventure)}
              adventure={adventure}
              scenes={(read.data?.scenes ?? []).filter((s) => s.adventure === adventure.id)}
              thumbs={thumbs}
              checked={!unchecked.has(keyOf(adventure))}
              onChange={(on) => setUnchecked(toggle(unchecked, keyOf(adventure), on))}
            />
          ))}
          {loose.map((scene) => (
            <label key={keyOf(scene)} className={styles.row}>
              <input
                type="checkbox"
                checked={!unchecked.has(keyOf(scene))}
                onChange={(event) => setUnchecked(toggle(unchecked, keyOf(scene), event.currentTarget.checked))}
              />
              <SceneThumb url={thumbs.get(keyOf(scene))} />
              <SceneText scene={scene} />
            </label>
          ))}
          {playlists.map((playlist) => (
            <label key={keyOf(playlist)} className={styles.row}>
              <input
                type="checkbox"
                checked={!unchecked.has(keyOf(playlist))}
                onChange={(event) => setUnchecked(toggle(unchecked, keyOf(playlist), event.currentTarget.checked))}
              />
              <span className={styles.thumb} aria-hidden="true">
                <Music size={18} />
              </span>
              <PlaylistText playlist={playlist} />
            </label>
          ))}
        </fieldset>
      )}
      {uploading && (
        <p className={styles.progress} role="status">
          {t('systems.scenes.uploadingAudio', uploading)}
        </p>
      )}
      {progress && (
        <p className={styles.progress} role="status">
          {t('systems.scenes.preparing', {
            name: progress.name,
            index: progress.index,
            total: progress.total,
            percent: Math.round(progress.done * 100)
          })}
        </p>
      )}
      <FormError message={run.error ? errorText(run.error) : null} />
      {read.data && (
        <BusyButton
          type="button"
          className={form.button}
          busy={run.isPending}
          disabled={count === 0 && chosenPlaylists.length === 0}
          onClick={() => run.mutate()}
        >
          {count === 0 && chosenPlaylists.length > 0
            ? t('systems.scenes.importLists', { count: chosenPlaylists.length })
            : t('systems.scenes.import', { count })}
        </BusyButton>
      )}
    </section>
  )
}

const toggle = (set: ReadonlySet<string>, key: string, on: boolean) => {
  const next = new Set(set)
  if (on) next.delete(key)
  else next.add(key)
  return next
}

/** Las miniaturas de las escenas y portadas de las aventuras, sacadas del zip (direcciones de objeto) */
function useThumbnails(
  bytes: Uint8Array,
  foundry: FoundryZip,
  scenes: readonly FoundrySceneSummary[],
  adventures: readonly FoundryAdventureSummary[]
) {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    const wanted = new Map<string, string>()
    for (const s of scenes) {
      const path = s.thumb ?? s.background
      if (path && !VIDEO.test(path)) wanted.set(`${s.pack}/${s.id}`, path)
    }
    for (const a of adventures) if (a.img) wanted.set(`${a.pack}/${a.id}`, a.img)
    if (wanted.size === 0) return
    const files = filesFromZip(bytes, foundry, [...new Set(wanted.values())], THUMB_BYTES)
    const made = new Map<string, string>()
    const byPath = new Map<string, string>()
    for (const [key, path] of wanted) {
      const data = files.get(path)
      if (!data) continue
      const url = byPath.get(path) ?? URL.createObjectURL(new Blob([data as BlobPart]))
      byPath.set(path, url)
      made.set(key, url)
    }
    setUrls(made)
    return () => {
      for (const url of byPath.values()) URL.revokeObjectURL(url)
    }
  }, [bytes, foundry, scenes, adventures])
  return urls
}

function SceneThumb({ url, icon = 'map' }: { url: string | undefined; icon?: 'map' | 'book' }) {
  if (url) return <img className={styles.thumb} src={url} alt="" />
  return (
    <span className={styles.thumb} aria-hidden="true">
      {icon === 'book' ? <BookOpen size={18} /> : <MapIcon size={18} />}
    </span>
  )
}

/** El nombre de una escena y lo que trae, en pequeño; si ya se trajo, se dice */
function SceneText({ scene }: { scene: FoundrySceneSummary }) {
  const { t } = useTranslation()
  const parts = [
    t(`systems.scenes.grid.${scene.grid}`),
    t('systems.scenes.walls', { count: scene.walls }),
    ...(scene.doors ? [t('systems.scenes.doors', { count: scene.doors })] : []),
    ...(scene.lights ? [t('systems.scenes.lights', { count: scene.lights })] : []),
    ...(scene.tokens ? [t('systems.scenes.tokens', { count: scene.tokens })] : [])
  ]
  return (
    <span className={styles.text}>
      <span className={styles.name}>
        {scene.name}
        {scene.existing && <span className={styles.badge}>{t('systems.scenes.again')}</span>}
      </span>
      <span className={styles.meta}>{parts.join(' · ')}</span>
    </span>
  )
}

/** El nombre de una lista de sonido y lo que trae; si ya se trajo, se dice */
function PlaylistText({ playlist }: { playlist: FoundryPlaylistSummary }) {
  const { t } = useTranslation()
  return (
    <span className={styles.text}>
      <span className={styles.name}>
        {playlist.name}
        {playlist.existing && <span className={styles.badge}>{t('systems.scenes.again')}</span>}
      </span>
      <span className={styles.meta}>
        {[
          t(`systems.scenes.playlistKind.${playlist.kind}`),
          t('systems.scenes.tracks', { count: playlist.tracks })
        ].join(' · ')}
      </span>
    </span>
  )
}

function AdventureRow({
  adventure,
  scenes,
  thumbs,
  checked,
  onChange
}: {
  adventure: FoundryAdventureSummary
  scenes: readonly FoundrySceneSummary[]
  thumbs: ReadonlyMap<string, string>
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.adventure}>
      <label className={styles.row}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
        <SceneThumb url={thumbs.get(`${adventure.pack}/${adventure.id}`)} icon="book" />
        <span className={styles.text}>
          <span className={styles.name}>
            {adventure.name}
            {adventure.existing && <span className={styles.badge}>{t('systems.scenes.again')}</span>}
          </span>
          <span className={styles.meta}>
            {[
              t('systems.scenes.adventure'),
              t('systems.scenes.scenesCount', { count: adventure.scenes }),
              t('systems.scenes.journals', { count: adventure.journals })
            ].join(' · ')}
          </span>
        </span>
      </label>
      {scenes.length > 0 && (
        <ul className={styles.inside} aria-label={t('systems.scenes.ofAdventure', { name: adventure.name })}>
          {scenes.map((scene) => (
            <li key={scene.id}>
              <SceneThumb url={thumbs.get(`${scene.pack}/${scene.id}`)} />
              <SceneText scene={scene} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Lo traído: cada escena con sus criaturas preparadas y lo que no, y lo que se queda fuera */
function ImportedScenes({
  worldId,
  imported,
  blank,
  onDone
}: {
  worldId: string
  imported: Imported
  blank: readonly string[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const list = (names: readonly string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(names)
  return (
    <section className={styles.scenes} aria-label={t('systems.scenes.title')}>
      <p className={styles.title} role="status">
        {t('systems.scenes.done', { count: imported.scenes.length })}
      </p>
      <ul className={styles.result}>
        {imported.scenes.map((scene) => {
          const reasons = (reason: 'not-found' | 'no-actor' | 'character') =>
            scene.missing.filter((m) => m.reason === reason).map((m) => m.name || '?')
          return (
            <li key={scene.sceneId}>
              <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: scene.pageId }} onClick={onDone}>
                {scene.name}
              </Link>
              <span className={styles.meta}>
                {scene.updated ? t('systems.scenes.updated') : t('systems.scenes.created')}
                {' · '}
                {t('systems.scenes.prepared', { count: scene.prepared })}
              </span>
              {reasons('not-found').length > 0 && (
                <span className={styles.warn}>
                  {t('systems.scenes.notFound', { names: list(reasons('not-found')) })}
                </span>
              )}
              {reasons('character').length > 0 && (
                <span className={styles.meta}>
                  {t('systems.scenes.characters', { names: list(reasons('character')) })}
                </span>
              )}
              {reasons('no-actor').length > 0 && (
                <span className={styles.meta}>
                  {t('systems.scenes.noActor', { count: reasons('no-actor').length })}
                </span>
              )}
              {blank.includes(scene.name) && <span className={styles.meta}>{t('systems.scenes.blank')}</span>}
            </li>
          )
        })}
      </ul>
      {imported.pages.length > 0 && (
        <p className={styles.meta}>{t('systems.scenes.pages', { count: imported.pages.length })}</p>
      )}
      {imported.playlists.length > 0 && (
        <p className={styles.meta}>{t('systems.scenes.playlistsDone', { count: imported.playlists.length })}</p>
      )}
      {imported.missingAudio.length > 0 && (
        <div className={styles.meta}>
          <span className={styles.warn}>{t('systems.scenes.missingAudio')}</span>
          <ul className={styles.result}>
            {imported.missingAudio.map((missing) => (
              <li key={`${missing.name}|${missing.path}`}>
                {missing.name}
                <span className={styles.meta}>{t(`systems.scenes.missingReason.${missing.reason}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {imported.notes.map((note) => (
        <p key={note} className={styles.meta}>
          {note}
        </p>
      ))}
      <button type="button" className={form.button} onClick={onDone}>
        {t('systems.scenes.close')}
      </button>
    </section>
  )
}
