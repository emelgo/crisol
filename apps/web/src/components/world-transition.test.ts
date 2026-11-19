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
    const header = document.querySelector<HTMLElement>('[data-mundo-portada]')
    // A la vista (sin maquetación, todo mediría 0)
    if (header) header.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 600, height: 120 })
    leaveWorld('eana')
    expect(header?.style.viewTransitionName).toBe('mundo-actual')
    // Solo ella: el nombre repetido rompería la transición
    expect(document.getElementById('tarjeta-vieja')?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toEqual({ viewTransitionName: 'mundo-actual' })
    expect(worldTransition('otro')).toBeUndefined()
  })

  it('si su cabecera ya no se ve (se bajó la página), no viaja: la tarjeta sale sin más', () => {
    document.body.innerHTML = '<main id="contenido"><header data-mundo-portada=""></header></main>'
    const header = document.querySelector<HTMLElement>('[data-mundo-portada]')
    if (header) header.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: -400, width: 600, height: 120 })
    leaveWorld('eana')
    expect(header?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toEqual({ viewTransitionName: 'mundo-actual' })
  })

  it('sin saber de cuál se sale, nada lleva el nombre', () => {
    document.body.innerHTML = '<main id="contenido"><header data-mundo-portada=""></header></main>'
    enterWorld('eana', null)
    leaveWorld()
    expect(document.querySelector<HTMLElement>('[data-mundo-portada]')?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toBeUndefined()
  })
})
