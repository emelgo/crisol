import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('los enlaces a otras entradas (ADR-0033): [[@Nombre]], con texto propio, con su tipo, por clave e incrustadas', async () => {
    const opened: string[] = []
    render(
      <ContentText
        text={'Ver [[@Bola de fuego]], [[@objeto/Escudo]], [[@escudo-armadura|el escudo]] y ![[@poción-de-curación]].'}
        onLink={(name) => opened.push(name)}
      />
    )
    for (const name of ['Bola de fuego', 'Escudo', 'el escudo', 'poción-de-curación'])
      await userEvent.click(screen.getByRole('button', { name }))
    expect(opened).toEqual(['Bola de fuego', 'objeto/Escudo', 'escudo-armadura', 'poción-de-curación'])
  })

  it('sin a dónde abrirlos, los enlaces son solo su texto', () => {
    render(<ContentText text="Ver [[@Bola de fuego|la bola]]." />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('la bola')).toBeDefined()
  })

  it('en una tabla, la barra escapada de un enlace (\\|) no parte la celda', () => {
    render(
      <ContentText
        text={'| Objeto | Coste |\n| --- | --- |\n| [[@Espada larga\\|Espada]] | 15 po |'}
        onLink={() => undefined}
      />
    )
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['Espada', '15 po'])
  })

  it('los recuadros con su título y su página, las citas y los secretos (que solo le llegan al máster)', () => {
    const text = [
      '> [!nota|p5] Aprender viendo jugar\n> Una buena forma de aprender.',
      '> [!cita]\n> Esta historia comenzó hace 50 años.\n>\n> — Jeremy Crawford',
      '> [!secreto]\n> Es un vampiro.',
      '> Una cita sin más.'
    ].join('\n\n')
    const { container } = render(<ContentText text={text} />)
    const note = container.querySelector('[data-callout="note"]')
    expect(note?.textContent).toContain('Aprender viendo jugar')
    expect(note?.textContent).toContain('p5')
    expect(note?.textContent).toContain('Una buena forma de aprender.')
    expect(container.querySelector('[data-callout="quote"]')?.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('[data-callout="secret"]')?.textContent).toContain('Es un vampiro.')
    expect(container.querySelector('blockquote')?.textContent).toBe('Una cita sin más.')
  })
})
