import { describe, expect, it } from 'vitest'
import { svgProblem, svgSize } from './svg.ts'

const map = (inner = '', attrs = 'width="2000" height="1400"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`

describe('los mapas en SVG de la IA', () => {
  it('admite lo que hace falta para pintar un mapa: patrones, filtros y referencias de dentro', () => {
    const svg = map(
      '<defs><pattern id="p" width="10" height="10"><rect width="10" height="10"/></pattern>' +
        '<filter id="roca"><feTurbulence baseFrequency="0.02"/></filter></defs>' +
        '<rect width="2000" height="1400" fill="url(#p)" filter="url(#roca)"/><use href="#p"/>'
    )
    expect(svgProblem(svg)).toBeNull()
    expect(svgProblem(`<?xml version="1.0"?>\n${svg}`)).toBeNull()
  })

  it('rechaza lo que ejecuta código o carga algo de fuera', () => {
    expect(svgProblem(map('<script>alert(1)</script>'))).toMatch(/scripts/)
    expect(svgProblem(map('<rect onclick="x()"/>'))).toMatch(/eventos/)
    expect(svgProblem(map('<a href="javascript:x()"/>'))).toMatch(/javascript/)
    expect(svgProblem(map('<image href="https://otra.web/x.png"/>'))).toMatch(/de fuera/)
    expect(svgProblem(map('<use href="https://otra.web/x.svg#a"/>'))).toMatch(/de dentro/)
    expect(svgProblem(map('<rect style="fill:url(https://x/y.png)"/>'))).toMatch(/url\(\)/)
    expect(svgProblem(map('<foreignObject/>'))).toMatch(/foreignObject/)
    expect(svgProblem('<!DOCTYPE svg [<!ENTITY a "b">]><svg/>')).toMatch(/<svg>/)
    expect(svgProblem('<html><svg/></html>')).toMatch(/<svg>/)
  })

  it('solo admite las etiquetas de dibujo (lista blanca): ni con prefijo, ni animaciones, ni enlaces', () => {
    expect(svgProblem(map('<svg:script>alert(1)</svg:script>'))).toMatch(/svg:script/)
    expect(svgProblem(map('<a xlink:href="#p"><rect/></a>'))).toMatch(/<a>/)
    expect(svgProblem(map('<set attributeName="href" to="https://x"/>'))).toMatch(/<set>/)
    expect(svgProblem(map('<rect><animate attributeName="x" to="10"/></rect>'))).toMatch(/<animate>/)
    expect(svgProblem(map('<!-- un comentario --><g><path d="M0 0L10 10"/><text>Sala</text></g>'))).toBeNull()
  })

  it('mide por width y height, o por su viewBox', () => {
    expect(svgSize(map())).toEqual({ width: 2000, height: 1400 })
    expect(svgSize(map('', 'width="1200px" height="800px"'))).toEqual({ width: 1200, height: 800 })
    expect(svgSize(map('', 'viewBox="0 0 3000 2100"'))).toEqual({ width: 3000, height: 2100 })
    expect(svgSize(map('', 'width="100%" viewBox="0,0,500,400"'))).toEqual({ width: 500, height: 400 })
    expect(svgSize(map('', 'width="50000" height="10"'))).toBeNull()
    expect(svgSize('<svg>')).toBeNull()
  })
})
