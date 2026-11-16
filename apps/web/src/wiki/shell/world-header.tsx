/**
 * La cabecera fina del mundo a pantalla completa (ADR-0027), de cristal: la llama (vuelve a Mis mundos, con la
 * transición de salir), el nombre del mundo, las pestañas abiertas una sola vez, como las de un navegador, y a la
 * derecha, junto a la cuenta, los botones del mundo (su historial y su papelera, como en la barra de la
 * izquierda de fuera; Enrique, 2026-11-16). Pulsar el nombre abre los ajustes del mundo. El buscador va en la barra de la izquierda (Ctrl+K lo enfoca). Al entrar, la tarjeta del mundo se
 * convierte en ella
 */
import type { Page, World } from '@crisol/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { History, Settings, Trash2 } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountMenu } from '../../components/account-menu.tsx'
import { CrisolMark } from '../../components/brand.tsx'
import crucible from '../../components/crucible.module.css'
import { useHistoryAndTrash } from '../../components/world-hooks.ts'
import { justEnteredFull, LEAVE_WORLD_FULL, leaveWorld, worldTransition } from '../../components/world-transition.ts'
import { LookDialog, useWorldKind } from '../../routes/world-card.tsx'
import { OpenTabs } from '../navigation.tsx'
import { FileTabs } from './file-view.tsx'
import styles from './world-shell.module.css'

export function WorldHeader({
  world,
  current,
  currentFileId
}: {
  world: World
  current: Page | undefined
  /** El archivo abierto en el centro, si lo hay */
  currentFileId: string | undefined
}) {
  const { t } = useTranslation()
  // Recién entrado desde su tarjeta: la tarjeta se convierte en ella y la llama se aviva y suelta chispas (como la de
  // la barra antes); al rato, quietas
  const [entering, setEntering] = useState(justEnteredFull)
  useEffect(() => {
    if (!entering) return
    const timer = window.setTimeout(() => setEntering(false), 4500)
    return () => window.clearTimeout(timer)
  }, [entering])
  return (
    <header
      className={styles.header}
      // Al entrar, la tarjeta del mundo se convierte en ella; si no, va aparte en las transiciones (no parpadea al
      // cambiar de página: world-shell.module.css, solo mientras dura una, para que su cristal desenfoque)
      style={(entering && worldTransition(world.id)) || undefined}
      data-cabecera-mundo=""
    >
      <Link
        to="/mundos"
        className={entering ? `${styles.flame} ${crucible.cooking}` : styles.flame}
        // La llama de la barra de la app se convierte en esta al entrar, y esta en aquella al salir
        style={{ viewTransitionName: 'llama' } as CSSProperties}
        viewTransition={LEAVE_WORLD_FULL}
        onClick={leaveWorld}
        aria-label={t('app.name')}
        title={t('tour.world.back')}
        data-tour="barra-llama"
        translate="no"
      >
        <CrisolMark size={24} />
      </Link>
      <WorldName world={world} />
      <div className={styles.openTabs}>
        <OpenTabs worldId={world.id} current={current} variant="header" />
        <FileTabs worldId={world.id} currentFileId={currentFileId} />
      </div>
      <WorldTools world={world} />
      <nav className={styles.account} aria-label={t('app.accountNav')}>
        <AccountMenu variant="header" />
      </nav>
    </header>
  )
}

/** El nombre del mundo: pulsarlo abre sus ajustes (con un engranaje pequeño al pasar; Enrique, 2026-11-16) */
function WorldName({ world }: { world: World }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const kind = useWorldKind()
  const button = useRef<HTMLButtonElement>(null)
  const [settings, setSettings] = useState(false)
  return (
    <span className={styles.world}>
      <button
        ref={button}
        type="button"
        className={styles.worldButton}
        aria-haspopup="dialog"
        title={t('worldShell.settings')}
        onClick={() => setSettings(true)}
      >
        <span className={styles.worldName}>{world.name}</span>
        <Settings aria-hidden="true" size={14} className={styles.worldGear} />
        <span className={styles.hidden}>{t('worldShell.settings')}</span>
      </button>
      {settings && (
        <LookDialog
          kind={kind}
          look={world}
          // Borrado desde dentro: a Mis mundos, saliendo de él
          afterDelete={() => {
            leaveWorld()
            void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD_FULL })
          }}
          onClose={(gone) => {
            setSettings(false)
            if (!gone) button.current?.focus()
          }}
        />
      )}
    </span>
  )
}

/** Los botones del mundo, a la derecha junto a la cuenta: su historial y su papelera (icono y nombre debajo) */
function WorldTools({ world }: { world: World }) {
  const { t } = useTranslation()
  const { prefetchHistory, prefetchTrash, openHistory, openTrash } = useHistoryAndTrash(world.id)
  return (
    <div className={styles.worldTools} data-tour="menu-mundo">
      <button
        type="button"
        className={styles.worldTool}
        aria-haspopup="dialog"
        onPointerEnter={prefetchHistory}
        onFocus={prefetchHistory}
        onClick={(event) => openHistory(event.currentTarget)}
      >
        <History aria-hidden="true" size={16} />
        <span>{t('ribbon.history')}</span>
      </button>
      <button
        type="button"
        className={styles.worldTool}
        aria-haspopup="dialog"
        onPointerEnter={prefetchTrash}
        onFocus={prefetchTrash}
        onClick={(event) => openTrash(event.currentTarget)}
      >
        <Trash2 aria-hidden="true" size={16} />
        <span>{t('ribbon.trash')}</span>
      </button>
    </div>
  )
}
