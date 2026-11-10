/**
 * Lo pequeño del sonido (docs/specs/sonido.md): «Activar sonido» mientras el navegador no deje sonar, las barras que se
 * mueven cuando algo suena (abren la pestaña Sonido) y, en la vista de jugadores, todo junto con el recuadro de YouTube
 */
import { Volume2, VolumeX } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDismiss } from '../components/dismiss.ts'
import styles from './sound.module.css'
import type { TableSound } from './use-table-sound.tsx'
import { YoutubeDock } from './youtube.tsx'

/** «Activar sonido»: grande y en el centro en la vista de jugadores; en las Mesas, en la barra */
export function UnlockSound({ sound, big = false }: { sound: TableSound; big?: boolean }) {
  const { t } = useTranslation()
  if (!sound.blocked) return null
  return (
    <button
      type="button"
      className={big ? `${styles.unlock} ${styles.unlockBig}` : styles.unlock}
      onClick={sound.unlock}
    >
      <Volume2 aria-hidden="true" size={big ? 22 : 15} />
      {t('sound.unlock')}
    </button>
  )
}

/** Unas barras que se mueven mientras suena algo; sin nada sonando, no sale */
export function SoundBars({ sound, onOpen }: { sound: TableSound; onOpen: () => void }) {
  const { t } = useTranslation()
  const view = sound.view
  if (!view || view.voices.length === 0) return null
  return (
    <button
      type="button"
      className={styles.barsButton}
      aria-label={t('sound.open')}
      title={t('sound.open')}
      onClick={onOpen}
      data-paused={view.paused ? '' : undefined}
    >
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </button>
  )
}

/** En la vista de jugadores y en la Mesa de la jugadora: «Activar sonido» y el recuadro de YouTube */
export function SoundStage({ sound, variant }: { sound: TableSound; variant: 'screen' | 'mesa' }) {
  return (
    <>
      <div className={variant === 'screen' ? styles.stageCenter : styles.stageTop}>
        <UnlockSound sound={sound} big={variant === 'screen'} />
      </div>
      {variant === 'mesa' && <DeviceVolume sound={sound} />}
      <YoutubeDock
        view={sound.view}
        clock={sound.clock}
        device={sound.device}
        onBlocked={sound.setYoutubeBlocked}
        registerUnlock={sound.registerUnlock}
        className={variant === 'screen' ? styles.dockScreen : styles.dockMesa}
      />
    </>
  )
}

/**
 * En la Mesa de la jugadora: el volumen de su aparato (ambiente, efectos y silenciar), para que en la mesa no suenen
 * cinco móviles a la vez (docs/specs/sonido.md)
 */
function DeviceVolume({ sound }: { sound: TableSound }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, panel, button)
  const { device, setDevice } = sound
  const Icon = device.muted ? VolumeX : Volume2
  return (
    <div className={styles.deviceDock}>
      <button
        ref={button}
        type="button"
        className={styles.deviceButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('sound.deviceVolume')}
        title={t('sound.deviceVolume')}
        onClick={() => setOpen(!open)}
      >
        <Icon aria-hidden="true" size={18} />
      </button>
      {open && (
        <div ref={panel} className={styles.devicePanel} role="dialog" aria-label={t('sound.deviceVolume')}>
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
              checked={device.muted}
              onChange={(event) => setDevice({ muted: event.currentTarget.checked })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
