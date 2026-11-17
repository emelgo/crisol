import { describe, expect, it } from 'vitest'
import { canvasKeyTarget } from './focus.ts'

/** Una columna de página con un lienzo, su panel (con campos y casillas) y algo fuera */
function page() {
  document.body.innerHTML = `
    <div id="fuera"><button id="arbol">Árbol</button></div>
    <div data-page-column id="columna">
      <button id="cabecera">⋯</button>
      <section>
        <input id="nombre" />
        <input id="color" type="radio" />
        <input id="casilla" type="checkbox" />
        <input id="tamano" type="range" />
        <select id="lista"><option>a</option></select>
        <textarea id="nota"></textarea>
        <div role="menu"><button id="opcion">Opción</button></div>
      </section>
    </div>`
  const root = document.getElementById('columna')
  const at = (id: string) => document.getElementById(id)
  return { root, at }
}

describe('las teclas del lienzo (Supr, Escape) con el foco donde sea', () => {
  it('le tocan con el foco en la columna de la página, en una casilla o un color, o en ningún sitio', () => {
    const { root, at } = page()
    expect(canvasKeyTarget(document.body, root)).toBe(true)
    expect(canvasKeyTarget(null, root)).toBe(true)
    for (const id of ['cabecera', 'color', 'casilla', 'tamano']) expect(canvasKeyTarget(at(id), root), id).toBe(true)
  })

  it('no donde se escribe, en un menú ni fuera de la página', () => {
    const { root, at } = page()
    for (const id of ['nombre', 'lista', 'nota', 'opcion', 'arbol'])
      expect(canvasKeyTarget(at(id), root), id).toBe(false)
  })
})
