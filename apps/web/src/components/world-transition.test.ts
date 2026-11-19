import { afterEach, describe, expect, it } from 'vitest'
import { enterWorld, leaveWorld, worldTransition } from './world-transition.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('entrar en un mundo y salir de él', () => {
  it('al salir, la cabecera del mundo lleva el nombre y su tarjeta lo recoge: el espejo de entrar (Enrique, 2026-11-19)', () => {
    document.body.innerHTML =
      '<ul><li id="tarjeta-vieja" style="view-transition-name: mundo-actual"></li></ul>' +
      '<main id="contenido"><header data-mundo-portada=""></header></main>'
    leaveWorld('eana')
    const header = document.querySelector<HTMLElement>('[data-mundo-portada]')
    expect(header?.style.viewTransitionName).toBe('mundo-actual')
    // Solo ella: el nombre repetido rompería la transición
    expect(document.getElementById('tarjeta-vieja')?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toEqual({ viewTransitionName: 'mundo-actual' })
    expect(worldTransition('otro')).toBeUndefined()
  })

  it('sin saber de cuál se sale, nada lleva el nombre', () => {
    document.body.innerHTML = '<main id="contenido"><header data-mundo-portada=""></header></main>'
    enterWorld('eana', null)
    leaveWorld()
    expect(document.querySelector<HTMLElement>('[data-mundo-portada]')?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toBeUndefined()
  })
})
