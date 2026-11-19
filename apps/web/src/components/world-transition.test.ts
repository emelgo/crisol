import { afterEach, describe, expect, it } from 'vitest'
import { enterWorld, leaveWorld, worldTransition } from './world-transition.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

/** A la vista (sin maquetación, todo mediría 0) o por encima de la ventana */
function place(element: Element | null, y = 0) {
  if (element) element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y, width: 600, height: 120 })
}

describe('entrar en un mundo y salir de él', () => {
  it('al entrar, viaja la imagen de la tarjeta, no la tarjeta entera con su texto', () => {
    document.body.innerHTML =
      '<ul><li id="tarjeta"><div id="imagen" data-portada-imagen=""></div><a>Eana</a></li>' +
      '<li><div id="otra" data-portada-imagen="" style="view-transition-name: mundo-actual"></div></li></ul>'
    enterWorld('eana', document.getElementById('tarjeta'))
    expect(document.getElementById('imagen')?.style.viewTransitionName).toBe('mundo-actual')
    expect(document.getElementById('tarjeta')?.style.viewTransitionName).toBe('')
    // Solo ella: el nombre repetido rompería la transición
    expect(document.getElementById('otra')?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toEqual({ viewTransitionName: 'mundo-actual' })
  })

  it('al salir, la franja que enseña la portada del mundo lleva el nombre y la imagen de su tarjeta lo recoge: el espejo de entrar (Enrique, 2026-11-19)', () => {
    document.body.innerHTML =
      '<ul><li><div id="tarjeta-vieja" data-portada-imagen="" style="view-transition-name: mundo-actual"></div></li></ul>' +
      '<main id="contenido"><div id="franja" data-portada-imagen=""><header data-mundo-portada=""></header></div></main>'
    const band = document.getElementById('franja')
    place(band)
    leaveWorld('eana')
    expect(band?.style.viewTransitionName).toBe('mundo-actual')
    expect(document.querySelector<HTMLElement>('[data-mundo-portada]')?.style.viewTransitionName).toBe('')
    expect(document.getElementById('tarjeta-vieja')?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toEqual({ viewTransitionName: 'mundo-actual' })
    expect(worldTransition('otro')).toBeUndefined()
  })

  it('al salir de una cabecera con la imagen dentro (la de una campaña), viaja la imagen', () => {
    document.body.innerHTML =
      '<main id="contenido"><div data-mundo-portada=""><div id="imagen" data-portada-imagen=""></div><h1>La Compañía</h1></div></main>'
    const image = document.getElementById('imagen')
    place(image)
    leaveWorld('compania')
    expect(image?.style.viewTransitionName).toBe('mundo-actual')
  })

  it('sin imagen, nada viaja: un fundido', () => {
    document.body.innerHTML = '<main id="contenido"><div data-mundo-portada=""><h1>La Compañía</h1></div></main>'
    leaveWorld('compania')
    expect(document.querySelector('[style*="view-transition-name"]')).toBeNull()
  })

  it('si su portada ya no se ve (se bajó la página o la cabecera se pegó arriba), no viaja', () => {
    document.body.innerHTML =
      '<main id="contenido"><div id="franja" data-portada-imagen=""><header data-mundo-portada=""></header></div></main>'
    const band = document.getElementById('franja')
    place(band, -400)
    leaveWorld('eana')
    expect(band?.style.viewTransitionName).toBe('')
    place(band)
    if (band) band.style.visibility = 'hidden'
    leaveWorld('eana')
    expect(band?.style.viewTransitionName).toBe('')
    expect(worldTransition('eana')).toEqual({ viewTransitionName: 'mundo-actual' })
  })

  it('sin saber de cuál se sale, nada lleva el nombre', () => {
    document.body.innerHTML =
      '<main id="contenido"><div data-portada-imagen=""><header data-mundo-portada=""></header></div></main>'
    enterWorld('eana', null)
    leaveWorld()
    expect(document.querySelector('[style*="view-transition-name"]')).toBeNull()
    expect(worldTransition('eana')).toBeUndefined()
  })
})
