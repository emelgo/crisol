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

  it('pulsar su tarjeta lo abre: el título, «Editar calendario», el mes, el año en pequeño y sus datos', async () => {
    const { router } = renderAt(`/mundos/${WORLD.id}/calendarios`)
    const list = await screen.findByRole('list', { name: 'Calendarios del mundo' })
    await userEvent.click(within(list).getByRole('link', { name: 'Calendario de Varn' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/mundos/${WORLD.id}/calendarios/${VARN.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendario de Varn' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Editar calendario' })).toBeDefined()
    // Se abre en el año de su última era (el 0): enero, con el 1 en sábado (la sexta columna)
    expect(screen.getByRole('heading', { level: 2, name: 'Enero de 0 RV' })).toBeDefined()
    const year = screen.getByRole('complementary', { name: 'El año y los datos del calendario' })
    expect(within(year).getByRole('img', { name: 'El año de Calendario de Varn' })).toBeDefined()
    expect(year.textContent).toContain('365 días')
    expect(year.textContent).toContain('Principal')
    // Un mes del año pequeño lleva a él
    await userEvent.click(within(year).getByRole('button', { name: /Junio/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Junio de 0 RV' })).toBeDefined()
    expect(within(year).getByRole('button', { name: /Junio/ }).getAttribute('aria-current')).toBe('true')
  })

  it('el día elegido, a la derecha, con su fecha, sus lunas y lo que pasa; las flechas pasan de mes y de año', async () => {
    open({
      events: [
        {
          worldId: WORLD.id,
          title: 'Boda de Ilsa',
          date: { calendarId: VARN.id ?? '', start: { year: 0, month: 'ene', day: 3 } }
        }
      ]
    })
    const day = await screen.findByRole('complementary', { name: 'El día elegido' })
    // Sin elegir, el primero del mes
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain('1 de Enero de 0 RV')
    await userEvent.click(screen.getByRole('cell', { name: / 3 de Enero de 0 RV$/ }))
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain('3 de Enero de 0 RV')
    expect(await within(day).findByText('Boda de Ilsa')).toBeDefined()
    expect(day.textContent).toContain('Luna')
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Febrero de 0 RV' })).toBeDefined()
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain('1 de Febrero de 0 RV')
    await userEvent.click(screen.getByRole('button', { name: 'Año siguiente' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Febrero de 1 RV' })).toBeDefined()
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
    expect(within(day).getByRole('heading', { level: 2 }).textContent).toContain('3 de Enero de 0 RV')
  })

  it('«Nuevo evento» crea un evento suelto del mundo con la fecha del día elegido', async () => {
    const { api } = open()
    await userEvent.click(await screen.findByRole('cell', { name: / 5 de Enero de 0 RV$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo evento' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Título'), 'Coronación')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(api.events.find((e) => e.title === 'Coronación')).toBeDefined())
    expect(api.events.find((e) => e.title === 'Coronación')?.date).toMatchObject({
      calendarId: VARN.id,
      start: { year: 0, month: 'ene', day: 5 }
    })
    const day = screen.getByRole('complementary', { name: 'El día elegido' })
    expect(await within(day).findByText('Coronación')).toBeDefined()
  })

  it('«Página con esta fecha»: una página nueva con el campo Fecha, abierta para ponerle título', async () => {
    const { api, router } = open()
    await userEvent.click(await screen.findByRole('cell', { name: / 7 de Enero de 0 RV$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Página con esta fecha' }))
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

  it('«Hoy de…»: con una campaña con fecha, se abre en su hoy, marcado', async () => {
    open({
      campaigns: [MARCA],
      todays: [{ campaignId: MARCA.id, calendarId: VARN.id ?? '', date: { year: 1250, month: 'mar', day: 18 } }]
    })
    expect(await screen.findByRole('heading', { level: 2, name: 'Marzo de 1250 RV' })).toBeDefined()
    expect(screen.getByLabelText('Hoy de')).toBeDefined()
    const today = screen.getByRole('cell', { name: /18 de Marzo de 1250 RV/ })
    expect(today.getAttribute('aria-current')).toBe('date')
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ir a hoy' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Marzo de 1250 RV' })).toBeDefined()
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
