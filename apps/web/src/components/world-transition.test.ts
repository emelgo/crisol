import { afterEach, describe, expect, it, vi } from 'vitest'
import { enterWorld, justEnteredFull, justLeftFull, leaveWorld } from './world-transition.ts'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('entrar y salir del mundo a pantalla completa (ADR-0027)', () => {
  it('al entrar desde su tarjeta, lo de la barra sube a la llama (cada uno aparte) y la cabecera lo sabe un momento', () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <nav><a data-tour="barra-llama"></a><a data-rise="" data-tour="barra-mundos"></a><a data-rise=""></a></nav>
      <ul><li id="tarjeta"></li></ul>`
    enterWorld('mundo', document.getElementById('tarjeta'), true)
    expect(document.getElementById('tarjeta')?.style.viewTransitionName).toBe('mundo-actual')
    expect(document.querySelector<HTMLElement>('[data-tour="barra-llama"]')?.style.viewTransitionName).toBe('llama')
    const rising = [...document.querySelectorAll<HTMLElement>('[data-rise]')].map(
      (item) => item.style.viewTransitionName
    )
    expect(rising).toEqual(['sube-0', 'sube-1'])
    expect(document.documentElement.style.getPropertyValue('--sube-0')).not.toBe('')
    expect(justEnteredFull()).toBe(true)
    // Pasado el momento, ya no (la llama de la cabecera se queda quieta)
    vi.advanceTimersByTime(3000)
    expect(justEnteredFull()).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--sube-0')).toBe('')
  })

  it('al entrar en un mundo que no va a pantalla completa (quien juega), nada de eso', () => {
    document.body.innerHTML = '<nav><a data-tour="barra-llama"></a><a data-rise=""></a></nav><ul><li id="t"></li></ul>'
    enterWorld('otro', document.getElementById('t'))
    expect(document.querySelector<HTMLElement>('[data-rise]')?.style.viewTransitionName).toBe('')
  })

  it('al salir por la llama, los iconos del mundo suben al crisol del último al primero y la barra lo sabe', () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <header data-cabecera-mundo=""></header>
      <div data-world-icons=""><button></button><button></button><button></button></div>`
    leaveWorld()
    expect(document.querySelector<HTMLElement>('[data-cabecera-mundo]')?.style.viewTransitionName).toBe(
      'cabecera-mundo'
    )
    const icons = [...document.querySelectorAll<HTMLElement>('[data-world-icons] > *')]
    expect(icons.map((icon) => icon.style.viewTransitionName)).toEqual([
      'icono-mundo-0',
      'icono-mundo-1',
      'icono-mundo-2'
    ])
    // El primero, el último en subir
    expect(document.documentElement.style.getPropertyValue('--sale-0')).toBe('140ms')
    expect(document.documentElement.style.getPropertyValue('--sale-2')).toBe('0ms')
    // «Mundos» sale cuando han subido todos: dos pasos y lo que tarda uno
    expect(justLeftFull()).toEqual({ leave: 2 * 70 + 460 })
    vi.advanceTimersByTime(3000)
    expect(justLeftFull()).toBeNull()
  })

  it('salir de otra pantalla (sin la cabecera del mundo) no cuenta como salir del mundo a pantalla completa', () => {
    vi.useFakeTimers()
    vi.advanceTimersByTime(5000)
    leaveWorld()
    expect(justLeftFull()).toBeNull()
  })
})
