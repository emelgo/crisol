import type { PageProperty, World } from '@crisol/contracts'
import type { CalendarDefinition } from '@crisol/domain'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeAccountClient } from '../account/fake.ts'
import { fakeApi } from '../api/fake.ts'
import type { FakeCalendar } from '../api/fake-calendars.ts'
import { App } from '../app.tsx'
import { createAppRouter } from '../router.tsx'

// El tutorial del mundo, ya visto (si no, sale y se lleva el foco)
beforeEach(() => localStorage.setItem('crisol.recorridos.enrique@crisol.test', JSON.stringify({ seen: ['mundo'] })))

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
const PORT = crypto.randomUUID()
const VARN = crypto.randomUUID()
const ELVES = crypto.randomUUID()

/** Dos meses de 30 días con una fiesta de 3 fuera de la semana entre ellos; semana de 7 */
const DEFINITION: CalendarDefinition = {
  yearSuffix: 'RV',
  description: '',
  weekdays: ['Lunden', 'Marden', 'Miden', 'Joden', 'Viden', 'Saden', 'Doden'],
  firstWeekday: 0,
  weekMode: 'continuous',
  months: [
    { id: 'siega', name: 'Siega', days: 30 },
    { id: 'fiesta', name: 'Fiesta de la Siega', days: 3, festival: true, outsideWeek: true },
    { id: 'vendimia', name: 'Vendimia', days: 30 }
  ],
  leapRules: [],
  seasons: [],
  moons: [],
  eras: [{ id: 'corona', name: 'Era de la Corona', start: { year: 0 } }]
}

const renderPort = (properties: PageProperty[] = [], calendars: FakeCalendar[] = []) => {
  const api = fakeApi({
    organizations: [ORG],
    worlds: [WORLD],
    pages: [{ id: PORT, worldId: WORLD.id, title: 'Puerto Ceniza', properties }],
    calendars
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`/mundos/${WORLD.id}/wiki/${PORT}`] }))
  render(
    <App
      router={router}
      accounts={fakeAccountClient({ account: { name: 'Enrique', email: 'enrique@crisol.test' } }).client}
      api={api.client}
    />
  )
  return { api, saved: async () => (await api.client.call('getPage', { pageId: PORT })).properties }
}

const varn: FakeCalendar = { id: VARN, worldId: WORLD.id, name: 'Calendario de Varn', definition: DEFINITION }
const founded = (value: object | null, extra: object = {}): PageProperty =>
  ({ name: 'Fundación', type: 'date', value, ...extra }) as PageProperty

/** Abre el selector de la propiedad n */
async function openPicker(n = 1) {
  const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
  await userEvent.click(await properties.findByRole('button', { name: new RegExp(`^Valor de la propiedad ${n}:`) }))
  return within(await screen.findByRole('dialog', { name: 'Fundación' }))
}

