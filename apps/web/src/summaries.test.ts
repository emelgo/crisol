import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { requestSummary, summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)

describe('las frases de la wiki', () => {
  it('en el historial', () => {
    expect(summaryOf(t, { action: 'createPage', details: { title: 'Lugares', parent: null } })).toBe(
      'creó la página «Lugares»'
    )
    expect(summaryOf(t, { action: 'createPage', details: { title: 'Costa Gris', parent: 'Lugares' } })).toBe(
      'creó la página «Costa Gris» dentro de «Lugares»'
    )
    expect(summaryOf(t, { action: 'updatePage', details: { from: 'Puerto', to: 'Puerto Ceniza' } })).toBe(
      'renombró la página «Puerto» a «Puerto Ceniza»'
    )
    expect(summaryOf(t, { action: 'movePage', details: { title: 'Maela Varn', parent: 'Personajes' } })).toBe(
      'movió «Maela Varn» dentro de «Personajes»'
    )
    expect(summaryOf(t, { action: 'movePage', details: { title: 'Lugares', parent: null } })).toBe(
      'movió «Lugares» al primer nivel'
    )
    expect(summaryOf(t, { action: 'updatePage', details: { title: 'Puerto', icon: '⚓' } })).toBe(
      'cambió el icono de «Puerto»'
    )
    expect(summaryOf(t, { action: 'updatePage', details: { title: 'Puerto', icon: null } })).toBe(
      'quitó el icono de «Puerto»'
    )
    expect(summaryOf(t, { action: 'setPageProperties', details: { title: 'Puerto', changed: ['alias'] } })).toBe(
      'cambió las propiedades de «Puerto»'
    )
    expect(summaryOf(t, { action: 'deletePage', details: { title: 'Puerto' } })).toBe('borró la página «Puerto»')
    expect(summaryOf(t, { action: 'createPages', details: { count: 2, titles: ['Lugares', 'Costa Gris'] } })).toBe(
      'creó 2 páginas: «Lugares» y «Costa Gris»'
    )
    expect(
      summaryOf(t, { action: 'createPages', details: { count: 5, titles: ['A', 'B', 'C', 'D', 'E'] } }, 'requested')
    ).toBe('crear 5 páginas: «A», «B», «C» y 2 más')
    expect(summaryOf(t, { action: 'createPages', details: { titles: ['Sola'] } })).toBe('creó la página «Sola»')
    expect(summaryOf(t, { action: 'editPage', details: { title: 'Puerto', body: 'section' } })).toBe(
      'cambió la página «Puerto»'
    )
    expect(summaryOf(t, { action: 'updatePage', details: { title: 'Puerto', locked: true } })).toBe(
      'puso «Puerto» en lectura'
    )
    expect(summaryOf(t, { action: 'updatePage', details: { title: 'Puerto', locked: false } })).toBe(
      'quitó el candado de «Puerto»'
    )
    expect(summaryOf(t, { action: 'restorePage', details: { title: 'Puerto' } })).toBe('restauró la página «Puerto»')
    expect(summaryOf(t, { action: 'uploadFile', details: { name: 'Mapa.png' } })).toBe('subió el archivo «Mapa.png»')
    expect(summaryOf(t, { action: 'updatePage', details: { title: 'Puerto', cover: true } })).toBe(
      'cambió la portada de «Puerto»'
    )
    expect(summaryOf(t, { action: 'updatePage', details: { title: 'Puerto', cover: false } })).toBe(
      'quitó la portada de «Puerto»'
    )
    expect(summaryOf(t, { action: 'renameFile', details: { from: 'a.png', to: 'b.png' } })).toBe(
      'renombró el archivo «a.png» a «b.png»'
    )
    expect(summaryOf(t, { action: 'deleteFile', details: { name: 'Mapa.png' } })).toBe('borró el archivo «Mapa.png»')
  })

  it('lo que pide la IA con un sistema: el nombre sale de su entrada, del que toca o de su documento', () => {
    const asks = (action: string, input: Record<string, unknown>, details: Record<string, unknown> = {}) =>
      requestSummary(t, { action, input, details })
    expect(asks('updateSystem', { systemId: 's', version: 1, changes: [] }, { system: 'Fronteras' })).toBe(
      'cambiar el sistema «Fronteras»'
    )
    expect(asks('deleteSystem', { systemId: 's' }, { system: 'Fronteras' })).toBe('borrar el sistema «Fronteras»')
    expect(asks('createSystem', { document: { name: { es: 'Fronteras', en: 'Frontiers' } } })).toBe(
      'crear el sistema «Fronteras»'
    )
    expect(asks('createSystem', { name: 'Copia', from: 'blank' }, { system: 'En blanco' })).toBe(
      'crear el sistema «Copia»'
    )
    expect(asks('importSystem', { file: { system: { name: 'Subido' } } })).toBe('subir el sistema «Subido»')
  })

  it('lo que pide Claude, con los títulos de lo que toca', () => {
    expect(
      requestSummary(t, {
        action: 'movePage',
        input: { pageId: 'p', parentId: 'q' },
        details: { page: 'Maela Varn', parent: 'Personajes' }
      })
    ).toBe('mover «Maela Varn» dentro de «Personajes»')
    expect(
      requestSummary(t, { action: 'movePage', input: { pageId: 'p', parentId: null }, details: { page: 'Lugares' } })
    ).toBe('mover «Lugares» al primer nivel')
    expect(
      requestSummary(t, {
        action: 'updatePage',
        input: { pageId: 'p', title: 'Puerto Ceniza' },
        details: { page: 'Puerto' }
      })
    ).toBe('renombrar la página «Puerto» a «Puerto Ceniza»')
    expect(
      requestSummary(t, { action: 'updatePage', input: { pageId: 'p', icon: '⚓' }, details: { page: 'Puerto' } })
    ).toBe('cambiar el icono de «Puerto»')
    expect(
      requestSummary(t, {
        action: 'setPageProperties',
        input: { pageId: 'p', properties: [] },
        details: { page: 'Puerto' }
      })
    ).toBe('cambiar las propiedades de «Puerto»')
    expect(
      requestSummary(t, {
        action: 'createPage',
        input: { worldId: 'w', title: 'Costa Gris', parentId: 'q' },
        details: { world: 'Eana', parent: 'Lugares' }
      })
    ).toBe('crear la página «Costa Gris» dentro de «Lugares»')
  })
})
