import type { System } from '@crisol/systems'
import { cinco, fronteras } from '@crisol/systems/fixtures'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { lastSaved, renderEditor } from './testing.tsx'

const OBJECTS = /¿Qué se lleva\?/
const SHEET = /¿Cómo se ve la ficha\?/
const CREATION = /¿Cómo se crea un personaje\?/
const COMPENDIUM = /¿Qué trae el compendio\?/
const ADVANCED = /Lo avanzado/

const announced = (text: string) =>
  waitFor(() =>
    expect(
      screen
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join(' ')
    ).toContain(text)
  )
/** Lo que se ve en cada fila de una lista del paso (su clase, su nombre y lo que lleva) */
const rowsOf = () =>
  within(screen.getByRole('article'))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('el paso «¿Qué se lleva?» del editor de sistemas', () => {
  it('cada clase de cosa con sus campos (la primera, abierta); su nombre se cambia y se guarda', async () => {
    const { api, id } = await renderEditor({ step: OBJECTS })
    const objeto = screen.getByRole('button', { name: /^Objeto/ })
    expect(objeto.getAttribute('aria-expanded')).toBe('true')
    expect(objeto.textContent).toContain('3 cosas dentro')
    expect(screen.getByRole('button', { name: /^Movimiento/ }).getAttribute('aria-expanded')).toBe('false')
    // Sus campos, como los del personaje
    expect(screen.getByRole('button', { name: /^Peso/ })).toBeDefined()
    const name = screen.getByLabelText<HTMLInputElement>('Cómo se llaman')
    expect(name.value).toBe('Objeto')
    await userEvent.clear(name)
    await userEvent.type(name, 'Equipo de viaje')
    expect(screen.getByRole('button', { name: /^Equipo de viaje/ })).toBeDefined()
    await waitFor(async () => expect((await lastSaved(api, id)).types.objeto?.label).toBe('Equipo de viaje'))
    // Pulsar otra la abre (y cierra la de antes); pulsarla otra vez, la cierra
    await userEvent.click(screen.getByRole('button', { name: /^Movimiento/ }))
    expect(screen.getByRole('button', { name: /^Movimiento/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^Equipo de viaje/ }).getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(screen.getByRole('button', { name: /^Movimiento/ }))
    expect(screen.queryByLabelText('Cómo se llaman')).toBeNull()
  })

  it('añadir una clase de cosa la abre con un campo «Nombre»; quitar una deja «Deshacer»', async () => {
    const { api, id } = await renderEditor({ step: OBJECTS })
    await userEvent.click(screen.getByRole('button', { name: 'Una clase de cosa' }))
    const added = screen.getByRole('button', { name: /^Equipo/ })
    expect(added.getAttribute('aria-expanded')).toBe('true')
    expect(added.textContent).toContain('1 cosa dentro')
    expect(screen.getByRole('button', { name: /^Nombre/ })).toBeDefined()
    await waitFor(async () =>
      expect((await lastSaved(api, id)).types.equipo).toEqual({
        label: 'Equipo',
        document: 'item',
        fields: { nombre: { kind: 'text', label: 'Nombre' } }
      })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Quitar «Movimiento»' }))
    expect(screen.queryByRole('button', { name: /^Movimiento/ })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeDefined()
  })

  it('sin ninguna, lo dice', async () => {
    const { objeto: _, movimiento: __, ...types } = fronteras.types
    await renderEditor({ system: { ...fronteras, types, creation: [] }, step: OBJECTS })
    expect(screen.getByText(/Aún no hay cosas que se lleven/)).toBeDefined()
  })
})

describe('el paso «¿Cómo se ve la ficha?» del editor de sistemas', () => {
  it('sin una suya, la que sale de sus campos; cambiarla la hace suya y se puede rehacer desde los campos', async () => {
    const { api, id } = await renderEditor({ step: SHEET })
    expect(screen.getByText(/Esta es la ficha que sale de sus campos/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Rehacer desde los campos' })).toBeNull()
    // Cada bloque, con lo que lleva (por sus nombres, no por sus claves)
    expect(rowsOf()).toEqual([
      'CabeceraNombre, línea y retrato',
      'CifrasVigor, Astucia, Presencia, Defensa, Carga',
      'Algo que se gastaHeridas',
      'Lo que llevaLleva',
      'Lo que puede hacer',
      'Usos'
    ])
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Subir «Cabecera»' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Bajar «Usos»' }).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Bajar «Cabecera»' }))
    await announced('«Cabecera», 2 de 6')
    // El foco sigue en su botón, en su sitio nuevo
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Bajar «Cabecera»' })))
    expect(rowsOf()[1]).toBe('CabeceraNombre, línea y retrato')
    expect(screen.queryByText(/Esta es la ficha que sale de sus campos/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar «Usos»' }))
    expect(rowsOf()).toHaveLength(5)
    await waitFor(async () =>
      expect((await lastSaved(api, id)).sheet?.blocks.map((b) => b.kind)).toEqual([
        'stats',
        'header',
        'resource',
        'items',
        'actions'
      ])
    )
    await userEvent.click(screen.getByRole('button', { name: 'Rehacer desde los campos' }))
    expect(rowsOf()).toHaveLength(6)
    expect(rowsOf()[0]).toBe('CabeceraNombre, línea y retrato')
  })

  it('las columnas y las pestañas se describen por lo que llevan; un bloque con título lo enseña', async () => {
    const system: System = {
      ...fronteras,
      sheet: {
        blocks: [
          {
            kind: 'columns',
            blocks: [
              { kind: 'header' },
              { kind: 'stats', label: 'Defensas', fields: ['defensa'] },
              { kind: 'resource', field: 'heridas' }
            ]
          },
          {
            kind: 'tabs',
            tabs: [
              { label: 'Notas', blocks: [] },
              { label: 'Equipo', blocks: [] }
            ]
          },
          { kind: 'stats', label: 'Atributos', fields: ['vigor', 'astucia'] }
        ]
      }
    }
    await renderEditor({ system, step: SHEET })
    expect(rowsOf()).toEqual([
      'ColumnasNombre, línea y retrato · Defensas · Heridas',
      'PestañasNotas · Equipo',
      'CifrasAtributosVigor, Astucia'
    ])
    // Ya es suya: se puede rehacer desde los campos
    await userEvent.click(screen.getByRole('button', { name: 'Rehacer desde los campos' }))
    expect(rowsOf()[0]).toBe('CabeceraNombre, línea y retrato')
  })
})

describe('el paso «¿Cómo se crea un personaje?» del editor de sistemas', () => {
  it('sus pasos, con nombres en vez de claves y sin repetir el suyo; se suben, se bajan y se quitan', async () => {
    const creation = structuredClone(fronteras.creation ?? [])
    Object.assign(creation[1] ?? {}, { label: 'Movimiento' })
    const { api, id } = await renderEditor({ system: { ...fronteras, creation }, step: CREATION })
    expect(rowsOf()).toEqual([
      'Escribir en la fichaAtributosVigor, Astucia, Presencia',
      'Elegir del compendioMovimiento',
      'El resumenResumen'
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Bajar «Atributos»' }))
    await announced('«Atributos», 2 de 3')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar «Resumen»' }))
    await waitFor(async () =>
      expect((await lastSaved(api, id)).creation?.map((s) => s.key)).toEqual(['movimientos', 'atributos'])
    )
  })

  it('cada clase de paso se añade con lo primero que le vale; repartir puntuaciones pide unas características', async () => {
    const { api, id } = await renderEditor({ system: { ...fronteras, creation: [] }, step: CREATION })
    expect(screen.getByText('Sin pasos, el personaje se rellena a mano en su ficha.')).toBeDefined()
    const scores = screen.getByRole<HTMLButtonElement>('button', { name: 'Repartir puntuaciones' })
    expect(scores.disabled).toBe(true)
    // Desactivado, y dice por qué
    const why = document.getElementById(scores.getAttribute('aria-describedby') ?? '')
    expect(why?.textContent).toBe('Para repartir puntuaciones hacen falta unas características con su cifra (paso 1).')
    await userEvent.click(screen.getByRole('button', { name: 'Elegir del compendio' }))
    await userEvent.click(screen.getByRole('button', { name: 'Escribir en la ficha' }))
    await userEvent.click(screen.getByRole('button', { name: 'El resumen' }))
    expect(rowsOf()).toEqual([
      'Elegir del compendioElegir del compendioObjeto',
      'Escribir en la fichaEscribir en la fichaVigor',
      'El resumenEl resumen'
    ])
    await waitFor(async () =>
      expect((await lastSaved(api, id)).creation).toEqual([
        { key: 'elegir_del_compendio', label: 'Elegir del compendio', kind: 'content', type: 'objeto' },
        { key: 'escribir_en_la_ficha', label: 'Escribir en la ficha', kind: 'fields', fields: ['vigor'] },
        { key: 'el_resumen', label: 'El resumen', kind: 'summary' }
      ])
    )
  })

  it('con unas características con su cifra, repartir puntuaciones empieza con valores fijos', async () => {
    const { api, id } = await renderEditor({ system: cinco, step: CREATION })
    await userEvent.click(screen.getByRole('button', { name: 'Repartir puntuaciones' }))
    expect(rowsOf()).toEqual(['Repartir puntuacionesRepartir puntuacionesValores fijos'])
    await waitFor(async () =>
      expect((await lastSaved(api, id)).creation?.[0]).toMatchObject({
        kind: 'scores',
        set: 'caracteristicas',
        field: 'puntuacion',
        methods: [{ key: 'fijos', kind: 'array', values: [15, 14, 13, 12, 10, 8] }]
      })
    )
  })

  it('sin campos ni clases de cosa, cada botón dice qué le falta', async () => {
    const system: System = {
      ...fronteras,
      types: { personaje: { document: 'actor', label: 'Personaje', fields: {} } },
      rolls: {},
      creation: [],
      card: []
    }
    await renderEditor({ system, step: CREATION })
    for (const [name, why] of [
      ['Elegir del compendio', 'Para elegir del compendio hace falta una clase de cosa (paso 3).'],
      ['Escribir en la ficha', 'Para escribir en la ficha hace falta algún campo (paso 1).']
    ]) {
      const button = screen.getByRole<HTMLButtonElement>('button', { name })
      expect(button.disabled).toBe(true)
      expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(why)
    }
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'El resumen' }).disabled).toBe(false)
  })
})

describe('el paso «¿Qué trae el compendio?» del editor de sistemas', () => {
  it('sus libros, con sus entradas y, si los tiene, sus capítulos; cada uno se abre', async () => {
    const { id } = await renderEditor({
      system: cinco,
      step: COMPENDIUM,
      content: [
        { type: 'objeto', key: 'escudo', source: 'srd52', data: { name: 'Escudo' } },
        { type: 'objeto', key: 'anillo', source: 'srd52', data: { name: 'Anillo' } }
      ],
      before: (api, systemId) =>
        api.client.call('saveChapter', { systemId, source: 'srd51', title: 'El combate', markdown: 'Asaltos.' })
    })
    expect(await screen.findByText('0 entradas · 1 capítulos')).toBeDefined()
    expect(screen.getByText('2 entradas')).toBeDefined()
    const links = screen.getAllByRole('link', { name: 'Abrir' })
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `/sistemas/${id}/libros/srd51`,
      `/sistemas/${id}/libros/srd52`
    ])
    expect(
      screen
        .getByRole('link', { name: 'Los libros se crean y se cambian en el Inicio del sistema' })
        .getAttribute('href')
    ).toBe(`/sistemas/${id}`)
  })

  it('sin libros, lo dice', async () => {
    await renderEditor({ step: COMPENDIUM })
    expect(await screen.findByText('Aún no tiene libros.')).toBeDefined()
  })

  it('si no llegan, lo dice y deja reintentarlo', async () => {
    const { api } = await renderEditor({ step: COMPENDIUM, fail: { getSystemBooks: 'NOT_FOUND' } })
    expect(await screen.findByText('Ya no existe')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.calls.filter((c) => c === 'getSystemBooks').length).toBeGreaterThan(1))
  })
})

describe('el paso «Lo avanzado» del editor de sistemas', () => {
  it('la iniciativa es una de sus tiradas o se escribe a mano', async () => {
    const rolls = { ...fronteras.rolls, iniciativa: { label: 'Iniciativa', formula: '2d6 + @astucia' } }
    const { api, id } = await renderEditor({ system: { ...fronteras, rolls }, step: ADVANCED })
    const initiative = screen.getByLabelText<HTMLSelectElement>('La tirada de iniciativa')
    expect([...initiative.options].map((o) => o.text)).toEqual(['Se escribe a mano', 'Atributo', 'Iniciativa'])
    await userEvent.selectOptions(initiative, 'Iniciativa')
    await waitFor(async () => expect((await lastSaved(api, id)).initiative).toBe('iniciativa'))
    await userEvent.selectOptions(initiative, 'Se escribe a mano')
    await waitFor(async () => expect((await lastSaved(api, id)).initiative).toBeUndefined())
  })

  it('su versión y sus idiomas (el último no se puede quitar)', async () => {
    const { api, id } = await renderEditor({ step: ADVANCED })
    const version = screen.getByLabelText<HTMLInputElement>('Su versión')
    await userEvent.clear(version)
    await userEvent.type(version, '8')
    const spanish = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Español' })
    expect(spanish.checked).toBe(true)
    expect(spanish.disabled).toBe(true)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Inglés' }))
    expect(spanish.disabled).toBe(false)
    await waitFor(async () => {
      const saved = await lastSaved(api, id)
      expect(saved.version).toBe('8')
      expect(saved.languages).toEqual(['es', 'en'])
    })
    await userEvent.click(spanish)
    await waitFor(async () => expect((await lastSaved(api, id)).languages).toEqual(['en']))
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Inglés' }).disabled).toBe(true)
  })

  it('bajar su archivo', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    try {
      const { api } = await renderEditor({ step: ADVANCED })
      await userEvent.click(screen.getByRole('button', { name: 'Bajar' }))
      await waitFor(() => expect(created).toHaveBeenCalled())
      expect(api.calls).toContain('exportSystem')
    } finally {
      created.mockRestore()
    }
  })

  it('si no se puede bajar, lo dice', async () => {
    await renderEditor({ step: ADVANCED, fail: { exportSystem: 'NOT_FOUND' } })
    await userEvent.click(screen.getByRole('button', { name: 'Bajar' }))
    expect(await screen.findByText('Ya no existe')).toBeDefined()
  })
})
