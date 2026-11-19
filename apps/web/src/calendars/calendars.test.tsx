import type { Campaign, World } from '@crisol/contracts'
import { blankCalendar, gregorianCalendar, weekdayName } from '@crisol/domain'
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

const MARCA: Campaign = {
  id: crypto.randomUUID(),
  worldId: WORLD.id,
  name: 'La Marca',
  description: '',
  color: null,
  cover: null,
  role: 'master',
  version: 1
}

const renderAt = (
  path: string,
  calendars: FakeCalendar[] = [VARN],
  extra: Omit<NonNullable<Parameters<typeof fakeApi>[0]>, 'organizations' | 'worlds' | 'calendars'> = {}
) => {
  const api = fakeApi({ organizations: [ORG], worlds: [WORLD], calendars, ...extra })
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
    JSON.stringify({ seen: ['mundos', 'mundo', 'calendarios', 'calendario', 'calendario-vista'] })
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
    expect(await screen.findByText('El tiempo de tu mundo, a su manera.')).toBeDefined()
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
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/calendarios\/[0-9a-f-]+\/editar$/))
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

  it('el engranaje: abrirlo en grande o editarlo', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/calendarios`)
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Calendario de Varn' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Editar calendario' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/calendarios/${VARN.id}/editar`)
    )
  })
})

