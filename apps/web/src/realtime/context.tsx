import type { RealtimeMessage } from '@crisol/contracts'
import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAccounts } from '../account/context.tsx'
import type { RealtimeClient } from './client.ts'

/** Alguien ha entrado en una campaña del máster */
export type JoinNotice = Extract<RealtimeMessage, { type: 'joined' }> & { id: string }

const NoticesContext = createContext<{ notices: JoinNotice[]; dismiss(id: string): void; newVersion: boolean }>({
  notices: [],
  dismiss: () => {},
  newVersion: false
})

/** Qué consultas de la web hay que volver a pedir con cada aviso. El historial y la papelera, con cualquier cambio */
export function queriesFor(message: RealtimeMessage): QueryKey[] {
  return message.type === 'hello' ? [] : [...changedBy(message), ['history'], ['trash']]
}

function changedBy(message: RealtimeMessage): QueryKey[] {
  switch (message.type) {
    case 'changed':
      if (message.what === 'worlds' || message.what === 'approvals') return [[message.what]]
      if (message.what === 'campaigns') return [['campaigns', message.worldId]]
      // Lo que lleva etiquetas cambia también su catálogo
      if (message.what === 'pages') return [['pages', message.worldId], ['tags']]
      if (message.what === 'files') return [['files', message.worldId], ['tags']]
      // Los comunes salen en los archivos de todos los mundos
      if (message.what === 'commonFiles') return [['files'], ['commonFiles'], ['tags']]
      if (message.what === 'tags') return [['tags']]
      // El texto de una página: lo que la enseña en otra y los enlaces (sus trozos)
      if (message.what === 'pageContent') {
        return [
          ['pages', message.worldId, 'content', message.pageId],
          ['pages', message.worldId, 'links']
        ]
      }
      return [[message.what, message.campaignId]]
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
  const [newVersion, setNewVersion] = useState(false)
  // Otra cuenta, otro canal (y los avisos de la anterior se van con AccountScope)
  const signedIn = account?.email ?? null

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
      },
      // Tras un corte pudo perderse algo: se vuelve a pedir todo lo que está a la vista
      onReconnect: () => void refresh(),
      onNewVersion: () => setNewVersion(true),
      // Se vuelve a pedir la sesión: sin ella, AccountScope lo quita todo y las páginas llevan a entrar
      onSessionEnded: () => accounts.refreshSession()
    })
  }, [client, queryClient, accounts, signedIn])

  const dismiss = useCallback((id: string) => setNotices((current) => current.filter((n) => n.id !== id)), [])
  const value = useMemo(() => ({ notices, dismiss, newVersion }), [notices, dismiss, newVersion])
  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>
}

export function useNotices() {
  return useContext(NoticesContext)
}
