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

/** Qué consultas de la web hay que volver a pedir con cada aviso */
export function queriesFor(message: RealtimeMessage): QueryKey[] {
  switch (message.type) {
    case 'changed':
      if (message.what === 'worlds') return [['worlds']]
      if (message.what === 'campaigns') return [['campaigns', message.worldId]]
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
  const { account } = useAccounts().useAccount()
  const [notices, setNotices] = useState<JoinNotice[]>([])
  const [newVersion, setNewVersion] = useState(false)
  // Otra cuenta, otro canal
  const signedIn = account?.email ?? null

  useEffect(() => {
    setNotices([])
    if (!signedIn) return
    return client.connect({
      onMessage: (message) => {
        for (const queryKey of queriesFor(message)) void queryClient.invalidateQueries({ queryKey })
        if (message.type === 'joined') setNotices((current) => [...current, { ...message, id: crypto.randomUUID() }])
      },
      // Tras un corte pudo perderse algo: se vuelve a pedir todo lo que está a la vista
      onReconnect: () => void queryClient.invalidateQueries(),
      onNewVersion: () => setNewVersion(true)
    })
  }, [client, queryClient, signedIn])

  const dismiss = useCallback((id: string) => setNotices((current) => current.filter((n) => n.id !== id)), [])
  const value = useMemo(() => ({ notices, dismiss, newVersion }), [notices, dismiss, newVersion])
  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>
}

export function useNotices() {
  return useContext(NoticesContext)
}
