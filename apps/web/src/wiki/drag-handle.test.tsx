import { editorExtensions } from '@crisol/editor'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Announcer } from '../components/announcer.tsx'
import '../i18n.ts'
import type { BlockContext } from './blocks.ts'
import { BlockHandle, BlockMenu, type BlockTarget, blockAtCursor } from './drag-handle.tsx'
import { GHOST_LINE, GhostLine } from './ghost-line.ts'

let current: Editor | null = null

function useTestEditor(content: string, editable: boolean) {
  const editor = useEditor({
    extensions: [...editorExtensions(), GhostLine.configure({ className: 'linea' })],
    content,
    editable
  })
  useEffect(() => {
    current = editor
  }, [editor])
  return editor
}

/** El menú del bloque, abierto sobre el bloque que se diga (por su orden) */
function MenuHarness({
  content,
  index,
  context,
  onClose
}: {
  content: string
  index: number
  context: BlockContext
  onClose: (returnFocus?: boolean) => void
}) {
  const editor = useTestEditor(content, true)
  const [open, setOpen] = useState(true)
  let target: BlockTarget | null = null
  if (editor) {
    let pos = 0
    editor.state.doc.forEach((_node, offset, i) => {
      if (i === index) pos = offset
    })
    const node = editor.state.doc.nodeAt(pos)
    if (node) target = { pos, node }
  }
  return (
    <Announcer>
      <EditorContent editor={editor} />
      {editor && target && open && (
        <BlockMenu
          editor={editor}
          target={target}
          anchor={null}
          context={context}
          onClose={(returnFocus) => {
            setOpen(false)
            onClose(returnFocus)
          }}
        />
      )}
    </Announcer>
  )
}

const context = (): BlockContext => ({ makeSeparate: vi.fn(async () => undefined) })

async function openMenu(content: string, index = 0, ctx = context()) {
  const onClose = vi.fn()
  render(<MenuHarness content={content} index={index} context={ctx} onClose={onClose} />)
  const menu = await screen.findByRole('menu', { name: 'Bloque' })
  return { menu, onClose, editor: current as unknown as Editor, ctx }
}

const json = (): JSONContent[] => (current as unknown as Editor).getJSON().content ?? []
const types = () => json().map((node) => node.type)
const texts = () => json().map((node) => (node.content ?? []).map((n) => n.text ?? '').join(''))
const announced = () => screen.getAllByRole('status').map((status) => status.textContent)

afterEach(() => {
  current = null
})

describe('el bloque del cursor', () => {
  it('es el de primer nivel en el que está el cursor, o el elegido entero', async () => {
    render(
      <MenuHarness content="<p>Uno</p><ul><li><p>Dos</p></li></ul>" index={9} context={context()} onClose={vi.fn()} />
    )
    await waitFor(() => expect(current).not.toBeNull())
    const editor = current as unknown as Editor
    act(() => void editor.commands.setTextSelection(10))
    expect(blockAtCursor(editor)?.node.type.name).toBe('bulletList')
    act(() => void editor.commands.setNodeSelection(0))
    expect(blockAtCursor(editor)).toEqual({ pos: 0, node: editor.state.doc.firstChild })
    // Todo elegido: no hay un bloque
    act(() => void editor.commands.selectAll())
    expect(blockAtCursor(editor)).toBeNull()
  })
})

