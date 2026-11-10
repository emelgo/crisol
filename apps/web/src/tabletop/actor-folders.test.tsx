import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { ActorsTab } from './actor-folders.tsx'
import { WindowsProvider } from './windows.tsx'

const CAMPAIGN = crypto.randomUUID()

function mount() {
  const api = fakeApi({})
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <WindowsProvider area={{ current: null }}>
          <ActorsTab
            campaignId={CAMPAIGN}
            systemId={null}
            table={null}
            canPlace={false}
            onPlace={() => {}}
            onOpenCharacter={() => {}}
          />
        </WindowsProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
  return api
}

describe('las carpetas de Actores', () => {
  it('se crea una con su nombre, se le cambia y se quita', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Carpeta nueva' }))
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la carpeta' }), 'Los Varn{Enter}')
    const folder = await screen.findByRole('button', { name: 'Los Varn' })
    expect(folder.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Sin carpeta' })).toBeDefined()
    // Plegarla
    await user.click(folder)
    expect(folder.getAttribute('aria-expanded')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'Opciones de Los Varn' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cambiar el nombre' }))
    const field = screen.getByRole('textbox', { name: 'Nombre de la carpeta' })
    await user.clear(field)
    await user.type(field, 'Casa Varn{Enter}')
    expect(await screen.findByRole('button', { name: 'Casa Varn' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Opciones de Casa Varn' }))
    await user.click(screen.getByRole('menuitem', { name: 'Quitar la carpeta' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Casa Varn' })).toBeNull())
  })
})
