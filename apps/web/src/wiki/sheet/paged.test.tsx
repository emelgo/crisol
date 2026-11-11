import type { SheetSettings } from '@crisol/contracts'
import { editorExtensions } from '@crisol/editor'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../i18n.ts'
import { GHOST_LINE, GhostLine } from '../ghost-line.ts'
import { PagedSheet, SheetLayout } from './paged.tsx'

const SHEET: SheetSettings = { paper: 'a4', theme: 'neutro', numbers: true, firstNumber: 1, footer: true, columns: 1 }

const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const h = (text: string): JSONContent => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })
const pageBreak: JSONContent = { type: 'pageBreak' }
const columnBreak: JSONContent = { type: 'columnBreak' }
const columns = (count: 1 | 2): JSONContent => ({ type: 'columnsChange', attrs: { count } })
const wide = (text: string): JSONContent => ({ type: 'wideBlock', content: [p(text)] })

let current: Editor | null = null

function Harness({
  content,
  settings,
  ready = true
}: {
  content: JSONContent[]
  settings: SheetSettings | null
  ready?: boolean
}) {
  const editor = useEditor({
    extensions: [...editorExtensions(), GhostLine.configure({ className: 'linea' }), SheetLayout],
    content: { type: 'doc', content }
  })
  useEffect(() => {
    current = editor
  }, [editor])
  return (
    <PagedSheet editor={editor} settings={settings} ready={ready}>
      <EditorContent editor={editor} />
    </PagedSheet>
  )
}

/**
 * El estilo con el que se colocó cada bloque de primer nivel (por su orden), del estado de la maqueta: happy-dom pierde
 * propiedades al cambiar el estilo de un nodo como lo hace ProseMirror, así que en el DOM no siempre se ve
 */
const placed = (): string[] => {
  const editor = current as unknown as Editor
  const plugin = editor.state.plugins.find((each) =>
    (each as unknown as { key: string }).key.startsWith('hojaAlEscribir')
  )
  const state = plugin?.getState(editor.state) as { styles: readonly string[] | null } | undefined
  return state?.styles ? [...state.styles] : editor.state.doc.content.content.map(() => '')
}
const at = (style: string) => {
  const box = document.createElement('div')
  box.setAttribute('style', style)
  return {
    left: Number.parseFloat(box.style.left),
    top: Number.parseFloat(box.style.top),
    width: Number.parseFloat(box.style.width)
  }
}
const marks = () => screen.queryAllByText(/^Página \d+$/).map((mark) => mark.textContent)
const frame = () => document.querySelector<HTMLElement>('[data-sheet-paged]')

