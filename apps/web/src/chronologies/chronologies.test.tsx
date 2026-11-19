import type { World } from '@crisol/contracts'
import { createMemoryHistory } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import type { FakeEvent } from '../api/fake-chronologies.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'
import { EANA } from './fixtures.ts'

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
const CALENDAR = crypto.randomUUID()
const CHRONOLOGY = crypto.randomUUID()
// La cronología es una pestaña de una página (ADR-0031)
const PAGE = crypto.randomUUID()
const TAB = crypto.randomUUID()
const at = (start: { year: number; month?: string; day?: number }, extra: object = {}) => ({
  calendarId: CALENDAR,
  start,
  ...extra
})

function renderAt(path: string, options: { events?: FakeEvent[]; chronologies?: boolean } = {}) {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    calendars: [{ id: CALENDAR, worldId: WORLD.id, name: 'Eana', definition: EANA }],
    ...(options.chronologies === false
      ? {}
      : {
          chronologies: [{ id: CHRONOLOGY, worldId: WORLD.id, name: 'Historia de Valdren', pageId: PAGE, tabId: TAB }]
        }),
    timelineGroups: [
      { id: 'f6c2d0b4-7a0c-4c5e-9c55-5d3a0b4f1a11', worldId: WORLD.id, name: 'La Corona', color: 'wine' }
    ],
    events: options.events ?? [],
    pages: [
      { id: PAGE, worldId: WORLD.id, title: 'Historia de Valdren' },
      {
        worldId: WORLD.id,
        title: 'Aldren IV',
        properties: [
          { name: 'Nacimiento', type: 'date', value: at({ year: 1190 }) },
          { name: 'Muerte', type: 'date', value: at({ year: 1247, month: 'siega', day: 27 }) }
        ]
      }
    ]
  })
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

const EVENTS: FakeEvent[] = [
  {
    worldId: WORLD.id,
    title: 'Boda de Ilsa y Doran',
    date: at({ year: 1247, month: 'siega', day: 18 }),
    groupId: 'f6c2d0b4-7a0c-4c5e-9c55-5d3a0b4f1a11'
  },
  {
    worldId: WORLD.id,
    title: 'Campaña de los Pasos',
    date: at({ year: 1247, month: 'siega', day: 20 }, { end: { year: 1247, month: 'trilla', day: 3 } })
  },
  {
    worldId: WORLD.id,
    title: 'Feria de Vendimia',
    date: at({ year: 413, month: 'vendimia', day: 1 }, { yearly: true })
  }
]

const chronologyPath = `/mundos/${WORLD.id}/wiki/${PAGE}?pestana=${TAB}`

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'crisol.recorridos.enrique@crisol.test',
    JSON.stringify({ seen: ['mundos', 'mundo', 'calendarios', 'calendario', 'cronologia'] })
  )
})

