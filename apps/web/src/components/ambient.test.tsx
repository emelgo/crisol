import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ambient, ambientAlpha, DEFAULT_AMBIENT, prepareAmbient, useAmbient } from './ambient.tsx'
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

describe('la copia suave del fondo (con lienzo)', () => {
  /** Un lienzo de mentira: lo que se pinta queda apuntado; la imagen, toda del color dado */
  function fakeCanvas(pixel: [number, number, number]) {
    const painted: { fillStyle: string; globalAlpha: number }[] = []
    const context = () => {
      const state = {
        fillStyle: '',
        globalAlpha: 1,
        imageSmoothingQuality: 'low',
        drawImage: () => {},
        fillRect: () => {
          painted.push({ fillStyle: state.fillStyle, globalAlpha: state.globalAlpha })
        },
        getImageData: (_x: number, _y: number, width: number, height: number) => {
          const data = new Uint8ClampedArray(width * height * 4)
          for (let i = 0; i < data.length; i += 4) data.set([...pixel, 255], i)
          return { data }
        }
      }
      // El de la mezcla apunta también con qué tope se pinta la imagen encima
      state.drawImage = () => {
        if (state.fillStyle) painted.push({ fillStyle: 'imagen', globalAlpha: state.globalAlpha })
      }
      return state
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
      context()) as unknown as HTMLCanvasElement['getContext'])
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,suave')
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: async () => {} })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1280 })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 720 })
    return painted
  }
  const layers = () => [...document.querySelectorAll<HTMLElement>('[data-ambiente] > div')]

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    Reflect.deleteProperty(HTMLImageElement.prototype, 'naturalWidth')
    Reflect.deleteProperty(HTMLImageElement.prototype, 'naturalHeight')
  })

  it('sale la copia ya mezclada con el fondo (opaca), con el tope que pide su luz: una clara, más tenue', async () => {
    const painted = fakeCanvas([250, 250, 250])
    render(
      <>
        <Ambient />
        <Wants url="/api/files/nieve" />
      </>
    )
    await waitFor(() => expect(layers().at(-1)?.style.backgroundImage).toContain('data:image/webp;base64,suave'))
    expect(layers().at(-1)?.style.getPropertyValue('--alpha')).toBe('1')
    // Primero el color de fondo, opaco; encima, la imagen con su tope (el de una nieve, bajo)
    expect(painted[0]).toEqual({ fillStyle: 'rgb(23 24 27)', globalAlpha: 1 })
    expect(painted[1]).toEqual({ fillStyle: 'imagen', globalAlpha: ambientAlpha(250, 250, 250) })
    expect(ambientAlpha(250, 250, 250)).toBeLessThan(0.35)
  })

  it('sin lienzo, la imagen tal cual con un tope prudente', async () => {
    fakeCanvas([0, 0, 0])
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(
      <>
        <Ambient />
        <Wants url="/api/files/sin-lienzo" />
      </>
    )
    await waitFor(() => expect(layers().at(-1)?.style.backgroundImage).toBe('url("/api/files/sin-lienzo")'))
    expect(layers().at(-1)?.style.getPropertyValue('--alpha')).toBe(String(ambientAlpha(140, 110, 90)))
  })

  it('al volver a una ya hecha: encima de la de antes, que se va al acabar el fundido; en una transición de vista, ya puesta', async () => {
    fakeCanvas([60, 50, 40])
    const at = (url: string) => (
      <>
        <Ambient />
        <Wants url={url} />
      </>
    )
    const { rerender } = render(at('/api/files/uno'))
    await waitFor(() => expect(layers().at(-1)?.style.backgroundImage).toContain('suave'))
    // Otra, ya preparada de antes (como las portadas de Inicio)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,otra')
    prepareAmbient('/api/files/dos')
    await waitFor(() => expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalled())
    await act(async () => {})
    rerender(at('/api/files/dos'))
    // Al momento, encima de la de antes: dos capas, la nueva arriba
    expect(layers()).toHaveLength(2)
    expect(layers()[1]?.style.backgroundImage).toContain('otra')
    // Al acabar su fundido, la de antes se va
    fireEvent.animationEnd(layers()[1] as HTMLElement)
    expect(layers()).toHaveLength(1)
    expect(layers()[0]?.style.backgroundImage).toContain('otra')
    // Un navegador que no entiende la pregunta por la transición: se funde como siempre
    const matches = vi.spyOn(document.documentElement, 'matches').mockImplementation(() => {
      throw new SyntaxError('selector desconocido')
    })
    rerender(at('/api/files/uno'))
    expect(layers()).toHaveLength(2)
    fireEvent.animationEnd(layers()[1] as HTMLElement)
    // En plena transición de vista, la ya hecha sale sola y quieta (la transición funde una con otra)
    matches.mockImplementation((selector) => selector === ':active-view-transition')
    rerender(at('/api/files/dos'))
    expect(matches).toHaveBeenCalledWith(':active-view-transition')
    expect(layers()).toHaveLength(1)
    expect(layers()[0]?.style.backgroundImage).toContain('otra')
    expect(layers()[0]?.hasAttribute('data-still')).toBe(true)
  })
})

describe('el tope del fondo de ambiente', () => {
  it('una imagen oscura se ve lo más; una clara (nieve, pergamino), mucho menos', () => {
    expect(ambientAlpha(90, 70, 60)).toBe(0.62)
    const snow = ambientAlpha(245, 245, 250)
    const parchment = ambientAlpha(230, 215, 180)
    expect(snow).toBeLessThan(0.35)
    expect(parchment).toBeLessThan(0.4)
    expect(snow).toBeGreaterThanOrEqual(0.16)
  })
})
