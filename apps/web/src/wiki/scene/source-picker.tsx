/**
 * De dónde sale el mapa de una escena: una imagen del mundo (en miniatura), una que se sube en ese momento o un UVTT,
 * que trae sus muros y sus luces. Elegir una ya la da (quien lo usa decide si empieza al momento o al pulsar «Crear»)
 */
import { isUvttFile } from '@crisol/tabletop'
import { Box, ImageIcon, Upload } from 'lucide-react'
import { type DragEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SceneChoice } from '../../tabletop/use-preparation.ts'
import { useWorldFiles } from '../cover-look.ts'
import styles from './scene.module.css'

type Source = 'world' | 'image' | 'uvtt'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
/** Del mundo, también los SVG (los mapas que dibuja la IA): se pintan en la página antes de trocearlos */
const WORLD_TYPES = [...IMAGE_TYPES, 'image/svg+xml']

export function SourcePicker({
  worldId,
  value,
  onChange
}: {
  worldId: string
  value: SceneChoice | null
  onChange: (choice: SceneChoice) => void
}) {
  const { t } = useTranslation()
  const [source, setSource] = useState<Source>(value?.kind === 'image' || value?.kind === 'uvtt' ? value.kind : 'world')
  const files = useWorldFiles(worldId)
  const name = useId()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const images = files.data?.files.filter((file) => file.kind === 'image' && WORLD_TYPES.includes(file.mime)) ?? []
  const picked = (file: File) => {
    if (source === 'uvtt' ? isUvttFile(file.name) : IMAGE_TYPES.includes(file.type))
      onChange(source === 'uvtt' ? { kind: 'uvtt', file } : { kind: 'image', file })
  }
  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files[0]
    if (file) picked(file)
  }
  const SOURCES = [
    { key: 'world', icon: ImageIcon, label: t('scene.sources.world'), hint: t('scene.sources.worldHint') },
    { key: 'image', icon: Upload, label: t('scene.sources.upload'), hint: t('scene.sources.uploadHint') },
    { key: 'uvtt', icon: Box, label: t('scene.sources.uvtt'), hint: t('scene.sources.uvttHint') }
  ] as const
  return (
    <div className={styles.picker}>
      <fieldset className={styles.sources}>
        <legend>{t('scene.map')}</legend>
        {SOURCES.map(({ key, icon: Icon, label, hint }) => (
          <label key={key} className={styles.source}>
            <input type="radio" name={name} checked={source === key} onChange={() => setSource(key)} />
            <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
            <span className={styles.sourceName}>{label}</span>
            <span className={styles.sourceHint}>{hint}</span>
          </label>
        ))}
      </fieldset>
      {source === 'world' ? (
        images.length > 0 ? (
          <ul className={styles.thumbs} aria-label={t('scene.sources.world')}>
            {images.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  aria-pressed={value?.kind === 'world' && value.file.id === file.id}
                  onClick={() => onChange({ kind: 'world', file: { id: file.id, url: file.url } })}
                >
                  <img src={file.url} alt="" loading="lazy" />
                  <span>{file.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          files.data && <p className={styles.muted}>{t('scene.noImages')}</p>
        )
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: soltar un archivo es un atajo del ratón; con el teclado, el botón de dentro
        <div
          className={styles.drop}
          data-over={over || undefined}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          {source === 'uvtt' ? t('scene.dropUvtt') : t('scene.dropImage')}{' '}
          <button type="button" className={styles.link} onClick={() => input.current?.click()}>
            {t('scene.choose')}
          </button>
          {value && value.kind === source && 'name' in value.file && (
            <span className={styles.chosen}>{(value.file as File).name}</span>
          )}
          <input
            key={source}
            ref={input}
            type="file"
            hidden
            accept={source === 'uvtt' ? '.dd2vtt,.uvtt,.df2vtt' : IMAGE_TYPES.join(',')}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) picked(file)
            }}
          />
        </div>
      )}
    </div>
  )
}