describe('la cronología, como pestaña de una página (ADR-0031)', () => {
  it('la dirección de antes (en Calendarios) lleva a su pestaña, en su página', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/calendarios/cronologias/${CHRONOLOGY}`)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/wiki/${PAGE}`))
    expect(router.state.location.search).toMatchObject({ pestana: TAB })
    expect(await screen.findByRole('toolbar', { name: 'Vistas' })).toBeDefined()
  })

  it('Calendarios ya no tiene la sección de cronologías', async () => {
    renderAt(`/mundos/${WORLD.id}/calendarios`)
    await screen.findByRole('heading', { level: 1, name: 'Calendarios' })
    expect(screen.queryByRole('list', { name: 'Cronologías del mundo' })).toBeNull()
  })

  it('«Pestaña nueva» de tipo cronología la añade y la abre, con las páginas con fecha que salen solas', async () => {
    const { api } = renderAt(`/mundos/${WORLD.id}/wiki/${PAGE}`, { chronologies: false })
    const bar = within(await screen.findByRole('navigation', { name: 'Pestañas de la página' }))
    await userEvent.click(bar.getByRole('button', { name: 'Pestaña nueva' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Pestaña nueva' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'Cronología' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByRole('heading', { name: /Aldren IV · Muerte/ })).toBeDefined()
    expect(api.chronologies).toHaveLength(1)
    expect((await bar.findByRole('link', { name: /Cronología/ })).getAttribute('aria-current')).toBe('page')
  })
})

describe('una cronología en su pestaña', () => {
  it('la lista: en orden, con la distancia a la anterior, la marca de cada año y las páginas con el nombre del campo', async () => {
    renderAt(chronologyPath, { events: EVENTS })
    const list = await screen.findByRole('list', { name: 'Lista' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Feria de Vendimia',
      'Aldren IV · Nacimiento',
      'Boda de Ilsa y Doran',
      'Campaña de los Pasos',
      'Aldren IV · Muerte'
    ])
    expect(rows[1]?.textContent).toContain('776 años después')
    expect(within(rows[0] as HTMLElement).getByLabelText('Cada año')).toBeDefined()
    expect(rows[3]?.textContent).toContain('20 Sie – 3 Tri 1247 RC')
  })

  it('la píldora cambia de vista y se recuerda; meses, con sus carriles y el zoom', async () => {
    renderAt(chronologyPath, { events: EVENTS })
    const pill = await screen.findByRole('toolbar', { name: 'Vistas' })
    await userEvent.click(within(pill).getByRole('button', { name: 'Meses' }))
    const lanes = await screen.findByRole('list', { name: 'Grupos' })
    expect(within(lanes).getByText('La Corona')).toBeDefined()
    expect(within(lanes).getByText('Páginas')).toBeDefined()
    expect(within(lanes).getByText('Sin grupo')).toBeDefined()
    expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeDefined()
    expect(localStorage.getItem(`crisol.cronologia.${TAB}`)).toBe('months')
  })

  it('el calendario: el mes de la última entrada, con lo de varios días en cada uno y las flechas por la rejilla', async () => {
    renderAt(chronologyPath, { events: EVENTS })
    await userEvent.click(
      within(await screen.findByRole('toolbar', { name: 'Vistas' })).getByRole('button', { name: 'Calendario' })
    )
    expect(await screen.findByRole('heading', { name: 'Siega de 1247 RC' })).toBeDefined()
    const table = screen.getByRole('table', { name: 'Siega de 1247 RC' })
    const day20 = within(table).getByRole('cell', { name: /, 20 de Siega de 1247 RC/ })
    const day21 = within(table).getByRole('cell', { name: /, 21 de Siega de 1247 RC/ })
    expect(within(day20).getByRole('button', { name: 'Campaña de los Pasos' })).toBeDefined()
    // El tramo siguiente repite la ficha: sin parada propia del tabulador ni para el lector
    expect(day21.querySelector('button[aria-hidden="true"]')?.getAttribute('aria-label')).toBe('Campaña de los Pasos')
    expect(within(day21).queryByRole('button', { name: 'Campaña de los Pasos' })).toBeNull()
    // Con las flechas
    day20.focus()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.activeElement).toBe(day21))
    // Intro abre su detalle
    await userEvent.keyboard('{Enter}')
    const detail = await screen.findByRole('complementary', { name: /21 de Siega de 1247 RC/ })
    expect(detail.textContent).toContain('Verano')
  })

  it('arrastrar una ficha a otro día le cambia la fecha', async () => {
    const { api } = renderAt(chronologyPath, { events: EVENTS })
    await userEvent.click(
      within(await screen.findByRole('toolbar', { name: 'Vistas' })).getByRole('button', { name: 'Calendario' })
    )
    const table = await screen.findByRole('table', { name: 'Siega de 1247 RC' })
    const boda = within(table).getByRole('button', { name: 'Boda de Ilsa y Doran' })
    const target = within(table).getByRole('cell', { name: /, 22 de Siega de 1247 RC/ })
    const data = { setData: () => undefined, getData: () => '', effectAllowed: 'move', types: [] }
    fireEvent.dragStart(boda, { dataTransfer: data })
    fireEvent.dragOver(target, { dataTransfer: data })
    fireEvent.drop(target, { dataTransfer: data })
    await waitFor(() =>
      expect(api.events.find((e) => e.title === 'Boda de Ilsa y Doran')?.date.start).toEqual({
        year: 1247,
        month: 'siega',
        day: 22
      })
    )
  })

  it('el cuadro del evento: la tarjeta en vivo y, al guardar, el evento nuevo en el día elegido', async () => {
    const { api } = renderAt(chronologyPath, { events: EVENTS })
    await userEvent.click(
      within(await screen.findByRole('toolbar', { name: 'Vistas' })).getByRole('button', { name: 'Calendario' })
    )
    const table = await screen.findByRole('table', { name: 'Siega de 1247 RC' })
    await userEvent.click(within(table).getByRole('cell', { name: /, 5 de Siega de 1247 RC/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Evento en este día' }))
    const dialog = await screen.findByRole('dialog', { name: 'Evento nuevo' })
    await userEvent.type(within(dialog).getByLabelText('Título'), 'Llegan los emisarios')
    // La tarjeta, al momento
    expect(within(dialog).getAllByText('Llegan los emisarios').length).toBeGreaterThan(0)
    await userEvent.click(within(dialog).getByLabelText('Oculto para los jugadores'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(api.events.find((e) => e.title === 'Llegan los emisarios')).toBeDefined())
    expect(api.events.find((e) => e.title === 'Llegan los emisarios')).toMatchObject({
      hidden: true,
      date: { start: { year: 1247, month: 'siega', day: 5 } }
    })
  })

  it('sin título ni página, el cuadro lo dice y no crea nada', async () => {
    const { api } = renderAt(chronologyPath, { events: [] })
    await userEvent.click(await screen.findByRole('button', { name: /^Añadir evento$/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Evento nuevo' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear evento' }))
    expect(await within(dialog).findByText('Ponle una fecha.')).toBeDefined()
    expect(api.events).toHaveLength(0)
  })

  it('«⋯» de un evento: convertirlo en página, eligiendo dónde va', async () => {
    const { api } = renderAt(chronologyPath, { events: EVENTS })
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de «Boda de Ilsa y Doran»' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Convertir en página…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Convertir en página' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Convertir' }))
    await waitFor(() => expect(api.pages.find((p) => p.title === 'Boda de Ilsa y Doran')).toBeDefined())
    expect(api.events.find((e) => e.pageId)).toMatchObject({ title: '' })
  })
})
