import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { Block } from './content.tsx'

describe('lo que se lee sin editor (la jugadora, la vista previa, la impresión)', () => {
  it('no pierde el código ni los enlaces al compendio (una tirada de antes, `dice:`, es texto en código)', () => {
    render(
      <Block
        worldId="w"
        node={{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mordisco. ' },
            { type: 'text', text: 'dice: 1d20+4 # Ataque', marks: [{ type: 'code' }] },
            { type: 'text', text: ' contra ' },
            { type: 'contentLink', attrs: { name: 'Goblin jefe', label: null } }
          ]
        }}
      />
    )
    const paragraph = screen.getByText(/Mordisco/).closest('p')
    expect(paragraph?.textContent).toBe('Mordisco. dice: 1d20+4 # Ataque contra Goblin jefe')
  })
})
