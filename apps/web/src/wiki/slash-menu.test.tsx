import { editorExtensions } from '@crisol/editor'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { i18next } from '../i18n.ts'
import type { BlockChoice } from './blocks.ts'
import { SlashMenu, type SlashMenuOptions } from './slash-menu.tsx'

const t = i18next.t.bind(i18next)

function Harness({
  options,
  onEditor
}: {
  options: Partial<SlashMenuOptions> | null
  onEditor: (editor: Editor) => void
}) {
  const editor = useEditor({
    extensions: [
      ...editorExtensions(),
      // Sin opciones, las de serie (filtra por la clave del bloque)
      options
        ? SlashMenu.configure({ name: (block: BlockChoice) => t(`blocks.${block.label}`), ...options })
        : SlashMenu
    ],
    content: '<p></p>'
  })
  useEffect(() => {
    if (editor) onEditor(editor)
  }, [editor, onEditor])
  return <EditorContent editor={editor} />
}

async function mount(options: Partial<SlashMenuOptions> | null = {}, content?: string) {
  let editor: Editor | null = null
  render(<Harness options={options} onEditor={(e) => (editor = e)} />)
  await waitFor(() => expect(editor).not.toBeNull())
  const e = editor as unknown as Editor
  if (content) act(() => void e.commands.setContent(content))
  return e
}

/** Escribe al final del texto, como si se tecleara */
const type = (editor: Editor, text: string) =>
  act(() => {
    editor.chain().focus('end').insertContent(text).run()
  })

/** Una tecla, como la recibe el texto (el menú es su lista de sugerencias) */
const key = (editor: Editor, name: string) => {
  let handled = false
  act(() => {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
    handled = editor.view.someProp('handleKeyDown', (handle) => handle(editor.view, event)) ?? false
  })
  return handled
}

const menu = () => screen.findByRole('listbox', { name: 'Bloques' })
const selected = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')