describe('el menú del bloque', () => {
  it('en un bloque con texto: «Convertir en» por grupos y las acciones; el foco, en la primera opción', async () => {
    const { menu } = await openMenu('<p>Uno</p><p>Dos</p>')
    const convert = within(within(menu).getByRole('group', { name: 'Convertir en' }))
    expect(convert.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Texto',
      'Títulos',
      'Listas',
      'Recuadros',
      'Maquetación'
    ])
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Texto'))
    const actions = within(within(menu).getByRole('group', { name: 'Acciones' }))
    // El primero no sube
    expect(actions.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Insertar debajo',
      'Duplicar',
      'Bajar',
      'Borrar'
    ])
  })

  it('convierte el bloque en el elegido de su desplegable, y lo anuncia', async () => {
    const { menu, onClose } = await openMenu('<p>Uno</p><p>Dos</p>', 1)
    const headings = within(menu).getByRole('menuitem', { name: 'Títulos' })
    expect(headings.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(headings)
    expect(headings.getAttribute('aria-expanded')).toBe('true')
    const submenu = within(menu).getByRole('menu', { name: 'Títulos' })
    await userEvent.click(within(submenu).getByRole('menuitem', { name: 'Título 2' }))
    expect(onClose).toHaveBeenCalled()
    expect(types().slice(0, 2)).toEqual(['paragraph', 'heading'])
    expect(json()[1]?.attrs?.level).toBe(2)
    expect(texts()[1]).toBe('Dos')
    await waitFor(() => expect(announced()).toContain('Bloque convertido en título 2.'))
  })

  it('los desplegables se abren con la flecha derecha y se pliegan con la izquierda; pulsar otra vez los pliega', async () => {
    const { menu } = await openMenu('<p>Uno</p>')
    const lists = within(menu).getByRole('menuitem', { name: 'Listas' })
    lists.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(lists.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{ArrowLeft}')
    expect(lists.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(lists)
    expect(within(menu).getByRole('menuitem', { name: 'Casillas' })).toBeDefined()
    await userEvent.click(lists)
    expect(within(menu).queryByRole('menuitem', { name: 'Casillas' })).toBeNull()
  })

  it('un recuadro se convierte en otro cambiando solo su tipo', async () => {
    const { menu } = await openMenu('<div data-callout="note"><p>Ojo</p></div>')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Recuadros' }))
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Aviso' }))
    expect(types()[0]).toBe('callout')
    expect(json()[0]?.attrs?.kind).toBe('warning')
    expect((current as unknown as Editor).state.doc.firstChild?.textContent).toBe('Ojo')
  })

  it('hacerlo secreto pasa por su contexto (crea su documento aparte)', async () => {
    const { menu, ctx, editor } = await openMenu('<p>Uno</p>')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Recuadros' }))
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Secreto' }))
    await waitFor(() => expect(ctx.makeSeparate).toHaveBeenCalledWith(editor, 'secret'))
    // Lo elegido, el texto del bloque
    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(4)
  })

  it('en una línea vacía: «Añadir un bloque» con todos, también tablas y páginas', async () => {
    const { menu } = await openMenu('<p>Uno</p><p></p>', 1)
    const add = within(within(menu).getByRole('group', { name: 'Añadir un bloque' }))
    expect(add.getByRole('menuitem', { name: 'Páginas' })).toBeDefined()
    await userEvent.click(add.getByRole('menuitem', { name: 'Texto' }))
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tabla' }))
    expect(types()).toContain('table')
    await waitFor(() => expect(announced()).toContain('Bloque insertado: tabla.'))
  })

  it('un bloque que no se convierte (una tabla o un separador) solo tiene las acciones', async () => {
    const { menu } = await openMenu('<p>Uno</p><hr><p>Dos</p>', 1)
    expect(within(menu).queryByRole('group', { name: 'Convertir en' })).toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'Subir' })).toBeDefined()
    expect(within(menu).getByRole('menuitem', { name: 'Bajar' })).toBeDefined()
  })

  it('inserta un párrafo vacío debajo con el cursor en él', async () => {
    const { menu, editor } = await openMenu('<p>Uno</p><p>Dos</p>')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Insertar debajo' }))
    expect(texts()).toEqual(['Uno', '', 'Dos'])
    expect(editor.state.selection.$from.parent.content.size).toBe(0)
    expect(editor.state.selection.from).toBe(6)
    await waitFor(() => expect(announced()).toContain('Párrafo nuevo debajo.'))
  })

  it('duplica el bloque justo debajo', async () => {
    const { menu } = await openMenu('<p>Uno</p><p>Dos</p>')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Duplicar' }))
    expect(texts()).toEqual(['Uno', 'Uno', 'Dos'])
    await waitFor(() => expect(announced()).toContain('Bloque duplicado.'))
  })

  it('sube y baja el bloque un puesto', async () => {
    const first = await openMenu('<p>Uno</p><p>Dos</p><p>Tres</p>', 1)
    await userEvent.click(within(first.menu).getByRole('menuitem', { name: 'Subir' }))
    expect(texts().slice(0, 3)).toEqual(['Dos', 'Uno', 'Tres'])
    await waitFor(() => expect(announced()).toContain('Bloque movido.'))
  })

  it('baja el bloque un puesto', async () => {
    const { menu } = await openMenu('<p>Uno</p><p>Dos</p><p>Tres</p>', 1)
    // El último no baja
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Bajar' }))
    expect(texts().slice(0, 3)).toEqual(['Uno', 'Tres', 'Dos'])
  })

  it('el último no baja', async () => {
    const { menu } = await openMenu('<p>Uno</p><p>Dos</p>', 1)
    expect(within(menu).queryByRole('menuitem', { name: 'Bajar' })).toBeNull()
  })

  it('borra el bloque', async () => {
    const { menu } = await openMenu('<p>Uno</p><p>Dos</p>')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Borrar' }))
    expect(texts()[0]).toBe('Dos')
    await waitFor(() => expect(announced()).toContain('Bloque borrado.'))
  })

  it('con las flechas se recorre (dando la vuelta), Inicio y Fin; Escape y Tab lo cierran devolviendo el foco', async () => {
    const { menu, onClose } = await openMenu('<p>Uno</p><p>Dos</p>')
    const items = () => within(menu).getAllByRole('menuitem')
    await waitFor(() => expect(document.activeElement).toBe(items()[0]))
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items()[1])
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(items().at(-1))
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(items()[0])
    await userEvent.keyboard('{End}')
    expect(document.activeElement?.textContent).toBe('Borrar')
    // Otra tecla no hace nada
    await userEvent.keyboard('x')
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('Tab también lo cierra', async () => {
    const { onClose } = await openMenu('<p>Uno</p>')
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'))
    await userEvent.keyboard('{Tab}')
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('un clic fuera lo cierra sin devolver el foco; dentro, no', async () => {
    const { menu, onClose } = await openMenu('<p>Uno</p>')
    fireEvent.pointerDown(within(menu).getByRole('menuitem', { name: 'Duplicar' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.pointerDown(document.body)
    expect(onClose).toHaveBeenCalledWith(undefined)
  })

  it('junto a lo que lo abrió', async () => {
    const anchor = document.createElement('button')
    document.body.append(anchor)
    function Anchored() {
      const editor = useTestEditor('<p>Uno</p>', true)
      const node = editor?.state.doc.firstChild
      return (
        <>
          <EditorContent editor={editor} />
          {editor && node && (
            <BlockMenu
              editor={editor}
              target={{ pos: 0, node }}
              anchor={anchor}
              context={context()}
              onClose={vi.fn()}
            />
          )}
        </>
      )
    }
    render(<Anchored />)
    const menu = await screen.findByRole('menu', { name: 'Bloque' })
    await waitFor(() => expect(menu.style.left).toMatch(/px$/))
    expect(menu.style.top).toMatch(/px$/)
    anchor.remove()
  })
})

/** El asa de los bloques, sobre un editor dentro de su sección */
function HandleHarness({ content, editable = true }: { content: string; editable?: boolean }) {
  const editor = useTestEditor(content, editable)
  return (
    <section>
      <div>
        <EditorContent editor={editor} />
      </div>
      {editor && <BlockHandle editor={editor} context={context()} />}
    </section>
  )
}

const addButton = () => screen.findByRole('button', { name: 'Añadir un bloque' })

describe('los seis puntos de una línea vacía', () => {
  it('en una página vacía están ya: pulsarlos abre el menú «/» en ella', async () => {
    render(<HandleHarness content="" />)
    await userEvent.click(await addButton())
    const editor = current as unknown as Editor
    expect(editor.state.doc.textContent).toBe('/')
    expect(editor.state.doc.childCount).toBe(1)
  })

  it('bajo lo escrito, en la línea de más: al pulsarlos se hace una línea de verdad con «/»', async () => {
    render(<HandleHarness content="<p>Hola</p>" />)
    const editor = current as unknown as Editor
    expect(editor.view.dom.querySelector(`[${GHOST_LINE}]`)).not.toBeNull()
    await userEvent.click(await addButton())
    expect(texts()).toEqual(['Hola', '/'])
  })

  it('en la línea vacía del cursor, con el foco en el texto', async () => {
    render(<HandleHarness content="<p>Hola</p><p></p><p>Adiós</p>" />)
    const editor = current as unknown as Editor
    act(() => {
      editor.commands.setTextSelection(7)
      editor.view.dom.focus()
    })
    await waitFor(() => expect(editor.isFocused).toBe(true))
    await userEvent.click(await addButton())
    expect(texts()).toEqual(['Hola', '/', 'Adiós'])
  })

  it('con el ratón sobre el texto se apartan (sale el asa de siempre), salvo sobre la línea de más', async () => {
    render(<HandleHarness content="<p>Hola</p>" />)
    const button = await addButton()
    const area = (current as unknown as Editor).view.dom.parentElement as HTMLElement
    // Sobre la línea de más (en happy-dom, todo mide 0 y está arriba)
    fireEvent.pointerMove(area, { clientY: 4 })
    expect(await addButton()).toBe(button)
    // En otro sitio del texto
    fireEvent.pointerMove(area, { clientY: 300 })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Añadir un bloque' })).toBeNull())
    fireEvent.pointerLeave(area)
    expect(await addButton()).toBeDefined()
  })

  it('no están en lectura ni mientras el texto aún llega', async () => {
    const { unmount } = render(<HandleHarness content="<p>Hola</p>" editable={false} />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button', { name: 'Añadir un bloque' })).toBeNull()
    unmount()

    render(<HandleHarness content="<p>Hola</p>" />)
    await addButton()
    const section = document.querySelector('section') as HTMLElement
    act(() => section.setAttribute('data-loading', 'true'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Añadir un bloque' })).toBeNull())
    act(() => section.removeAttribute('data-loading'))
    expect(await addButton()).toBeDefined()
    // Al desplazarse o cambiar el tamaño de la ventana se vuelven a colocar
    fireEvent.scroll(window)
    fireEvent(window, new Event('resize'))
    expect(await addButton()).toBeDefined()
  })

  it('sin línea vacía ni línea de más, no están', async () => {
    render(<HandleHarness content="<p>Hola</p><p></p>" />)
    const editor = current as unknown as Editor
    act(() => void editor.commands.focus(3))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button', { name: 'Añadir un bloque' })).toBeNull()
  })
})
