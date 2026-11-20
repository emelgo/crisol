import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { Block } from './content.tsx'

describe('lo que se lee sin editor (la jugadora, la vista previa, la impresión)', () => {
  it('no pierde las tiradas ni los enlaces al compendio: sin dónde tirar (al imprimir), la tirada sale como texto', () => {
    render(
      <Block
        worldId="w"
        node={{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mordisco. ' },
            { type: 'diceRoll', attrs: { formula: '1d20+4', label: 'Ataque' } },
            { type: 'text', text: ' contra ' },
            { type: 'contentLink', attrs: { name: 'Goblin jefe', label: null } }
          ]
        }}
      />
    )
    const paragraph = screen.getByText(/Mordisco/).closest('p')
    expect(paragraph?.textContent).toBe('Mordisco. 1d20+4 contra Goblin jefe')
  })
})
