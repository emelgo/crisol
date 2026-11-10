import type { Campaign } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { ShowMenu } from './show-menu.tsx'

const CAMPAIGN = { id: crypto.randomUUID(), worldId: crypto.randomUUID(), name: 'La Marca', role: 'master' } as Campaign

function mount() {
  const onShow = vi.fn()
  const api = fakeApi({
    campaigns: [CAMPAIGN],
    members: {
      [CAMPAIGN.id]: [
        { userId: 'yo', name: 'Enrique', role: 'master' },
        { userId: 'ana', name: 'Ana', role: 'player' },
        { userId: 'bruno', name: 'Bruno', role: 'player' }
      ]
    }
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <ShowMenu campaignId={CAMPAIGN.id} busy={false} onShow={onShow} />
      </ApiProvider>
    </QueryClientProvider>
  )
  return onShow
}

describe('el menú «Enseñar»', () => {
  it('a todos y en la vista de jugadores', async () => {
    const user = userEvent.setup()
    const onShow = mount()
    await user.click(screen.getByRole('button', { name: 'Enseñar' }))
    await user.click(screen.getByRole('menuitem', { name: 'A todos' }))
    expect(onShow).toHaveBeenLastCalledWith({})
    await user.click(screen.getByRole('button', { name: 'Enseñar' }))
    await user.click(screen.getByRole('menuitem', { name: 'En la vista de jugadores' }))
    expect(onShow).toHaveBeenLastCalledWith({ screen: true })
  })

  it('a unos: sus casillas (solo jugadores) y «Enseñar»', async () => {
    const user = userEvent.setup()
    const onShow = mount()
    await user.click(screen.getByRole('button', { name: 'Enseñar' }))
    await user.click(screen.getByRole('menuitem', { name: 'A unos…' }))
    expect(screen.queryByRole('checkbox', { name: 'Enrique' })).toBeNull()
    await user.click(await screen.findByRole('checkbox', { name: 'Bruno' }))
    await user.click(screen.getAllByRole('button', { name: 'Enseñar' }).at(-1) as HTMLElement)
    expect(onShow).toHaveBeenLastCalledWith({ to: ['bruno'] })
  })
})
