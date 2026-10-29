import { createContext, type ReactNode, useContext } from 'react'
import type { AccountClient } from './client.ts'

const AccountsContext = createContext<AccountClient | null>(null)

export function AccountsProvider({ client, children }: { client: AccountClient; children: ReactNode }) {
  return <AccountsContext.Provider value={client}>{children}</AccountsContext.Provider>
}

export function useAccounts(): AccountClient {
  const client = useContext(AccountsContext)
  if (!client) throw new Error('Falta AccountsProvider')
  return client
}
