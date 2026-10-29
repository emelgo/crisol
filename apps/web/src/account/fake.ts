/** Cliente de cuentas en memoria para las pruebas de componentes */
import { useSyncExternalStore } from 'react'
import type { Account, AccountClient, Result } from './client.ts'

export function fakeAccountClient(options: { account?: Account | null; bootstrap?: Record<string, string> } = {}) {
  let account = options.account ?? null
  const listeners = new Set<() => void>()
  const set = (next: Account | null) => {
    account = next
    for (const listener of listeners) listener()
  }
  const passwords = new Map<string, string>()
  const calls: string[] = []

  const client: AccountClient = {
    useAccount: () => ({
      account: useSyncExternalStore(
        (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        () => account
      ),
      pending: false
    }),
    async signIn(email, password): Promise<Result> {
      calls.push(`signIn ${email}`)
      if (passwords.get(email) !== password) return { ok: false, code: 'INVALID_CREDENTIALS' }
      set({ name: 'Enrique', email })
      return { ok: true }
    },
    async signOut() {
      calls.push('signOut')
      set(null)
    },
    async rename(name): Promise<Result> {
      if (account) set({ ...account, name })
      return { ok: true }
    },
    async bootstrapInfo(secret) {
      const organizationName = options.bootstrap?.[secret]
      return organizationName ? { organizationName } : null
    },
    async redeemBootstrap({ secret, name, email, password }): Promise<Result> {
      if (!options.bootstrap?.[secret]) return { ok: false, code: 'INVALID_LINK' }
      if (passwords.has(email)) return { ok: false, code: 'EMAIL_TAKEN' }
      passwords.set(email, password)
      set({ name, email })
      return { ok: true }
    }
  }
  return { client, calls, passwords }
}
