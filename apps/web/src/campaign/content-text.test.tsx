import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContentText } from './content-text.tsx'

describe('el texto de un documento del contenido', () => {
  it('párrafos, títulos, negrita, cursiva, listas y tablas; las líneas seguidas, una bajo otra', () => {
    const text = [
      '*Aberración Grande, legal malvada*\n**Clase de Armadura** 17',
      '### Acciones',
      '**Cola.** Ataque con arma: +9 a impactar.',
      '- uno\n- *dos*',
      '| FUE | DES |\n| --- | --- |\n| 21 (+5) | 9 (−1) |'
    ].join('\n\n')
    const { container } = render(<ContentText text={text} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Acciones' })).toBeDefined()
    expect(container.querySelector('em')?.textContent).toBe('Aberración Grande, legal malvada')
    expect(container.querySelectorAll('br')).toHaveLength(1)
    expect(screen.getByText('Cola.').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['uno', 'dos'])
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['FUE', 'DES'])
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['21 (+5)', '9 (−1)'])
  })

  it('el HTML se ve como texto, nunca como HTML', () => {
    const { container } = render(<ContentText text={'<img src=x onerror="alert(1)"> y <b>esto</b>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  it('un título de nivel 1 o 2 baja a 3: el del documento ya es el de la página', () => {
    render(<ContentText text={'# Grande\n\n## Mediano'} />)
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Grande', 'Mediano'])
  })
})
