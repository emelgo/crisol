/**
 * Lo pequeño del sonido (docs/specs/sonido.md): «Activar sonido» mientras el navegador no deje sonar, las barras que se
 * mueven cuando algo suena (abren la pestaña Sonido) y, en la vista de jugadores, todo junto con el recuadro de YouTube
 */
import { Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
