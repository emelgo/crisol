import type { World } from '@crisol/contracts'
import { gregorianCalendar } from '@crisol/domain'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import type { FakeCalendar } from '../api/fake-calendars.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

const ORG = { id: crypto.randomUUID(), name: 'Fateforge', role: 'owner' as const }
const WORLD: World = {
  id: crypto.randomUUID(),
  organizationId: ORG.id,
  name: 'Valdren',
  description: '',
  icon: null,
  color: null,
  cover: null,
  role: 'master',
  version: 1
}

const VARN: FakeCalendar = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'Calendario de Varn',
  definition: {
    ...gregorianCalendar(),
    yearSuffix: 'RV',
    eras: [{ id: 'corona', name: 'Era de la Corona', start: { year: 0 }, hidden: true }]
  }
}

const renderAt = (path: string, calendars: FakeCalendar[] = [VARN]) => {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], calendars })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, router }
}

beforeEach(() =>
  localStorage.setItem(
    'crisol.recorridos.enrique@crisol.test',
    JSON.stringify({ seen: ['mundos', 'mundo', 'calendarios', 'calendario'] })
  )
)

describe('la pantalla «Calendarios»', () => {
  it('la barra del mundo: Páginas · Calendarios · Archivos', async () => {
    renderAt(`/mundos/${WORLD.id}/calendarios`)
    const nav = await screen.findByRole('navigation', { name: 'Secciones' })
    await waitFor(() => expect(within(nav).getByRole('link', { name: 'Calendarios' })).toBeDefined())
    expect(within(nav).getByRole('button', { name: 'Páginas' })).toBeDefined()
    expect(within(nav).queryByRole('button', { name: 'Valdren' })).toBeNull()
  })

  it('vacía: una sola pieza con «Calendario nuevo»', async () => {
    renderAt(`/mundos/${WORLD.id}/calendarios`, [])
    expect(await screen.findByText('El tiempo de tu mundo, con sus meses, sus lunas y sus eras.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Calendario nuevo' })).toBeDefined()
  })

  it('una ficha por calendario con el principal marcado y sus cifras', async () => {
    renderAt(`/mundos/${WORLD.id}/calendarios`)
    const list = await screen.findByRole('list', { name: 'Calendarios del mundo' })
    const card = within(list).getByRole('listitem')
    expect(within(card).getByRole('link', { name: 'Calendario de Varn' })).toBeDefined()
    expect(within(card).getByText('Principal')).toBeDefined()
    expect(card.textContent).toContain('12 meses')
    expect(card.textContent).toContain('365 días')
    expect(card.textContent).toContain('semana de 7')
    expect(card.textContent).toContain('Luna')
    expect(card.textContent).toContain('1 era')
    expect(within(card).getByRole('img', { name: 'El año de Calendario de Varn' })).toBeDefined()
  })

  it('«Calendario nuevo»: como el nuestro, y se abre su editor', async () => {
    const { router, api } = renderAt(`/mundos/${WORLD.id}/calendarios`)
    await userEvent.click(await screen.findByRole('button', { name: 'Calendario nuevo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Calendario nuevo' })
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Cómputo élfico')
    await userEvent.click(within(dialog).getByRole('radio', { name: /Como el nuestro/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/calendarios\/[0-9a-f-]+$/))
    expect(api.calendars.find((c) => c.name === 'Cómputo élfico')?.definition.leapRules).toHaveLength(1)
    expect(await screen.findByRole('heading', { level: 1, name: 'Cómputo élfico' })).toBeDefined()
  })

  it('el engranaje: hacer principal a otro', async () => {
    const other: FakeCalendar = { ...VARN, id: crypto.randomUUID(), name: 'Cuenta de Kharum', primary: false }
    const { api } = renderAt(`/mundos/${WORLD.id}/calendarios`, [VARN, other])
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Cuenta de Kharum' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer principal' }))
    await waitFor(() => expect(api.calendars.find((c) => c.primary)?.name).toBe('Cuenta de Kharum'))
  })
})

