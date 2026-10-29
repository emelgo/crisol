/** Cliente de cuentas en memoria para las pruebas de componentes */
import { useSyncExternalStore } from 'react'
import type { Account, AccountClient, Result } from './client.ts'

/** Una invitación del cliente falso: lo que enseña la página y adónde lleva */
export interface FakeInvitation {
  campaignName: string
  worldName: string
  masterName: string | null
  worldId: string
  campaignId: string
  /** El rol de la cuenta en la campaña, si ya está */
  role?: 'master' | 'player'
}

export function fakeAccountClient(
  options: {
    account?: Account | null
    bootstrap?: Record<string, string>
    oauthClients?: Record<string, string>
    invitations?: Record<string, FakeInvitation>
  } = {}
) {
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
    async oauthClientName(clientId) {
      return options.oauthClients?.[clientId] ?? null
    },
    async consent(accept): Promise<Result> {
      calls.push(`consent ${accept}`)
      return { ok: true }
    },
    async invitationInfo(secret) {
      const found = options.invitations?.[secret]
      return found
        ? { campaignName: found.campaignName, worldName: found.worldName, masterName: found.masterName }
        : null
    },
    async join(secret) {
      calls.push(`join ${secret}`)
      const found = options.invitations?.[secret]
      if (!found) return { ok: false, code: 'INVALID_LINK' }
      const status = found.role === 'master' ? 'master' : found.role ? 'member' : 'joined'
      found.role ??= 'player'
      return { ok: true, status, worldId: found.worldId, campaignId: found.campaignId }
    },
    async signUpAndJoin({ secret, name, email, password }) {
      const found = options.invitations?.[secret]
      if (!found) return { ok: false, code: 'INVALID_LINK' }
      if (passwords.has(email)) return { ok: false, code: 'EMAIL_TAKEN' }
      passwords.set(email, password)
      set({ name, email })
      found.role = 'player'
      return { ok: true, status: 'joined', worldId: found.worldId, campaignId: found.campaignId }
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
