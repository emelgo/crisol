import { describe, expect, it } from 'vitest'
import { textPdf } from './fixture.ts'
import { pdfPages } from './text.ts'

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
})
