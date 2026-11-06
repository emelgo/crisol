import type { DiceRoll, RealtimeMessage } from '@crisol/contracts'
import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAccounts } from '../account/context.tsx'
import { appendRoll } from '../dice/rolls.ts'
import type { RealtimeClient } from './client.ts'

/** Alguien ha entrado en una campaña del máster */
export type JoinNotice = Extract<RealtimeMessage, { type: 'joined' }> & { id: string }
/** Lo que se le acaba de revelar a quien juega (docs/specs/revelar.md) */
export type RevealNotice = Extract<RealtimeMessage, { type: 'revealed' }> & { id: string }

const NoticesContext = createContext<{
  notices: JoinNotice[]
  dismiss(id: string): void
  newVersion: boolean
  revealed: RevealNotice[]
  dismissRevealed(id: string): void
}>({
  notices: [],
  dismiss: () => {},
  revealed: [],
  dismissRevealed: () => {},
  newVersion: false
})

/** Qué consultas de la web hay que volver a pedir con cada aviso. El historial y la papelera, con cualquier cambio */
export function queriesFor(message: RealtimeMessage): QueryKey[] {
  // Las tiradas llegan enteras (ADR-0010) y no son del historial: no hay nada que volver a pedir
  return message.type === 'hello' || message.type === 'rolled' ? [] : [...changedBy(message), ['history'], ['trash']]
}

type RollListener = (roll: DiceRoll) => void
const RollsContext = createContext<{ listen(listener: RollListener): () => void }>({ listen: () => () => {} })

/** Hace algo con cada tirada que llega en vivo (anunciarla, hacer caer sus dados) */
export function useRolled(listener: RollListener) {
  const { listen } = useContext(RollsContext)
  const current = useRef(listener)
  current.current = listener
  useEffect(() => listen((roll) => current.current(roll)), [listen])
}

function changedBy(message: RealtimeMessage): QueryKey[] {
  switch (message.type) {
    case 'changed':
      if (message.what === 'worlds' || message.what === 'approvals') return [[message.what]]
      if (message.what === 'campaigns') return [['campaigns', message.worldId]]
      // Lo que lleva etiquetas cambia también su catálogo
      if (message.what === 'pages') return [['pages', message.worldId], ['tags']]
      // Lo que sabe una campaña (ADR-0017): todo lo de las páginas del mundo se vuelve a pedir, ya proyectado
      if (message.what === 'knowledge') return [['pages', message.worldId]]
      if (message.what === 'files') return [['files', message.worldId], ['tags']]
      // Los comunes salen en los archivos de todos los mundos
      if (message.what === 'commonFiles') return [['files'], ['commonFiles'], ['tags']]
      if (message.what === 'tags') return [['tags']]
      if (message.what === 'templates') return [['templates']]
      if (message.what === 'systems') return [['systems']]
      // Lo del mundo sale en el compendio de sus campañas y en lo que llevan sus personajes
      if (message.what === 'worldContent') return [['compendium'], ['characters'], ['character']]
      // El texto de una página: lo que la enseña en otra y los enlaces (sus trozos)
      if (message.what === 'pageContent') {
        return [
          ['pages', message.worldId, 'content', message.pageId],
          ['pages', message.worldId, 'links']
        ]
      }
      // Las criaturas en juego: la lista y la abierta
      if (message.what === 'creatures') return [['creatures', message.campaignId], ['creature']]
      // El grupo: su inventario y lo que llevan sus personajes (si se movió algo)
      if (message.what === 'party')
        return [
          ['party', message.campaignId],
          // Solo los personajes que cambiaron (al deshacer no se sabe: todos)
          ...(message.characters ? message.characters.map((id) => ['character', id]) : [['character']]),
          ['characters', message.campaignId]
        ]
      return [[message.what, message.campaignId]]
    // Lo revelado: lo de las páginas del mundo (su árbol, lo nuevo) se vuelve a pedir
    case 'revealed':
      return [['pages', message.worldId]]
    case 'joined':
      return [
        ['members', message.campaignId],
        ['invitation', message.campaignId]
      ]
    // Ya no está en la campaña: puede que tampoco en el mundo ni en la organización
    case 'revoked':
      return [['worlds'], ['organizations'], ['campaigns', message.worldId]]
    // El saludo lo atiende el cliente; uno que no se conoce (de una versión más nueva), nada
    default:
      return []
  }
}

/** Abre el canal mientras haya sesión: vuelve a pedir lo que cambia y guarda los avisos de entrada */
export function RealtimeProvider({ client, children }: { client: RealtimeClient; children: ReactNode }) {
  const queryClient = useQueryClient()
  const accounts = useAccounts()
  const { account } = accounts.useAccount()
  const [notices, setNotices] = useState<JoinNotice[]>([])
  const [revealed, setRevealed] = useState<RevealNotice[]>([])
  const [newVersion, setNewVersion] = useState(false)
  // Otra cuenta, otro canal (y los avisos de la anterior se van con AccountScope)
  const signedIn = account?.email ?? null
  const rollListeners = useRef(new Set<RollListener>())
  const rolls = useMemo(
    () => ({
      listen: (listener: RollListener) => {
        rollListeners.current.add(listener)
        return () => {
          rollListeners.current.delete(listener)
        }
      }
    }),
    []
  )

  useEffect(() => {
    if (!signedIn) return
    // Lo que ya se estaba pidiendo pudo salir antes del cambio: se cancela y se vuelve a pedir. Invalidar sin más no lo
    // repite si aún no tiene datos (se queda con la respuesta en camino, la de antes del cambio)
    const refresh = async (queryKey?: QueryKey) => {
      await queryClient.cancelQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey })
    }
    return client.connect({
      onMessage: (message) => {
        for (const queryKey of queriesFor(message)) void refresh(queryKey)
        if (message.type === 'joined') setNotices((current) => [...current, { ...message, id: crypto.randomUUID() }])
        if (message.type === 'revealed')
          setRevealed((current) => [...current, { ...message, id: crypto.randomUUID() }].slice(-3))
        if (message.type === 'rolled') {
          appendRoll(queryClient, message.roll)
          for (const listener of rollListeners.current) listener(message.roll)
        }
      },
      // Tras un corte pudo perderse algo: se vuelve a pedir todo lo que está a la vista
      onReconnect: () => void refresh(),
      onNewVersion: () => setNewVersion(true),
      // Se vuelve a pedir la sesión: sin ella, AccountScope lo quita todo y las páginas llevan a entrar
      onSessionEnded: () => accounts.refreshSession()
    })
  }, [client, queryClient, accounts, signedIn])

  const dismiss = useCallback((id: string) => setNotices((current) => current.filter((n) => n.id !== id)), [])
  const dismissRevealed = useCallback((id: string) => setRevealed((current) => current.filter((n) => n.id !== id)), [])
  const value = useMemo(
    () => ({ notices, dismiss, newVersion, revealed, dismissRevealed }),
    [notices, dismiss, newVersion, revealed, dismissRevealed]
  )
  return (
    <NoticesContext.Provider value={value}>
      <RollsContext.Provider value={rolls}>{children}</RollsContext.Provider>
    </NoticesContext.Provider>
  )
}

export function useNotices() {
  return useContext(NoticesContext)
}