describe('un calendario en grande', () => {
  const open = (extra: Parameters<typeof renderAt>[2] = {}) =>
    renderAt(`/mundos/${WORLD.id}/calendarios/${VARN.id}`, [VARN], extra)

  it('pulsar su tarjeta lo abre: el título, «Editar calendario» y el mes; sin fichas a los lados', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/calendarios`)
    const list = await screen.findByRole('list', { name: 'Calendarios del mundo' })
    await userEvent.click(within(list).getByRole('link', { name: 'Calendario de Varn' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/calendarios/${VARN.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendario de Varn' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Editar calendario' })).toBeDefined()
    // Se abre en el año de su última era (el 0), en enero, en la vista del mes
    expect(screen.getByRole('heading', { level: 2, name: 'Enero del año 0 RV' })).toBeDefined()
    const modes = screen.getByRole('toolbar', { name: 'Vista' })
    expect(within(modes).getByRole('button', { name: 'Mes' }).getAttribute('aria-pressed')).toBe('true')
    // Ni el año en pequeño ni el resumen (ese, en el editor); la ficha del día, solo cuando hace falta
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByText('365 días')).toBeNull()
  })

  it('la ficha del día: se ve al pasar el ratón, se fija al pulsarlo y Esc la quita; su fecha lleva la era', async () => {
    open({
      events: [
        {
          worldId: WORLD.id,
          title: 'Boda de Ilsa',
          date: { calendarId: VARN.id ?? '', start: { year: 0, month: 'ene', day: 3 } }
        }
      ]
    })
    const cell = await screen.findByRole('cell', { name: / 3 de Enero del año 0 RV$/ })
    await userEvent.hover(cell)
    const day = await screen.findByRole('complementary', { name: 'El día elegido' })
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain(
      '3 de Enero del año 0 RV de la Era de la Corona'
    )
    expect(await within(day).findByText('Boda de Ilsa')).toBeDefined()
    expect(day.textContent).toContain('Luna')
    // Sin fijar, al salir se va
    await userEvent.unhover(cell)
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'El día elegido' })).toBeNull())
    // Fijado, se queda (con su «×») hasta Esc
    await userEvent.click(cell)
    await userEvent.unhover(cell)
    const pinned = await screen.findByRole('complementary', { name: 'El día elegido' })
    expect(within(pinned).getByRole('button', { name: 'Quitar el día' })).toBeDefined()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.getByRole('complementary', { name: 'El día elegido' })).toBeDefined()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'El día elegido' })).toBeNull())
  })

  it('Mes · Semana · Año, con sus flechas y su título que lleva a otra fecha; en el año se eligen días y el nombre de un mes lleva a él', async () => {
    open()
    await screen.findByRole('heading', { level: 2, name: 'Enero del año 0 RV' })
    // El título del mes abre el recuadro: un mes lleva a él
    const goToMonth = async (name: string) => {
      await userEvent.click(within(screen.getByRole('heading', { level: 2 })).getByRole('button'))
      const box = screen.getByRole('dialog', { name: 'Ir a otro mes' })
      await userEvent.click(within(box).getByRole('button', { name }))
    }
    await goToMonth('Marzo')
    expect(screen.queryByRole('dialog', { name: 'Ir a otro mes' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Marzo del año 0 RV' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Abril del año 0 RV' })).toBeDefined()
    await goToMonth('Marzo')
    // La semana del 1 de marzo (miércoles: el año 0 es de 366 días), de lunes a domingo
    const modes = screen.getByRole('toolbar', { name: 'Vista' })
    await userEvent.click(within(modes).getByRole('button', { name: 'Semana' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Semana del 28 de Febrero al 5 de Marzo del año 0 RV' })
    ).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Semana del 6 al 12 de Marzo del año 0 RV' })).toBeDefined()
    // Sus días también enseñan su ficha
    await userEvent.click(screen.getByRole('cell', { name: / 8 de Marzo del año 0 RV$/ }))
    const day = await screen.findByRole('complementary', { name: 'El día elegido' })
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain('8 de Marzo del año 0 RV')
    // El año: sus meses en pequeño; uno lleva a él
    await userEvent.click(within(modes).getByRole('button', { name: 'Año' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Año 0 RV' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Año siguiente' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Año 1 RV' })).toBeDefined()
    // En el año se eligen días (su ficha), y el nombre del mes lleva a él
    await userEvent.click(screen.getByRole('button', { name: / 10 de Febrero del año 1 RV$/ }))
    expect(
      within(screen.getByRole('complementary', { name: 'El día elegido' })).getByRole('heading', { level: 2 })
        .textContent
    ).toContain('10 de Febrero del año 1 RV')
    await userEvent.click(screen.getByRole('button', { name: /^Junio/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Junio del año 1 RV' })).toBeDefined()
    expect(within(modes).getByRole('button', { name: 'Mes' }).getAttribute('aria-pressed')).toBe('true')
    // Otro año: se escribe e Intro lo aplica, con el foco de vuelta en el título
    const title = within(screen.getByRole('heading', { level: 2 })).getByRole('button')
    await userEvent.click(title)
    const year = within(screen.getByRole('dialog', { name: 'Ir a otro mes' })).getByLabelText('Año')
    expect(document.activeElement).toBe(year)
    await userEvent.clear(year)
    await userEvent.type(year, '1250{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'Junio del año 1250 RV' })).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(title)
  })

  it('el título de cada vista lleva a otra fecha: la semana de un día, un año; Esc y pulsar fuera lo cierran', async () => {
    open()
    const modes = within(await screen.findByRole('toolbar', { name: 'Vista' }))
    await screen.findByRole('heading', { level: 2, name: 'Enero del año 0 RV' })
    // Sin la barra «Ir a»
    expect(screen.queryByText('Ir a')).toBeNull()
    // Semana: el año, el mes y el día, que lleva a su semana
    await userEvent.click(modes.getByRole('button', { name: 'Semana' }))
    const title = () => within(screen.getByRole('heading', { level: 2 })).getByRole('button')
    await userEvent.click(title())
    let box = screen.getByRole('dialog', { name: 'Ir a otra semana' })
    await userEvent.clear(within(box).getByLabelText('Año'))
    await userEvent.type(within(box).getByLabelText('Año'), '3')
    await userEvent.click(
      within(within(box).getByRole('group', { name: 'Mes' })).getByRole('button', { name: 'Marzo' })
    )
    // Elegir el mes no cierra: faltan sus días (los 31 de marzo)
    const days = within(box).getByRole('group', { name: 'Día' })
    expect(within(days).getAllByRole('button')).toHaveLength(31)
    await userEvent.click(within(days).getByRole('button', { name: '15' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/Marzo del año 3 RV$/)
    expect(screen.getByRole('cell', { name: / 15 de Marzo del año 3 RV$/ })).toBeDefined()
    // Esc cierra sin cambiar nada y el foco vuelve al título
    await userEvent.click(title())
    expect(screen.getByRole('dialog', { name: 'Ir a otra semana' })).toBeDefined()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(title())
    // Año: solo el año, con «Ir»
    await userEvent.click(modes.getByRole('button', { name: 'Año' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Año 3 RV' })).toBeDefined()
    await userEvent.click(title())
    box = screen.getByRole('dialog', { name: 'Ir a otro año' })
    expect(within(box).queryByRole('group')).toBeNull()
    await userEvent.clear(within(box).getByLabelText('Año'))
    await userEvent.type(within(box).getByLabelText('Año'), '1250')
    await userEvent.click(within(box).getByRole('button', { name: 'Ir' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Año 1250 RV' })).toBeDefined()
    // Pulsar fuera lo cierra
    await userEvent.click(title())
    expect(screen.getByRole('dialog', { name: 'Ir a otro año' })).toBeDefined()
    await userEvent.click(screen.getByRole('heading', { level: 1, name: 'Calendario de Varn' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un evento se borra desde la ficha del día, tras confirmarlo', async () => {
    open({
      events: [
        {
          worldId: WORLD.id,
          title: 'Boda de Ilsa',
          date: { calendarId: VARN.id ?? '', start: { year: 0, month: 'ene', day: 3 } }
        }
      ]
    })
    await userEvent.click(await screen.findByRole('cell', { name: / 3 de Enero del año 0 RV$/ }))
    const day = screen.getByRole('complementary', { name: 'El día elegido' })
    await userEvent.click(within(day).getByRole('button', { name: 'Borrar «Boda de Ilsa»' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Borrar «Boda de Ilsa»?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Boda de Ilsa' })).toBeNull())
  })

  it('pulsar un evento en la rejilla elige su día y lo abre para editarlo', async () => {
    open({
      events: [
        {
          worldId: WORLD.id,
          title: 'Boda de Ilsa',
          date: { calendarId: VARN.id ?? '', start: { year: 0, month: 'ene', day: 3 } }
        }
      ]
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Boda de Ilsa' }))
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByLabelText('Título') as HTMLInputElement).value).toBe('Boda de Ilsa')
    const day = screen.getByRole('complementary', { name: 'El día elegido' })
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain('3 de Enero del año 0 RV')
  })

  it('«Nuevo evento»: sin cronologías, va a una nueva («Cronología»), con la fecha del día elegido', async () => {
    const { api } = open()
    await userEvent.click(await screen.findByRole('cell', { name: / 5 de Enero del año 0 RV$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Un evento nuevo en este día' }))
    const dialog = await screen.findByRole('dialog')
    expect((within(dialog).getByLabelText('Cronología') as HTMLSelectElement).value).toBe('new')
    expect((within(dialog).getByLabelText('Nombre de la cronología nueva') as HTMLInputElement).value).toBe(
      'Cronología'
    )
    await userEvent.type(within(dialog).getByLabelText('Título'), 'Coronación')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(api.events.find((e) => e.title === 'Coronación')).toBeDefined())
    const created = api.events.find((e) => e.title === 'Coronación')
    expect(created?.date).toMatchObject({ calendarId: VARN.id, start: { year: 0, month: 'ene', day: 5 } })
    expect(api.chronologies.find((c) => c.id === created?.chronologyId)?.name).toBe('Cronología')
    const day = screen.getByRole('complementary', { name: 'El día elegido' })
    expect(await within(day).findByText('Coronación')).toBeDefined()
  })

  it('«Nuevo evento» pregunta a qué cronología va (ADR-0032): primero las de este calendario; sus grupos, los de ella', async () => {
    const { api } = open({
      chronologies: [
        { worldId: WORLD.id, name: 'Historia del reino', calendarId: crypto.randomUUID() },
        { worldId: WORLD.id, name: 'Las guerras', calendarId: VARN.id ?? null }
      ]
    })
    const guerras = api.chronologies.find((c) => c.name === 'Las guerras')
    await api.client.call('updateTimelineGroups', {
      chronologyId: guerras?.id ?? '',
      groups: [{ name: 'Asedios', color: null }]
    })
    await userEvent.click(await screen.findByRole('cell', { name: / 6 de Enero del año 0 RV$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Un evento nuevo en este día' }))
    const dialog = within(await screen.findByRole('dialog'))
    const choice = dialog.getByLabelText('Cronología') as HTMLSelectElement
    await waitFor(() => expect(choice.value).toBe(guerras?.id))
    expect([...choice.options].map((option) => option.text)).toEqual([
      'Las guerras',
      'Historia del reino',
      'Una nueva…'
    ])
    expect(dialog.getByRole('option', { name: 'Asedios' })).toBeDefined()
    await userEvent.selectOptions(choice, 'Historia del reino')
    expect(dialog.queryByRole('option', { name: 'Asedios' })).toBeNull()
    await userEvent.type(dialog.getByLabelText('Título'), 'Tratado')
    await userEvent.click(dialog.getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(api.events.find((e) => e.title === 'Tratado')).toBeDefined())
    expect(api.events.find((e) => e.title === 'Tratado')?.chronologyId).toBe(
      api.chronologies.find((c) => c.name === 'Historia del reino')?.id
    )
  })

  it('«Página con esta fecha»: una página nueva con el campo Fecha, abierta para ponerle título', async () => {
    const { api, router } = open()
    await userEvent.click(await screen.findByRole('cell', { name: / 7 de Enero del año 0 RV$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Una página nueva con esta fecha' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/wiki\/[0-9a-f-]+$/))
    const pageId = router.state.location.pathname.split('/').at(-1)
    const page = api.pages.find((p) => p.id === pageId)
    expect(page?.properties).toEqual([
      expect.objectContaining({
        name: 'Fecha',
        type: 'date',
        value: { calendarId: VARN.id, start: { year: 0, month: 'ene', day: 7 } }
      })
    ])
  })

  it('los años: el del título no pasa del tope ni deja más de seis cifras', async () => {
    open()
    await screen.findByRole('heading', { level: 2, name: 'Enero del año 0 RV' })
    await userEvent.click(within(screen.getByRole('heading', { level: 2 })).getByRole('button'))
    const year = within(screen.getByRole('dialog')).getByLabelText('Año') as HTMLInputElement
    await userEvent.clear(year)
    await userEvent.type(year, '-2345656')
    expect(year.value).toBe('-234565')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'Enero del año -99999 RV' })).toBeDefined()
    expect((screen.getByRole('button', { name: 'Mes anterior' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('con su rango de años, se para en el borde: las flechas se desactivan y la vista no sale de él', async () => {
    const ranged: FakeCalendar = { ...VARN, definition: { ...VARN.definition, yearRange: { min: 0, max: 2 } } }
    renderAt(`/mundos/${WORLD.id}/calendarios/${VARN.id}`, [ranged])
    await screen.findByRole('heading', { level: 2, name: 'Enero del año 0 RV' })
    const previous = screen.getByRole('button', { name: 'Mes anterior' }) as HTMLButtonElement
    expect(previous.disabled).toBe(true)
    await userEvent.click(within(screen.getByRole('heading', { level: 2 })).getByRole('button'))
    const year = within(screen.getByRole('dialog')).getByLabelText('Año')
    await userEvent.clear(year)
    await userEvent.type(year, '50{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'Enero del año 2 RV' })).toBeDefined()
    await userEvent.click(within(screen.getByRole('heading', { level: 2 })).getByRole('button'))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Diciembre' }))
    expect((screen.getByRole('button', { name: 'Mes siguiente' }) as HTMLButtonElement).disabled).toBe(true)
    const modes = screen.getByRole('toolbar', { name: 'Vista' })
    await userEvent.click(within(modes).getByRole('button', { name: 'Año' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Año 2 RV' })).toBeDefined()
    expect((screen.getByRole('button', { name: 'Año siguiente' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Año anterior' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Año 1 RV' })).toBeDefined()
  })

  it('«Hoy de…»: con una campaña con fecha, se abre en su hoy, marcado', async () => {
    open({
      campaigns: [MARCA],
      todays: [{ campaignId: MARCA.id, calendarId: VARN.id ?? '', date: { year: 1250, month: 'mar', day: 18 } }]
    })
    expect(await screen.findByRole('heading', { level: 2, name: 'Marzo del año 1250 RV' })).toBeDefined()
    expect(screen.getByLabelText('Hoy de')).toBeDefined()
    const today = screen.getByRole('cell', { name: /18 de Marzo del año 1250 RV/ })
    expect(today.getAttribute('aria-current')).toBe('date')
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ir a hoy' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Marzo del año 1250 RV' })).toBeDefined()
  })
})

describe('el editor de un calendario, por fases', () => {
  const open = (phase = '') =>
    renderAt(`/mundos/${WORLD.id}/calendarios/${VARN.id}/editar${phase ? `?fase=${phase}` : ''}`)
  const phases = () => screen.findByRole('navigation', { name: 'Fases del calendario' })

  it('las fases a la izquierda, solo la elegida en el centro (en la URL) y el resumen del año a la derecha', async () => {
    const { router } = open()
    const nav = await phases()
    for (const name of ['General', 'Semana', 'Meses', 'Días señalados', 'Días de más', 'Estaciones', 'Lunas', 'Eras'])
      expect(within(nav).getByRole('button', { name })).toBeDefined()
    // Es el principal: sin correspondencia
    expect(within(nav).queryByRole('button', { name: 'Correspondencia' })).toBeNull()
    expect(screen.getByRole('region', { name: 'General' })).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Meses' })).toBeNull()
    // Sin vista previa: el año en cifras
    expect(screen.queryByRole('complementary', { name: 'Vista previa' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'El año y los problemas' }).textContent).toContain('365 días')
    await userEvent.click(within(nav).getByRole('button', { name: 'Meses' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ fase: 'meses' }))
    expect(await screen.findByRole('region', { name: 'Meses' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente: Días señalados' }))
    expect(await screen.findByRole('region', { name: 'Días señalados' })).toBeDefined()
  })

  it('Meses: cada uno, mes o festividad; una festividad puede no contar en la semana; Cancelar lo deshace', async () => {
    open('meses')
    const months = await screen.findByRole('region', { name: 'Meses' })
    expect(within(months).queryByText('Fuera de la semana')).toBeNull()
    await userEvent.click(within(months).getByRole('button', { name: 'Mes' }))
    const name = within(months).getByLabelText('Nombre del mes 13')
    await userEvent.clear(name)
    await userEvent.type(name, 'Fiesta del Invierno')
    const days = within(months).getByLabelText('Días de Fiesta del Invierno')
    await userEvent.clear(days)
    await userEvent.type(days, '5')
    // Como mes, sin la casilla; como festividad, con ella
    expect(within(months).queryByRole('checkbox', { name: /Fiesta del Invierno/ })).toBeNull()
    await userEvent.selectOptions(within(months).getByLabelText('Tipo de Fiesta del Invierno'), 'Festividad')
    await userEvent.click(
      within(months).getByRole('checkbox', { name: /Sus días no cuentan en la semana · Fiesta del Invierno/ })
    )
    const summary = screen.getByRole('complementary', { name: 'El año y los problemas' })
    await waitFor(() => expect(summary.textContent).toContain('370 días'))
    expect(summary.textContent).toContain('12 meses y 1 festividad')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(months).queryByLabelText('Nombre del mes 13')).toBeNull())
  })

  it('Semana: empezar en domingo reordena sin cambiar las fechas; el ancla corre el día de la semana', async () => {
    const { api } = open('semana')
    const week = await screen.findByRole('region', { name: 'Semana' })
    await userEvent.selectOptions(within(week).getByLabelText('La semana empieza en'), 'Domingo')
    expect((within(week).getByLabelText('Día 1 de la semana') as HTMLInputElement).value).toBe('Domingo')
    // El 1 de enero del año 0 (proléptico) fue sábado; y lo sigue siendo
    const shown = (select: HTMLElement) => {
      const element = select as HTMLSelectElement
      return element.options[element.selectedIndex]?.textContent
    }
    expect(shown(within(week).getByLabelText('Día de la semana de la fecha de referencia'))).toBe('Sábado')
    // El 1 de enero de 2026 fue jueves; si se dice que fue viernes, todo se corre un día
    const year = within(week).getByLabelText('Año de la fecha de referencia')
    await userEvent.clear(year)
    await userEvent.type(year, '2026')
    const weekday = within(week).getByLabelText('Día de la semana de la fecha de referencia')
    expect(shown(weekday)).toBe('Jueves')
    await userEvent.selectOptions(weekday, 'Viernes')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.calendars[0]?.version).toBe(2))
    const saved = api.calendars[0]?.definition
    expect(saved?.weekdays[0]).toBe('Domingo')
    // Domingo, lunes… viernes es el 5; el 1 de enero de 2026, viernes
    expect(saved && weekdayName(saved, { year: 2026, month: 'ene', day: 1 })).toBe('Viernes')
  })

  it('Días de más: sin reglas de serie ni atajos; una regla se escribe como una frase y se guarda', async () => {
    const blank: FakeCalendar = {
      id: crypto.randomUUID(),
      worldId: WORLD.id,
      name: 'Cuenta de Kharum',
      definition: blankCalendar()
    }
    const { api } = renderAt(`/mundos/${WORLD.id}/calendarios/${blank.id}/editar?fase=dias-de-mas`, [blank])
    const extra = await screen.findByRole('region', { name: 'Días de más' })
    expect(within(extra).getByText('Todos los años duran lo mismo.')).toBeDefined()
    expect(within(extra).queryByRole('button', { name: 'Como el gregoriano' })).toBeNull()
    expect(extra.textContent).not.toMatch(/bisiest/i)
    await userEvent.click(within(extra).getByRole('button', { name: 'Regla' }))
    // «Cada [3] años, [Mes 1] tiene [2] días más…»
    const every = within(extra).getByLabelText('Cada cuántos años, regla 1')
    await userEvent.clear(every)
    await userEvent.type(every, '3')
    const days = within(extra).getByLabelText('Días de más de la regla 1')
    await userEvent.clear(days)
    await userEvent.type(days, '2')
    expect(extra.textContent).toContain('días más')
    const summary = screen.getByRole('complementary', { name: 'El año y los problemas' })
    await waitFor(() => expect(summary.textContent).toContain('360 días · 362 con días de más'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.calendars[0]?.version).toBe(2))
    expect(api.calendars[0]?.definition.leapRules).toEqual([
      { monthId: blank.definition.months[0]?.id, days: 2, every: 3 }
    ])
  })

  it('General: los años, opcionales; sin «desde», se propone el inicio de la primera era', async () => {
    const { api } = open()
    const general = await screen.findByRole('region', { name: 'General' })
    const years = within(general).getByRole('group', { name: 'Años' })
    const from = within(years).getByLabelText('Desde') as HTMLInputElement
    const to = within(years).getByLabelText('hasta') as HTMLInputElement
    expect(from.value).toBe('')
    expect(from.placeholder).toBe('0')
    await userEvent.click(within(years).getByRole('button', { name: 'Desde el inicio de Era de la Corona (0)' }))
    expect(from.value).toBe('0')
    expect(within(years).queryByRole('button', { name: /^Desde el inicio/ })).toBeNull()
    await userEvent.type(to, '-5')
    expect(await within(general).findByText('«Desde» (0) va después de «hasta» (-5).')).toBeDefined()
    await userEvent.clear(to)
    await userEvent.type(to, '3000')
    await waitFor(() => expect(screen.getByText('Sin problemas.')).toBeDefined())
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.calendars[0]?.definition.yearRange).toEqual({ min: 0, max: 3000 }))
  })

  it('un problema sale en su fase y a la derecha; «Guardar» lleva a él; arreglado, se guarda', async () => {
    const { api, router } = open('estaciones')
    const seasons = await screen.findByRole('region', { name: 'Estaciones' })
    const from = within(seasons).getByLabelText('Primer día del año de Primavera')
    await userEvent.clear(from)
    await userEvent.type(from, '60')
    expect(await within(seasons).findByText('Invierno y Primavera se pisan (días 60 a 79).')).toBeDefined()
    const nav = await phases()
    expect(within(nav).getByRole('button', { name: /Estaciones/ }).textContent).toContain('1')
    // Desde otra fase, «Guardar» no guarda y lleva a la del problema, con el foco en el campo
    await userEvent.click(within(nav).getByRole('button', { name: 'General' }))
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(api.calendars[0]?.version).toBe(1)
    await waitFor(() => expect(router.state.location.search).toEqual({ fase: 'estaciones' }))
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true'))
    const again = screen.getByLabelText('Primer día del año de Primavera')
    await userEvent.clear(again)
    await userEvent.type(again, '81')
    await waitFor(() => expect(screen.getByText('Sin problemas.')).toBeDefined())
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.calendars[0]?.version).toBe(2))
  })

  it('Días señalados, su propia fase: se añade, se nombra y se guarda en su mes', async () => {
    const { api } = open('dias-senalados')
    const named = await screen.findByRole('region', { name: 'Días señalados' })
    expect(named.textContent).toContain('No son los días de la semana')
    await userEvent.click(within(named).getByRole('button', { name: 'Día señalado' }))
    await userEvent.selectOptions(within(named).getByLabelText('Mes del día señalado 1'), 'Junio')
    const day = within(named).getByLabelText('Día del día señalado 1')
    await userEvent.clear(day)
    await userEvent.type(day, '21')
    await userEvent.type(within(named).getByLabelText('Nombre del día señalado 1'), 'Pleno Verano')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.calendars[0]?.version).toBe(2))
    const june = api.calendars[0]?.definition.months.find((m) => m.name === 'Junio')
    expect(june?.dayNames?.[20]).toBe('Pleno Verano')
    expect(june?.dayNames?.slice(0, 20).every((name) => name === '')).toBe(true)
  })

  it('salir con cambios pregunta (cambiar de fase, no); «Seguir editando» se queda', async () => {
    const { router } = open()
    const name = await within(await screen.findByRole('region', { name: 'General' })).findByRole('textbox', {
      name: 'Nombre'
    })
    await userEvent.type(name, ' viejo')
    // Cambiar de fase no es salir
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente: Semana' }))
    expect(await screen.findByRole('region', { name: 'Semana' })).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByRole('link', { name: 'Ver calendario' }))
    const ask = await screen.findByRole('dialog', { name: '¿Salir sin guardar los cambios?' })
    await userEvent.click(within(ask).getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.location.pathname).toContain('/editar')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull())
    expect(screen.getByRole('heading', { level: 1, name: 'Calendario de Varn viejo' })).toBeDefined()
  })
})