describe('el editor de un calendario', () => {
  const open = () => renderAt(`/mundos/${WORLD.id}/calendarios/${VARN.id}`)

  it('las secciones a la izquierda y la vista previa del mes a la derecha', async () => {
    open()
    const nav = await screen.findByRole('navigation', { name: 'Secciones del calendario' })
    for (const name of ['General', 'Semana', 'Meses', 'Bisiestos', 'Estaciones', 'Lunas', 'Eras'])
      expect(within(nav).getByRole('button', { name })).toBeDefined()
    // Es el principal: sin correspondencia
    expect(within(nav).queryByRole('button', { name: 'Correspondencia' })).toBeNull()
    const preview = screen.getByRole('complementary', { name: 'Vista previa' })
    expect(within(preview).getByRole('heading', { name: 'Enero de 1 RV' })).toBeDefined()
    // El 1 de enero del año 1 (proléptico) fue lunes: la primera columna
    expect(within(preview).getAllByRole('row')[1]?.querySelector('td')?.textContent).toContain('1')
  })

  it('añadir una festividad cambia la vista previa y el total del año, sin guardar; Cancelar lo deshace', async () => {
    open()
    const months = await screen.findByRole('region', { name: 'Meses' })
    expect(screen.getByRole('navigation', { name: 'Secciones del calendario' }).textContent).toContain('365 días')
    await userEvent.click(within(months).getByRole('button', { name: 'Mes' }))
    const name = within(months).getByLabelText('Nombre del mes 13')
    await userEvent.clear(name)
    await userEvent.type(name, 'Fiesta del Invierno')
    const days = within(months).getByLabelText('Días de Fiesta del Invierno')
    await userEvent.clear(days)
    await userEvent.type(days, '5')
    await userEvent.click(within(months).getByLabelText('Fiesta del Invierno, festividad'))
    await userEvent.click(within(months).getByLabelText('Fiesta del Invierno, fuera de la semana'))
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Secciones del calendario' }).textContent).toContain('370 días')
    )
    // En la vista previa, tras diciembre, la franja de la fiesta
    const preview = screen.getByRole('complementary', { name: 'Vista previa' })
    await userEvent.click(within(preview).getByRole('button', { name: 'Mes anterior' }))
    expect(within(preview).getByRole('heading', { name: 'Diciembre de 0 RV' })).toBeDefined()
    expect(within(preview).getByText('Fiesta del Invierno')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(months).queryByLabelText('Nombre del mes 13')).toBeNull())
  })

  it('un problema bloquea «Guardar» y lleva a él; arreglado, se guarda', async () => {
    const { api } = open()
    const seasons = await screen.findByRole('region', { name: 'Estaciones' })
    const from = within(seasons).getByLabelText('Primer día del año de Primavera')
    await userEvent.clear(from)
    await userEvent.type(from, '60')
    expect(await within(seasons).findByText('Invierno y Primavera se pisan (días 60 a 79).')).toBeDefined()
    expect(screen.getByRole('button', { name: '1 problema en Estaciones' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(api.calendars[0]?.version).toBe(1)
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true'))
    await userEvent.clear(from)
    await userEvent.type(from, '81')
    await waitFor(() => expect(screen.queryByRole('button', { name: /problema/ })).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.calendars[0]?.version).toBe(2))
  })

  it('una luna nueva sale en la vista previa con su día de luna nueva y llena', async () => {
    open()
    const preview = await screen.findByRole('complementary', { name: 'Vista previa' })
    expect(preview.textContent).toMatch(/Luna: (nueva|llena) el \d+/)
    const moons = screen.getByRole('region', { name: 'Lunas' })
    await userEvent.click(within(moons).getByRole('button', { name: 'Luna' }))
    await waitFor(() => expect(within(preview).getByText(/Luna 2:/)).toBeDefined())
  })
})
