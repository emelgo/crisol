import { describe, expect, it } from 'vitest'
import { textPdf } from './fixture.ts'
import { pdfPages, pdfPagesIsolated } from './text.ts'

describe('el texto de un PDF (docs/specs/biblioteca.md)', () => {
  it('cada página, con sus tildes y sus líneas; el avance, página a página', async () => {
    const pdf = textPdf(['La guardia de la ciudad\nviste capas grises.', 'Página dos: el capitán Hesk.', 'Tres'])
    const seen: number[] = []
    const pages = await pdfPages(pdf, (done) => {
      seen.push(done)
    })
    expect(pages).toEqual(['La guardia de la ciudad\nviste capas grises.', 'Página dos: el capitán Hesk.', 'Tres'])
    expect(seen).toEqual([1, 2, 3])
  })

  it('lo que no es un PDF, un error', async () => {
    await expect(pdfPages(new TextEncoder().encode('hola'))).rejects.toThrow()
  })

  it('en su hilo aparte: lo mismo, con su avance; lo roto, un error sin tumbar nada', async () => {
    const seen: number[] = []
    const pages = await pdfPagesIsolated(textPdf(['Uno con texto', 'Dos con texto']), (read) => {
      seen.push(read)
    })
    expect(pages).toEqual(['Uno con texto', 'Dos con texto'])
    await expect(pdfPagesIsolated(new TextEncoder().encode('%PDF-1.7\nnada'))).rejects.toThrow()
  })
})
