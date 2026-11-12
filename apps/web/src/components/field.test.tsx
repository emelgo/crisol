import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { Announcer } from './announcer.tsx'
import { Field } from './field.tsx'

function Description() {
  const [value, setValue] = useState('')
  return (
    <Field
      label="Descripción"
      hint="Sale en su tarjeta."
      value={value}
      rows={3}
      maxLength={280}
      counter
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  )
}

describe('un campo', () => {
  it('de varias líneas y con cuenta: dice cuánto se lleva de lo que cabe, y lo enlaza al campo', async () => {
    render(<Description />)
    const field = screen.getByLabelText('Descripción')
    expect(field.tagName).toBe('TEXTAREA')
    expect(screen.getByText('0 / 280')).toBeDefined()
    await userEvent.type(field, 'Niebla')
    expect(screen.getByText('6 / 280')).toBeDefined()
    // El lector de pantalla la lee en palabras (y no cada vez que se teclea: va en la descripción, no en una región viva)
    const words = screen.getByText('6 de 280 caracteres')
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(words.id)
  })

  it('al llegar al límite, lo dice una vez a los lectores de pantalla', async () => {
    render(
      <Announcer>
        <Field label="Lema" maxLength={5} counter />
      </Announcer>
    )
    await userEvent.type(screen.getByLabelText('Lema'), 'Hierro')
    expect(screen.getByRole('status').textContent).toBe('Al límite: 5 caracteres')
    expect(screen.getByText('5 / 5').closest('[data-full]')).not.toBeNull()
  })

  it('sin cuenta, no la enseña', () => {
    render(<Field label="Nombre" maxLength={80} defaultValue="Eana" />)
    expect(screen.queryByText(/\/ 80/)).toBeNull()
    expect(screen.getByLabelText('Nombre').tagName).toBe('INPUT')
  })
})
