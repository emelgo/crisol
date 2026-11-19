import type { CalendarView, ChronologyEntryView } from '@crisol/contracts'
import { dayNumber } from '@crisol/domain'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EANA } from '../chronologies/fixtures.ts'
import { ListView } from '../chronologies/list-view.tsx'
import '../i18n.ts'
import { todayIn } from './today-mark.tsx'

const calendar: CalendarView = {
  id: crypto.randomUUID(),
  worldId: crypto.randomUUID(),
  name: 'Eana',
  primary: true,
  definition: EANA,
  version: 1
}
const day = (month: string, d: number) => dayNumber(EANA, { year: 1250, month, day: d })
const entry = (title: string, month: string, d: number): ChronologyEntryView => ({
  key: `e:${title}`,
  kind: 'event',
  eventId: crypto.randomUUID(),
  title,
  start: { year: 1250, month, day: d },
  startDay: day(month, d),
  endDay: day(month, d),
  text: `${d} de ${month}`,
  form: `1250-${month}-${d}`
})

describe('el «hoy» en las cronologías (8 · campaña)', () => {
  it('el día de hoy en el calendario de la cronología (el mismo: tal cual; otro sin correspondencia: nada)', () => {
    const today = { calendarId: calendar.id, date: { year: 1250, month: 'siega', day: 18 }, day: day('siega', 18) }
    expect(todayIn([calendar], calendar.id, today)).toBe(day('siega', 18))
    const other = { ...calendar, id: crypto.randomUUID(), primary: false }
    expect(todayIn([calendar, other], other.id, today)).toBeNull()
  })

  it('la lista lleva la línea «Hoy» entre lo pasado y lo que viene, y «hace / dentro de N días»', async () => {
    const entries = [entry('Boda', 'siega', 10), entry('Feria', 'siega', 21)]
    const root = createRootRoute({
      component: () => (
        <ListView
          worldId={calendar.worldId}
          definition={EANA}
          entries={entries}
          groups={[]}
          compact={false}
          today={{ day: day('siega', 18), text: 'Frostelle, 18 de Siega del año 1250 RC', campaign: 'La Marca' }}
        />
      )
    })
    const router = createRouter({ routeTree: root, history: createMemoryHistory() })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    const list = await screen.findByRole('list', { name: 'Lista' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((row) => row.getAttribute('aria-label') ?? row.textContent?.slice(0, 30))).toHaveLength(3)
    expect(rows[1]?.getAttribute('aria-label')).toBe('Hoy: Frostelle, 18 de Siega del año 1250 RC')
    expect(rows[1]?.textContent).toContain('La Marca')
    expect(rows[0]?.textContent).toContain('hace 8 días')
    expect(rows[2]?.textContent).toContain('dentro de 3 días')
  })
})
