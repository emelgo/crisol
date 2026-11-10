import type { Campaign, SoundPlaylistView } from '@crisol/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiProvider } from '../api/context.tsx'
import { fakeApi } from '../api/fake.ts'
import '../i18n.ts'
import { SoundBars, UnlockSound } from './controls.tsx'
import { SoundTab } from './sound-tab.tsx'
import { SoundContext, useTableSound } from './use-table-sound.tsx'

const WORLD_ID = crypto.randomUUID()
const CAMPAIGN = {
  id: crypto.randomUUID(),
  worldId: WORLD_ID,
  name: 'La Marca',
  role: 'master'
} as unknown as Campaign

const track = (name: string, duration: number) => ({
  id: crypto.randomUUID(),
  name,
  source: { type: 'youtube' as const, videoId: 'dQw4w9WgXcQ' },
  duration,
  volume: 1,
  loop: false
})
const playlist = (patch: Partial<SoundPlaylistView>): SoundPlaylistView => ({
  id: crypto.randomUUID(),
  worldId: WORLD_ID,
  name: 'Lista',
  kind: 'ambient',
  mode: 'sequential',
  fade: 2,
  tracks: [],
  version: 1,
  updatedAt: new Date().toISOString(),
  ...patch
})

function Harness() {
  const sound = useTableSound()
  return (
    <SoundContext.Provider value={sound}>
      <div data-testid="bar">
        <SoundBars sound={sound} onOpen={() => {}} />
        <UnlockSound sound={sound} />
      </div>
      <SoundTab worldId={WORLD_ID} campaignId={CAMPAIGN.id} />
    </SoundContext.Provider>
  )
}

function mount() {
  const api = fakeApi({
    campaigns: [CAMPAIGN],
    soundPlaylists: [
      playlist({ name: 'Taberna', tracks: [track('Laúd', 90), track('Gaita', 60)] }),
      playlist({ name: 'Cripta', mode: 'random', tracks: [track('Gotas', 30)] }),
      playlist({ name: 'Tormenta', kind: 'effects', mode: 'soundboard', fade: 0, tracks: [track('Trueno', 4)] })
    ]
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiProvider client={api.client}>
        <Harness />
      </ApiProvider>
    </QueryClientProvider>
  )
  return api
}

describe('la pestaña Sonido', () => {
  beforeEach(() => localStorage.clear())

  it('enseña las listas por clase y, sin nada sonando, lo dice (y la barra no enseña las barras)', async () => {
    mount()
    expect(await screen.findByText('Taberna')).toBeTruthy()
    expect(screen.getByText('Cripta')).toBeTruthy()
    expect(screen.getByText('En orden · 2 pistas')).toBeTruthy()
    expect(screen.getByText('Al azar · 1 pista')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trueno' })).toBeTruthy()
    expect(screen.getByText('Nada suena')).toBeTruthy()
    expect(within(screen.getByTestId('bar')).queryByRole('button')).toBeNull()
  })

  it('lanzar una lista: arriba suena su pista con su lista, la fila se marca y la barra enseña las barras', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'Poner Taberna' }))
    expect(await screen.findByText('Laúd')).toBeTruthy()
    expect(screen.getByText('Ambiente · lista «Taberna»')).toBeTruthy()
    expect(screen.getByText('1:30')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Parar Taberna' })).toBeTruthy()
    expect(within(screen.getByTestId('bar')).getByRole('button', { name: 'Sonido: abrir la pestaña' })).toBeTruthy()

    // Siguiente, pausa y seguir
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Gaita')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Seguir' }))
    expect(await screen.findByRole('button', { name: 'Pausar' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Parar' }))
    expect(await screen.findByText('Nada suena')).toBeTruthy()
  })

  it('un efecto de la botonera suena por encima y se para solo él', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'Poner Taberna' }))
    await user.click(screen.getByRole('button', { name: 'Trueno' }))
    const stop = await screen.findByRole('button', { name: 'Parar Trueno' })
    await user.click(stop)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Parar Trueno' })).toBeNull())
    expect(screen.getByText('Laúd')).toBeTruthy()
  })

  it('el volumen de este aparato se guarda en él', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('switch', { name: 'Silenciar este aparato' }))
    expect(JSON.parse(localStorage.getItem('crisol.sonido.aparato') ?? '{}')).toMatchObject({ muted: true })
    expect((screen.getByRole('switch', { name: 'Silenciar este aparato' }) as HTMLInputElement).checked).toBe(true)
  })

  it('«Lista nueva» abre su cuadro; un enlace que no es de YouTube se avisa', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByText('Taberna')
    await user.click(screen.getAllByRole('button', { name: 'Lista nueva' })[0] as HTMLElement)
    const dialog = await screen.findByRole('dialog', { name: 'Lista nueva' })
    await user.type(within(dialog).getByLabelText('Enlace de YouTube'), 'https://vimeo.com/1')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }))
    expect(await within(dialog).findByText('No es un enlace de un vídeo de YouTube')).toBeTruthy()
  })

  it('una lista se edita y se borra desde su menú', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: 'Más de Cripta' }))
    await user.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByText('Cripta')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Más de Taberna' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar la lista' })
    const name = within(dialog).getByLabelText('Nombre')
    await user.clear(name)
    await user.type(name, 'Posada')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Posada')).toBeTruthy()
  })
})