describe('el menú «/»', () => {
  it('sale al escribir «/», con los grupos plegados, y el texto apunta a su opción activa', async () => {
    const editor = await mount()
    type(editor, '/')
    const list = within(await menu())
    const names = list.getAllByRole('option').map((option) => option.textContent)
    expect(names).toEqual(['Texto', 'Títulos', 'Listas', 'Páginas', 'Recuadros'])
    // Sin hoja, sin «Maquetación»
    expect(names).not.toContain('Maquetación')
    const dom = editor.view.dom
    expect(dom.getAttribute('aria-autocomplete')).toBe('list')
    expect(dom.getAttribute('aria-controls')).toBe((await menu()).id)
    expect(dom.getAttribute('aria-activedescendant')).toBe(selected()?.id)
    // Sin textos de ayuda fijos (docs/diseno.md): los nombres bastan
    expect(screen.queryByText(/para moverte/)).toBeNull()
  })

  it('sin opciones, filtra por la clave de cada bloque', async () => {
    const editor = await mount(null)
    type(editor, '/heading3')
    const list = within(await menu())
    await waitFor(() => expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual(['Título 3']))
  })

  it('con la hoja puesta, también sus bloques', async () => {
    const editor = await mount({ sheet: () => true })
    type(editor, '/')
    expect(within(await menu()).getByRole('option', { name: 'Maquetación' })).toBeDefined()
  })

  it('las flechas recorren los grupos; a la derecha se abre y a la izquierda se pliega', async () => {
    const editor = await mount()
    type(editor, '/')
    await menu()
    expect(selected()?.textContent).toBe('Texto')
    expect(key(editor, 'ArrowDown')).toBe(true)
    expect(selected()?.textContent).toBe('Títulos')
    // Arriba desde el primero da la vuelta
    key(editor, 'ArrowUp')
    key(editor, 'ArrowUp')
    expect(selected()?.textContent).toBe('Recuadros')
    key(editor, 'ArrowDown')
    key(editor, 'ArrowDown')
    // Abrir «Títulos»: la activa, su primer bloque
    expect(key(editor, 'ArrowRight')).toBe(true)
    expect(selected()?.textContent).toBe('Título 1')
    expect(screen.getByRole('option', { name: 'Título 6' })).toBeDefined()
    // A la derecha sobre un bloque no hace nada
    expect(key(editor, 'ArrowRight')).toBe(false)
    expect(key(editor, 'ArrowLeft')).toBe(true)
    expect(screen.queryByRole('option', { name: 'Título 1' })).toBeNull()
    expect(selected()?.textContent).toBe('Títulos')
    // Otra tecla no es suya
    expect(key(editor, 'a')).toBe(false)
  })

  it('Intro sobre un grupo lo despliega y sobre un bloque lo pone, quitando lo escrito, y lo anuncia', async () => {
    const announce = vi.fn()
    const editor = await mount({ announce })
    type(editor, '/')
    await menu()
    key(editor, 'ArrowDown')
    expect(key(editor, 'Enter')).toBe(true)
    expect(selected()?.textContent).toBe('Título 1')
    key(editor, 'ArrowDown')
    expect(key(editor, 'Tab')).toBe(true)
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(editor.state.doc.firstChild?.type.name).toBe('heading')
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
    expect(editor.state.doc.textContent).toBe('')
    await waitFor(() => expect(announce).toHaveBeenCalledWith(expect.objectContaining({ id: 'heading2' })))
    // Cerrado, el texto ya no apunta a la lista
    expect(editor.view.dom.hasAttribute('aria-controls')).toBe(false)
    expect(editor.view.dom.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('lo escrito detrás filtra, sin grupos; el ratón elige y pulsar lo pone', async () => {
    const editor = await mount()
    type(editor, '/cita')
    const list = within(await menu())
    await waitFor(() => expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cita']))
    const option = list.getByRole('option', { name: 'Cita' })
    fireEvent.mouseEnter(option)
    expect(option.getAttribute('aria-selected')).toBe('true')
    fireEvent.mouseDown(option)
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(editor.state.doc.firstChild?.type.name).toBe('blockquote')
  })

  it('al pulsar un grupo con el ratón se abre, y otra vez se pliega', async () => {
    const editor = await mount()
    type(editor, '/')
    const group = within(await menu()).getByRole('option', { name: 'Listas' })
    fireEvent.mouseDown(group)
    expect(group.getAttribute('data-open')).toBe('true')
    expect(screen.getByRole('option', { name: 'Casillas' })).toBeDefined()
    fireEvent.mouseDown(group)
    expect(screen.queryByRole('option', { name: 'Casillas' })).toBeNull()
  })

  it('si nada encaja, lo dice y las teclas siguen siendo del texto', async () => {
    const editor = await mount()
    type(editor, '/zzzz')
    expect(await screen.findByText('Ningún bloque se llama así.')).toBeDefined()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(editor.view.dom.hasAttribute('aria-activedescendant')).toBe(false)
    // Intro no pone nada: lo escrito sigue ahí
    key(editor, 'Enter')
    expect(editor.state.doc.textContent).toContain('/zzzz')
  })

  it('dentro de un secreto no salen los bloques del máster', async () => {
    const editor = await mount({ nested: true })
    type(editor, '/secreto')
    await menu()
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Secreto' })).toBeNull())
    expect(screen.getByText('Ningún bloque se llama así.')).toBeDefined()
  })

  it('ni dentro del código', async () => {
    const editor = await mount({}, '<pre><code>a</code></pre>')
    act(() => {
      editor.chain().focus().setTextSelection(2).insertContent(' /').run()
    })
    expect(editor.state.doc.firstChild?.textContent).toBe('a /')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('un bloque que hace falta crear aparte usa su contexto y lo anuncia al acabar', async () => {
    const announce = vi.fn()
    const makeSeparate = vi.fn(async () => undefined)
    const editor = await mount({ announce, context: { makeSeparate } })
    type(editor, '/secreto')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain('Secreto'))
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Secreto' }))
    await waitFor(() => expect(makeSeparate).toHaveBeenCalledWith(editor, 'secret'))
    await waitFor(() => expect(announce).toHaveBeenCalledWith(expect.objectContaining({ id: 'secret' })))
  })

  it('sin contexto, el bloque aparte no hace nada pero se anuncia', async () => {
    const announce = vi.fn()
    const editor = await mount({ announce })
    type(editor, '/oculta')
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain('Nota oculta'))
    key(editor, 'Enter')
    await waitFor(() => expect(announce).toHaveBeenCalledWith(expect.objectContaining({ id: 'note' })))
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
  })
})
