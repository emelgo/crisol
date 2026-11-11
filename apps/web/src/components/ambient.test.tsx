import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Ambient, ambientAlpha, DEFAULT_AMBIENT, useAmbient } from './ambient.tsx'
import { setPlain, usePlain } from './plain.ts'

function Wants({ url }: { url: string | null }) {
  useAmbient(url)
  return null
}

const shown = () => document.querySelector('[data-ambiente]')?.getAttribute('data-ambiente')

afterEach(() => {
  setPlain(false)
  localStorage.clear()
})

describe('el fondo de ambiente', () => {
  it('sin nadie que pida otro, el de siempre; manda el último que lo pide, y al irse vuelve el de antes', () => {
    const { rerender } = render(<Ambient />)
    expect(shown()).toBe(DEFAULT_AMBIENT)
    rerender(
      <>
        <Ambient />
        <Wants url="/api/files/mundo" />
      </>
    )
    expect(shown()).toBe('/api/files/mundo')
    rerender(
      <>
        <Ambient />
        <Wants url="/api/files/mundo" />
        <Wants url="/api/files/otro" />
      </>
    )
    expect(shown()).toBe('/api/files/otro')
    // Quien pide null (un mundo sin portada) se queda con el de siempre
    rerender(
      <>
        <Ambient />
        <Wants url="/api/files/mundo" />
        <Wants url={null} />
      </>
    )
    expect(shown()).toBe(DEFAULT_AMBIENT)
    rerender(
      <>
        <Ambient />
        <Wants url="/api/files/mundo" />
      </>
    )
    expect(shown()).toBe('/api/files/mundo')
  })

  it('con «Sin desenfoque» no sale, y la marca va en <html> (y se recuerda)', () => {
    render(<Ambient />)
    expect(shown()).toBe(DEFAULT_AMBIENT)
    act(() => setPlain(true))
    expect(shown()).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-plain')).toBe(true)
    expect(localStorage.getItem('crisol.sin-desenfoque')).toBe('1')
    act(() => setPlain(false))
    expect(shown()).toBe(DEFAULT_AMBIENT)
    expect(document.documentElement.hasAttribute('data-plain')).toBe(false)
  })

  it('una casilla que lo cambia se entera al momento', async () => {
    function Toggle() {
      const plain = usePlain()
      return (
        <label>
          <input type="checkbox" checked={plain} onChange={(event) => setPlain(event.currentTarget.checked)} />
          Sin desenfoque
        </label>
      )
    }
    render(<Toggle />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sin desenfoque' }))
    expect(screen.getByRole('checkbox', { name: 'Sin desenfoque' })).toHaveProperty('checked', true)
    expect(document.documentElement.hasAttribute('data-plain')).toBe(true)
  })
})

describe('el tope del fondo de ambiente', () => {
  it('una imagen oscura se ve lo más; una clara (nieve, pergamino), mucho menos', () => {
    expect(ambientAlpha(90, 70, 60)).toBe(0.32)
    const snow = ambientAlpha(245, 245, 250)
    const parchment = ambientAlpha(230, 215, 180)
    expect(snow).toBeLessThan(0.15)
    expect(parchment).toBeLessThan(0.18)
    expect(snow).toBeGreaterThanOrEqual(0.08)
  })
})