// En happy-dom nada mide: un párrafo, 400 px; un título, 100; lo demás (los saltos), 20; y sin márgenes
beforeEach(() => {
  const computed = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = computed(element, pseudo)
    return new Proxy(style, {
      get: (target, key) => {
        if (key === 'marginTop' || key === 'marginBottom') return '0px'
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'P') return 400
    if (/^H\d$/.test(this.tagName)) return 100
    if (this.hasAttribute('data-wide-block')) return 400
    return 20
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  current = null
})

describe('la hoja al escribir', () => {
  it('sin hoja, el texto tal cual, sin colocar', async () => {
    render(<Harness content={[p('Uno'), p('Dos')]} settings={null} />)
    await waitFor(() => expect(current).not.toBeNull())
    expect(frame()).toBeNull()
    expect(placed()).toEqual(['', ''])
  })

  it('a una columna: cada bloque en su sitio, seguidos, y donde acaba cada página una raya con la que se cierra', async () => {
    render(<Harness content={[p('Uno'), p('Dos'), p('Tres'), p('Cuatro'), p('Cinco')]} settings={SHEET} />)
    await waitFor(() => expect(marks()).toEqual(['Página 1', 'Página 2']))
    // A4: 995 px de texto por página; caben dos párrafos de 400
    const boxes = placed().map(at)
    expect(boxes.map((box) => box.top)).toEqual([0, 400, 828, 1228, 1656])
    expect(boxes.every((box) => box.left === 0 && box.width === 682)).toBe(true)
    // Debajo, sitio para la línea de más
    expect(frame()?.style.blockSize).toBe(`${2056 + 32}px`)
    expect(frame()?.hasAttribute('data-placed')).toBe(true)
    // La línea de más, debajo del último
    const ghost = (current as unknown as Editor).view.dom.querySelector<HTMLElement>(`[${GHOST_LINE}]`)
    expect(ghost?.style.position).toBe('absolute')
    expect(ghost?.style.top).toBe('2056px')
  })

  it('numera desde el primer número de la hoja', async () => {
    render(<Harness content={[p('Uno'), p('Dos'), p('Tres')]} settings={{ ...SHEET, firstNumber: 7 }} />)
    await waitFor(() => expect(marks()).toEqual(['Página 7']))
  })

  it('un salto puesto a mano dice también la página que cierra, y va de lado a lado', async () => {
    render(<Harness content={[p('Uno'), pageBreak, p('Dos')]} settings={SHEET} />)
    await waitFor(() => expect(placed()[1]).toContain('--sheet-page:"Página 1"'))
    expect(placed()[1]).toContain('--break-label:none')
    expect(at(placed()[1] ?? '').width).toBe(682)
  })

  it('un salto de página hace de marca: lo que sigue va justo debajo', async () => {
    render(<Harness content={[p('Uno'), pageBreak, p('Dos')]} settings={SHEET} />)
    await waitFor(() =>
      expect(
        placed()
          .map(at)
          .map((box) => box.top)
      ).toEqual([0, 400, 420])
    )
    expect(marks()).toEqual([])
  })

  it('un salto antes del primer bloque va arriba del todo, empujando lo demás', async () => {
    render(<Harness content={[pageBreak, p('Uno')]} settings={SHEET} />)
    await waitFor(() =>
      expect(
        placed()
          .map(at)
          .map((box) => box.top)
      ).toEqual([0, 20])
    )
  })

  it('a dos columnas: los títulos y los bloques se reparten, lo ancho ocupa todo y el salto de columna pasa a la otra', async () => {
    render(
      <Harness
        content={[h('Costa'), p('Uno'), columnBreak, p('Dos'), wide('Ancho'), p('Tres'), columnBreak]}
        settings={{ ...SHEET, columns: 2 }}
      />
    )
    // La columna: (682 − 28) / 2 = 327; la de la derecha empieza en 327 + 28
    await waitFor(() => expect(placed().map(at)[3]?.left).toBe(355))
    const boxes = placed().map(at)
    expect(boxes[0]).toEqual({ left: 0, top: 0, width: 327 })
    expect(boxes[1]).toEqual({ left: 0, top: 100, width: 327 })
    expect(boxes[3]).toEqual({ left: 355, top: 0, width: 327 })
    // Lo ancho, debajo de las dos columnas, a todo lo ancho
    expect(boxes[4]).toEqual({ left: 0, top: 500, width: 682 })
    // El salto del final no va en ninguna fila: justo debajo del bloque de antes
    expect(boxes[6]?.top).toBe(boxes[5] ? boxes[5].top + 400 : Number.NaN)
  })

  it('un cambio de columnas vale para lo que sigue y no cuenta al repartir las páginas', async () => {
    render(<Harness content={[p('Uno'), columns(2), p('Dos'), p('Tres'), columns(1), p('Cuatro')]} settings={SHEET} />)
    await waitFor(() => expect(placed().map(at)[2]?.width).toBe(327))
    const boxes = placed().map(at)
    expect(boxes[0]?.width).toBe(682)
    expect(boxes[3]).toMatchObject({ left: 355, width: 327 })
    expect(boxes[5]?.width).toBe(682)
  })

  it('mientras el texto no ha llegado no coloca nada', async () => {
    render(<Harness content={[p('Uno'), p('Dos')]} settings={SHEET} ready={false} />)
    await waitFor(() => expect(frame()).not.toBeNull())
    expect(frame()?.hasAttribute('data-placed')).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(placed()).toEqual(['', ''])
  })

  it('al escribir se vuelve a colocar, y el desplazamiento al cursor espera a que esté colocado', async () => {
    render(<Harness content={[p('Uno'), p('Dos')]} settings={SHEET} />)
    await waitFor(() =>
      expect(
        placed()
          .map(at)
          .map((box) => box.top)
      ).toEqual([0, 400])
    )
    const editor = current as unknown as Editor
    // Con el cursor en el texto (sin él, no hay a qué desplazarse)
    act(() => {
      editor.commands.setTextSelection(3)
      editor.view.dom.focus()
    })
    await waitFor(() => expect(editor.isFocused).toBe(true))
    act(() => {
      editor.chain().insertContentAt(editor.state.doc.content.size, p('Tres')).scrollIntoView().run()
    })
    await waitFor(() =>
      expect(
        placed()
          .map(at)
          .map((box) => box.top)
      ).toEqual([0, 400, 828])
    )
    await waitFor(() => expect(marks()).toEqual(['Página 1']))
  })

  it('al quitar la hoja se deshace lo colocado', async () => {
    const { rerender } = render(<Harness content={[p('Uno'), p('Dos')]} settings={SHEET} />)
    await waitFor(() => expect(placed()[1]).toContain('top:400px'))
    rerender(<Harness content={[p('Uno'), p('Dos')]} settings={null} />)
    await waitFor(() => expect(placed()).toEqual(['', '']))
    const ghost = (current as unknown as Editor).view.dom.querySelector<HTMLElement>(`[${GHOST_LINE}]`)
    expect(ghost?.getAttribute('style')).toBeNull()
  })

  it('las páginas se escalan para caber a lo ancho de su sitio', async () => {
    const callbacks: ResizeObserverCallback[] = []
    const fire = (width: number) => {
      for (const callback of callbacks) callback([{ contentRect: { width } } as ResizeObserverEntry], {} as never)
    }
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback)
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    render(<Harness content={[p('Uno'), p('Dos')]} settings={SHEET} />)
    await waitFor(() => expect(placed()[1]).toContain('top:400px'))
    expect(marks()).toEqual([])
    // La mitad del ancho del texto: todo a la mitad, también el alto de la página (ya no caben dos párrafos)
    act(() => fire(341))
    await waitFor(() => expect(at(placed()[1] ?? '').width).toBe(341))
    expect(at(placed()[1] ?? '').top).toBe(400 + 28 / 2)
    // Las rayas de página las pinta React al recibir lo colocado: pueden llegar un momento después
    await waitFor(() => expect(marks()).toEqual(['Página 1']))
    // Mucho sitio: crece hasta el tope (la letra a 20 px) y lo que sobra queda a los lados (va centrada)
    act(() => fire(2000))
    await waitFor(() => expect(at(placed()[1] ?? '').width).toBe(682 * 1.25))
    vi.unstubAllGlobals()
  })

  it('una nota lateral va con el bloque que la sigue, como al imprimir: si no caben juntos, pasan juntos', async () => {
    const note: JSONContent = { type: 'sidenote', attrs: { side: 'left' }, content: [p('Al margen')] }
    render(<Harness content={[p('Uno'), p('Dos'), note, p('Tres')]} settings={{ ...SHEET, columns: 2 }} />)
    // Dos párrafos (800) llenan casi la primera columna: la nota (20) cabría, pero con «Tres» no; van a la segunda
    await waitFor(() => expect(placed().map(at)[2]?.left).toBeGreaterThan(0))
    const [, , side, after] = placed().map(at)
    expect(side?.top).toBe(0)
    expect(after?.left).toBe(side?.left)
    expect(after?.top).toBe(20)
  })
})

describe('la hoja en lo estrecho', () => {
  let change: (() => void) | null = null
  let matches = true
  beforeEach(() => {
    matches = true
    window.matchMedia = (() =>
      ({
        get matches() {
          return matches
        },
        addEventListener: (_: string, listener: () => void) => {
          change = listener
        },
        removeEventListener() {}
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    return () => {
      Reflect.deleteProperty(window, 'matchMedia')
    }
  })

  it('una columna seguida, sin páginas; al ensancharse, con ellas', async () => {
    render(<Harness content={[p('Uno'), p('Dos')]} settings={SHEET} />)
    await waitFor(() => expect(current).not.toBeNull())
    expect(frame()).toBeNull()
    matches = false
    act(() => change?.())
    await waitFor(() => expect(placed()[1]).toContain('top:400px'))
  })
})
