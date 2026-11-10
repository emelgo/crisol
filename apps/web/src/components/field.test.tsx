import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
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
    const count = screen.getByText('6 / 280')
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(count.id)
    expect(count.hasAttribute('data-full')).toBe(false)
  })

  it('sin cuenta, no la enseña', () => {
    render(<Field label="Nombre" maxLength={80} defaultValue="Eana" />)
    expect(screen.queryByText(/\/ 80/)).toBeNull()
    expect(screen.getByLabelText('Nombre').tagName).toBe('INPUT')
  })
})
