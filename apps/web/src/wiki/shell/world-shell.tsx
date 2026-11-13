/**
 * El mundo del máster a pantalla completa, como la Mesa (ADR-0027): arriba, una cabecera fina de cristal (la llama, el
 * mundo con su menú, las pestañas abiertas, buscar y la cuenta); a la izquierda, una barra de pestañas (Páginas y
 * Archivos) que se pliega y se estira; en el centro, lo de cada ruta (la página, buscar, un archivo, «Ver todos»). Vive
 * mientras se está en el mundo: cambiar de página no lo rehace
 */
import type { Page } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from 'react'
import { useAccounts } from '../../account/context.tsx'
import { useApi } from '../../api/context.tsx'
import { useAmbient } from '../../components/ambient.tsx'
import { shownPath } from '../../shown-path.ts'
import { CollabSocket } from '../collab.tsx'
import { WorldFilesSide } from '../files.tsx'
import { WorldWindows } from '../new-entry.tsx'
import { NewPageContext, NewPageDialog, type NewPageRequest } from '../new-page.tsx'
import { QuickSwitcher } from '../quick-switcher.tsx'
import { WorldTour } from '../world-tour.tsx'
import { pageKey, WorldShellContext, type WorldShellValue } from './context.ts'
import { sideTabOfSlug, useShellState } from './shell-state.ts'
import { WorldHeader } from './world-header.tsx'
import styles from './world-shell.module.css'
import { WorldSidebar } from './world-sidebar.tsx'

/** Las direcciones del mundo que van en su armazón (las de ahora: enlaces y la IA dependen de ellas) */
const SHELL_PATH = /^\/mundos\/([^/]+)(?:\/(?:wiki(?:\/[^/]+)?|buscar|archivos|archivo\/[^/]+|etiquetas))?\/?$/

/** El mundo de la dirección si va en su armazón (si lo dirige la cuenta: eso lo decide quien lo llama) */
export const shellWorldOf = (path: string) => SHELL_PATH.exec(path)?.[1]

/** La portada del mundo (/mundos/$w) también la ve quien juega, sin armazón: solo lo demás es solo del máster */
export const isWorldHome = (path: string) => /^\/mundos\/[^/]+\/?$/.test(path)

/**
 * El mundo de la dirección, si va a pantalla completa: el que dirige la cuenta. bare: sin la barra de la app; pending:
 * aún no se sabe si lo dirige
 */
export function useWorldShellRoute() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const path = useRouterState({ select: (state) => shownPath(state) })
  const worldId = shellWorldOf(path)
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  if (!worldId || !account) return { worldId: undefined, bare: false, pending: false }
  // Mientras no se sabe, nada (la llama en el centro): si no, lo de dentro se montaría dos veces, sin el armazón y con él.
  // Solo en el primer intento: si falla, lo de siempre, que reintenta con su «Cargando…» y acaba en el error (montarlo
  // tras el error lo volvería a pedir y la llama volvería, sin salir nunca de ella)
  if (worlds.data === undefined && worlds.isPending && worlds.failureCount === 0) {
    return { worldId: undefined, bare: true, pending: true }
  }
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  if (world?.role === 'master') return { worldId, bare: true, pending: false }
  // Quien juega (su portada) o un mundo que no existe: como siempre, con la barra
  return { worldId: undefined, bare: false, pending: false }
}

/** La página abierta (la de la dirección o, en /mundos/$w, la portada del mundo), de la misma caché que la ruta */
function useCurrentPage(worldId: string): Page | undefined {
  const api = useApi()
  const path = useRouterState({ select: (state) => shownPath(state) })
  const pageId = /^\/mundos\/[^/]+\/wiki\/([^/]+)/.exec(path)?.[1]
  const atHome = isWorldHome(path)
  const home = useQuery({
    queryKey: ['pages', worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId }),
    enabled: atHome
  })
  const id = pageId ?? (atHome ? (home.data?.pageId ?? undefined) : undefined)
  const page = useQuery({
    queryKey: pageKey(worldId, id ?? ''),
    queryFn: () => api.call('getPage', { pageId: id ?? '' }),
    enabled: Boolean(id)
  })
  return id ? page.data : undefined
}

