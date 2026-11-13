import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clampWidth, readShellState, SIDE_WIDTH, sideTabOfSlug, useShellState } from './shell-state.ts'

afterEach(() => localStorage.clear())

describe('lo que recuerda el mundo a pantalla completa', () => {
  it('sin nada guardado: Páginas, desplegada, el ancho de siempre y el panel a la vista', () => {
    expect(readShellState()).toEqual({ tab: 'pages', folded: false, width: SIDE_WIDTH.initial, panelFolded: false })
  })

  it('recuerda la pestaña, si va plegada, su ancho y el panel plegado', () => {
    const { result } = renderHook(() => useShellState())
    act(() => {
      result.current.setTab('files')
      result.current.setFolded(true)
      result.current.setWidth(320)
      result.current.setPanelFolded(true)
    })
    expect(result.current.tab).toBe('files')
    expect(readShellState()).toEqual({ tab: 'files', folded: true, width: 320, panelFolded: true })
    // Desplegar vuelve a lo de siempre
    act(() => result.current.setPanelFolded(false))
    expect(readShellState().panelFolded).toBe(false)
  })

  it('el ancho no baja de su mínimo ni pasa de su máximo, tampoco lo guardado a mano', () => {
    expect(clampWidth(10)).toBe(SIDE_WIDTH.min)
    expect(clampWidth(9999)).toBe(SIDE_WIDTH.max)
    localStorage.setItem('crisol.mundo.ancho', 'nada')
    expect(readShellState().width).toBe(SIDE_WIDTH.initial)
    localStorage.setItem('crisol.mundo.ancho', '5000')
    expect(readShellState().width).toBe(SIDE_WIDTH.max)
  })

  it('la pestaña de la dirección, por su nombre en español', () => {
    expect(sideTabOfSlug('archivos')).toBe('files')
    expect(sideTabOfSlug('paginas')).toBe('pages')
    expect(sideTabOfSlug('otra')).toBeNull()
  })
})