describe('el campo «Fecha» de una página', () => {
  it('es un tipo más: se elige el año a mano y el día en la rejilla del mes, y se lee como texto', async () => {
    const { saved } = renderPort([{ name: 'Fundación', type: 'text', value: '' }], [varn])
    const properties = within(await screen.findByRole('region', { name: 'Propiedades' }))
    await userEvent.selectOptions(properties.getByLabelText('Tipo de la propiedad 1'), 'Fecha')
    const picker = await openPicker()
    // La semana del calendario, en la cabecera
    expect(picker.getByRole('columnheader', { name: 'Lunden' })).toBeDefined()
    const year = picker.getByLabelText('Año que se ve')
    await userEvent.clear(year)
    await userEvent.type(year, '412')
    await userEvent.click(picker.getByRole('button', { name: /12 de Siega de 412 RV$/ }))
    await waitFor(async () =>
      expect(await saved()).toEqual([
        { name: 'Fundación', type: 'date', value: { calendarId: VARN, start: { year: 412, month: 'siega', day: 12 } } }
      ])
    )
    expect(picker.getByText(/, 12 de Siega de 412 RV$/)).toBeDefined()
    expect(properties.getByRole('button', { name: 'Valor de la propiedad 1: 12 de Siega de 412 RV' })).toBeDefined()
  })

  it('con fin y cada año: el tramo se marca y se lee sin repetir lo que comparten', async () => {
    const { saved } = renderPort([founded({ calendarId: VARN, start: { year: 412, month: 'siega', day: 12 } })], [varn])
    const picker = await openPicker()
    await userEvent.click(picker.getByRole('button', { name: 'Añadir fin' }))
    // Se elige el fin
    expect((picker.getByRole('radio', { name: 'Fin' }) as HTMLInputElement).checked).toBe(true)
    await userEvent.click(picker.getByRole('button', { name: /20 de Siega de 412 RV$/ }))
    await userEvent.click(picker.getByRole('checkbox', { name: 'Cada año' }))
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({
        value: {
          calendarId: VARN,
          start: { year: 412, month: 'siega', day: 12 },
          end: { year: 412, month: 'siega', day: 20 },
          yearly: true
        }
      })
    )
    expect(picker.getByText('12–20 de Siega de 412 RV')).toBeDefined()
    // Un fin antes del inicio: se cambian
    await userEvent.click(picker.getByRole('button', { name: /10 de Siega de 412 RV$/ }))
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({
        value: { start: { day: 10 }, end: { day: 12 } }
      })
    )
    await userEvent.click(picker.getByRole('button', { name: 'Quitar fin' }))
    await waitFor(async () =>
      expect((await saved())[0]).toEqual(
        founded({ calendarId: VARN, start: { year: 412, month: 'siega', day: 10 }, yearly: true })
      )
    )
  })

  it('la precisión: mes o año (y entonces no se repite cada año); la festividad, fuera de la semana', async () => {
    const { saved } = renderPort([founded({ calendarId: VARN, start: { year: 412, month: 'siega', day: 12 } })], [varn])
    const picker = await openPicker()
    // La fiesta, debajo del mes, con sus días
    await userEvent.click(picker.getByRole('button', { name: '2 de la Fiesta de la Siega de 412 RV' }))
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({ value: { start: { year: 412, month: 'fiesta', day: 2 } } })
    )
    await userEvent.click(picker.getByRole('radio', { name: 'Mes' }))
    await waitFor(async () =>
      expect((await saved())[0]).toMatchObject({ value: { start: { year: 412, month: 'fiesta' } } })
    )
    await userEvent.click(picker.getByRole('button', { name: 'Vendimia' }))
    await waitFor(async () =>
      expect((await saved())[0]).toEqual(founded({ calendarId: VARN, start: { year: 412, month: 'vendimia' } }))
    )
    await userEvent.click(picker.getByRole('radio', { name: 'Año' }))
    await waitFor(async () => expect((await saved())[0]).toEqual(founded({ calendarId: VARN, start: { year: 412 } })))
    expect((picker.getByRole('checkbox', { name: 'Cada año' }) as HTMLInputElement).disabled).toBe(true)
  })

  it('las flechas recorren los días; Borrar la deja vacía y cierra', async () => {
    const { saved } = renderPort([founded({ calendarId: VARN, start: { year: 412, month: 'siega', day: 12 } })], [varn])
    const picker = await openPicker()
    // El foco, en el elegido
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toMatch(/12 de Siega/))
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/13 de Siega/)
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/20 de Siega/)
    await userEvent.click(picker.getByRole('button', { name: 'Borrar' }))
    await waitFor(async () => expect((await saved())[0]).toEqual(founded(null)))
    expect(screen.queryByRole('dialog', { name: 'Fundación' })).toBeNull()
  })

  it('sin calendario en el mundo, lo dice y lleva a Calendarios', async () => {
    renderPort([founded(null)])
    const picker = await openPicker()
    expect(picker.getByText(/Este mundo aún no tiene calendario/)).toBeDefined()
    expect(picker.getByRole('link', { name: 'Calendarios' }).getAttribute('href')).toBe(
      `/mundos/${WORLD.id}/calendarios`
    )
  })

  it('con varios calendarios se elige el suyo, y de uno con correspondencia dice la equivalencia en el principal', async () => {
    const elves: FakeCalendar = {
      id: ELVES,
      worldId: WORLD.id,
      name: 'Élfico',
      definition: {
        ...DEFINITION,
        yearSuffix: 'EL',
        correspondence: { calendarId: VARN, date: { year: 400, month: 'siega', day: 1 } }
      }
    }
    renderPort([founded({ calendarId: ELVES, start: { year: 0, month: 'siega', day: 1 } })], [varn, elves])
    const picker = await openPicker()
    expect((picker.getByRole('combobox', { name: 'Calendario' }) as HTMLSelectElement).value).toBe(ELVES)
    expect(picker.getByText('En Calendario de Varn: 1 de Siega de 400 RV')).toBeDefined()
  })

  it('un campo de plantilla sin «Con fin» no ofrece fin; con «Fuera de las líneas temporales», lo conserva al cambiarlo', async () => {
    const { saved } = renderPort([founded(null, { field: 'fundacion', offTimeline: true })], [varn])
    const picker = await openPicker()
    expect(picker.queryByRole('button', { name: 'Añadir fin' })).toBeNull()
    await userEvent.click(picker.getByRole('button', { name: /^Lunden, 1 de Siega de 0 RV$/ }))
    await waitFor(async () =>
      expect((await saved())[0]).toEqual(
        founded(
          { calendarId: VARN, start: { year: 0, month: 'siega', day: 1 } },
          { field: 'fundacion', offTimeline: true }
        )
      )
    )
  })
})
