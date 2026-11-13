/**
 * La cabecera fina del mundo a pantalla completa (ADR-0027), de cristal: la llama (vuelve a Mis mundos, con la
 * transición de salir), el mundo con su menú (Ajustes del mundo, Historial, Papelera, Exportar), las pestañas abiertas
 * una sola vez, como las de un navegador, el buscador (Ctrl+K) y la cuenta. Al entrar, la tarjeta del mundo se
 * convierte en ella
 */
import type { Page, World } from '@crisol/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, Download, History, Search, Settings, Trash2 } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountMenu } from '../../components/account-menu.tsx'
import { CrisolMark } from '../../components/brand.tsx'
import crucible from '../../components/crucible.module.css'
import { Menu, MenuItem } from '../../components/menu.tsx'
import { useHistoryAndTrash } from '../../components/world-hooks.ts'
import { justEnteredFull, LEAVE_WORLD_FULL, leaveWorld, worldTransition } from '../../components/world-transition.ts'
import { LookDialog, useWorldKind } from '../../routes/world-card.tsx'
import { useExport } from '../export.tsx'
import { OpenTabs } from '../navigation.tsx'
import styles from './world-shell.module.css'

export function WorldHeader({
  world,
  current,
  onSearch
}: {
  world: World
  current: Page | undefined
  onSearch: () => void
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
      // cambiar de página)
      style={((entering && worldTransition(world.id)) || { viewTransitionName: 'cabecera-mundo' }) as CSSProperties}
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
      <WorldMenu world={world} />
      <div className={styles.openTabs}>
        <OpenTabs worldId={world.id} current={current} variant="header" />
      </div>
      <button type="button" className={styles.search} aria-haspopup="dialog" data-tour="buscar" onClick={onSearch}>
        <Search aria-hidden="true" size={15} />
        <span>{t('worldShell.search')}</span>
        <kbd>{t('worldShell.searchKeys')}</kbd>
      </button>
      <nav className={styles.account} aria-label={t('app.accountNav')}>
        <AccountMenu variant="header" />
      </nav>
    </header>
  )
}

/** El nombre del mundo y, al pulsarlo, su menú: sus ajustes, su historial, su papelera y exportarlo */
function WorldMenu({ world }: { world: World }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const kind = useWorldKind()
  const { prefetchHistory, prefetchTrash, openHistory, openTrash } = useHistoryAndTrash(world.id)
  const run = useExport()
  const box = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState(false)
  // Lo que se abre encima devuelve el foco al botón del menú
  const trigger = () => box.current?.querySelector<HTMLButtonElement>('button')
  return (
    <div ref={box} className={styles.world}>
      <Menu
        label={t('worldShell.worldMenu', { world: world.name })}
        className={styles.worldButton}
        icon={
          <>
            <span className={styles.worldName}>{world.name}</span>
            <ChevronDown aria-hidden="true" size={14} />
          </>
        }
      >
        {(close) => (
          <>
            <MenuItem
              aria-haspopup="dialog"
              onClick={() => {
                close()
                setSettings(true)
              }}
            >
              <Settings aria-hidden="true" size={15} />
              {t('worldShell.settings')}
            </MenuItem>
            <MenuItem
              aria-haspopup="dialog"
              onPointerEnter={prefetchHistory}
              onFocus={prefetchHistory}
              onClick={() => {
                close()
                openHistory(trigger())
              }}
            >
              <History aria-hidden="true" size={15} />
              {t('ribbon.history')}
            </MenuItem>
            <MenuItem
              aria-haspopup="dialog"
              onPointerEnter={prefetchTrash}
              onFocus={prefetchTrash}
              onClick={() => {
                close()
                openTrash(trigger())
              }}
            >
              <Trash2 aria-hidden="true" size={15} />
              {t('ribbon.trash')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                close()
                run.mutate({ worldId: world.id })
              }}
            >
              <Download aria-hidden="true" size={15} />
              {t('worldShell.export')}
            </MenuItem>
          </>
        )}
      </Menu>
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
            if (!gone) trigger()?.focus()
          }}
        />
      )}
    </div>
  )
}
