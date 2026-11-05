import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberText } from './number-text.tsx'

function Harness({ onValue }: { onValue: (n: number) => void }) {
  const [value, setValue] = useState(3)
  return (
    <>
      <NumberText
        aria-label="Bono"
        value={value}
        onValue={(n) => {
          onValue(n)
          setValue(n)
        }}
      />
      <button type="button" onClick={() => setValue(7)}>
        Poner 7
      </button>
    </>
  )
}

describe('un número que se escribe', () => {
  it('lo escrito a medias se ve tal cual y no pasa; un número, sí; al salir vuelve al de verdad', () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    const input = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Bono' })
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    expect(onValue).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '-2' } })
    expect(onValue).toHaveBeenLastCalledWith(-2)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(input.value).toBe('-2')
  })

  it('si el valor cambia desde fuera, se ve el nuevo', () => {
    render(<Harness onValue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Poner 7' }))
    expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Bono' }).value).toBe('7')
  })
})