export function WorldShell({
  worldId,
  notices,
  children
}: {
  worldId: string
  /** Lo que avisa (aprobaciones de la IA, avisos), al principio del contenido */
  notices: ReactNode
  children: ReactNode
}) {
  const api = useApi()
  const state = useShellState()
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  const current = useCurrentPage(worldId)
  const navigate = useNavigate()
  const currentFileId = useRouterState({
    select: (routerState) => /^\/mundos\/[^/]+\/archivo\/([^/]+)/.exec(shownPath(routerState))?.[1]
  })
  // Detrás, los fondos de Crisol, que se van turnando (Enrique, 2026-11-13: «no hace falta tener la portada de fondo»)
  useAmbient(null)
  // La pestaña de la barra que pida la dirección (?barra=archivos), como el ?panel= de la Mesa
  const asked = useRouterState({
    select: (routerState) => sideTabOfSlug((routerState.location.search as { barra?: unknown }).barra)
  })
  // Solo cuando cambia lo pedido (al llegar con ella o al seguir un enlace): luego, la que se elija
  const [seenAsked, setSeenAsked] = useState<typeof asked>(null)
  if (asked !== seenAsked) {
    setSeenAsked(asked)
    if (asked) {
      state.setTab(asked)
      state.setFolded(false)
    }
  }
  // El cuadro de «Página nueva» (o de una subpágina): cada vez, uno nuevo (su número)
  const [creating, setCreating] = useState<{ parent: { id: string; title: string } | null; n: number } | null>(null)
  const requestNewPage = useCallback<NewPageRequest>((parent) => setCreating({ parent, n: Date.now() }), [])
  const [switching, setSwitching] = useState(false)
  const value = useMemo<WorldShellValue>(
    () => ({ worldId, panelFolded: state.panelFolded, setPanelFolded: state.setPanelFolded }),
    [worldId, state.panelFolded, state.setPanelFolded]
  )
  if (!world) return null
  return (
    <WorldShellContext value={value}>
      {/* Sus ventanas flotantes (una entrada nueva del compendio), por encima de todo */}
      <WorldWindows worldId={worldId}>
        <NewPageContext.Provider value={requestNewPage}>
          <div
            className={styles.shell}
            data-world-shell=""
            style={{ '--side-width': `${state.width}px` } as CSSProperties}
          >
            <WorldHeader
              world={world}
              current={current}
              currentFileId={currentFileId}
              onSearch={() => setSwitching(true)}
            />
            <div className={styles.body} data-side-folded={state.folded || undefined}>
              <WorldSidebar
                worldId={worldId}
                current={current}
                tab={state.tab}
                onTab={state.setTab}
                folded={state.folded}
                onFold={state.setFolded}
                width={state.width}
                onWidth={state.setWidth}
                onNewPage={() => requestNewPage(null)}
                files={
                  <WorldFilesSide
                    worldId={worldId}
                    organizationId={world.organizationId}
                    currentFileId={currentFileId}
                    onOpenFile={(file) =>
                      void navigate({ to: '/mundos/$worldId/archivo/$fileId', params: { worldId, fileId: file.id } })
                    }
                  />
                }
              />
              <main id="contenido" className={styles.center} data-contenido="" data-world-center="">
                {notices}
                <CollabSocket>{children}</CollabSocket>
              </main>
            </div>
          </div>
          <QuickSwitcher
            worldId={worldId}
            open={switching}
            onOpenChange={setSwitching}
            onCreatePage={() => requestNewPage(null)}
          />
          {creating && (
            <NewPageDialog
              key={creating.n}
              worldId={worldId}
              parent={creating.parent}
              onClose={() => setCreating(null)}
            />
          )}
          <WorldTour master />
        </NewPageContext.Provider>
      </WorldWindows>
    </WorldShellContext>
  )
}
