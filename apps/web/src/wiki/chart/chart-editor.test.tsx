import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JSONContent } from '@tiptap/core'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import '../../i18n.ts'
import { ContentView } from '../content.tsx'
import { ChartEditor } from './chart-editor.tsx'

const YAML = `type: bar
title: Poder de las casas
labels: [Altamar, Varn]
series:
  - title: "1240"
    data: [70, 55]`

const TABLE: JSONContent = {
  type: 'table',
  attrs: { id: 'tropas' },
  content: [
    {
      type: 'tableRow',
      content: ['Casa', 'Infantería'].map((text) => ({
        type: 'tableHeader',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      }))
    },
    {
      type: 'tableRow',
      content: ['Altamar', '300'].map((text) => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      }))
    }
  ]
}

/** El editor con su YAML en estado, como lo tendría el bloque */
function Harness({ initial, doc, onYaml }: { initial: string; doc: JSONContent; onYaml: (yaml: string) => void }) {
  const [yaml, setYaml] = useState(initial)
  return (
    <ChartEditor
      editing={{
        key: 'g1',
        yaml,
        doc,
        update: (next) => {
          setYaml(next)
          onYaml(next)
        },
        close: () => undefined
      }}
    />
  )
}

const doc: JSONContent = { type: 'doc', content: [TABLE] }

describe('el editor visual de un gráfico (módulo 10)', () => {
  it('el tipo, la leyenda y un valor cambian su YAML, que conserva lo demás', async () => {
    const onYaml = vi.fn()
    render(<Harness initial={YAML} doc={doc} onYaml={onYaml} />)
    const editor = within(screen.getByRole('region', { name: 'Gráfico' }))
    await userEvent.click(editor.getByRole('button', { name: 'Tarta' }))
    expect(onYaml).toHaveBeenLastCalledWith(expect.stringContaining('type: pie'))
    expect(onYaml.mock.lastCall?.[0]).toContain('title: Poder de las casas')
    await userEvent.click(editor.getByRole('button', { name: 'Sin' }))
    expect(onYaml.mock.lastCall?.[0]).toContain('legend: false')
    const cell = editor.getByRole('textbox', { name: '1240, Varn' })
    await userEvent.clear(cell)
    await userEvent.type(cell, '60{Enter}')
    expect(onYaml.mock.lastCall?.[0]).toContain('data: [70, 60]')
  })

  it('una fila y una serie más; «Ver YAML» lo enseña y se puede escribir', async () => {
    const onYaml = vi.fn()
    render(<Harness initial={YAML} doc={doc} onYaml={onYaml} />)
    const editor = within(screen.getByRole('region', { name: 'Gráfico' }))
    await userEvent.click(editor.getByRole('button', { name: 'Fila' }))
    await userEvent.click(editor.getByRole('button', { name: 'Serie' }))
    expect(onYaml.mock.lastCall?.[0]).toContain('labels: [Altamar, Varn, Etiqueta 3]')
    expect(onYaml.mock.lastCall?.[0]).toContain('title: Serie 2')
    await userEvent.click(editor.getByRole('button', { name: 'Ver YAML' }))
    expect((editor.getByRole('textbox', { name: 'YAML del gráfico' }) as HTMLTextAreaElement).value).toContain(
      'Serie 2'
    )
  })

  it('de una tabla de la página: su id', async () => {
    const onYaml = vi.fn()
    render(<Harness initial={YAML} doc={doc} onYaml={onYaml} />)
    const editor = within(screen.getByRole('region', { name: 'Gráfico' }))
    await userEvent.click(editor.getByRole('button', { name: 'De una tabla' }))
    expect(onYaml.mock.lastCall?.[0]).toContain('id: tropas')
    expect(editor.getByRole('combobox', { name: 'Tabla' })).toBeDefined()
  })

  it('un YAML que no se lee: el editor enseña el YAML para arreglarlo', () => {
    render(<Harness initial="type: [" doc={doc} onYaml={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'YAML del gráfico' })).toBeDefined()
  })
})

describe('un gráfico en lo que se lee', () => {
  it('con un YAML que falla, el aviso con lo que falla', () => {
    render(<ContentView worldId="w" blocks={[{ type: 'chart', attrs: { yaml: 'type: tarta' } }]} />)
    expect(screen.getByRole('note', { name: 'El gráfico no se puede pintar' }).textContent).toContain(
      '«tarta» no es un tipo de gráfico'
    )
  })

  it('con datos de una tabla del documento: la tabla oculta para el lector de pantalla', async () => {
    render(<ContentView worldId="w" blocks={[TABLE, { type: 'chart', attrs: { yaml: 'type: bar\nid: tropas' } }]} />)
    const table = await screen.findByRole('table', { name: 'Los datos del gráfico' })
    // Por columnas: la primera da las etiquetas y cada otra es una serie
    await waitFor(() => expect(within(table).getByRole('rowheader', { name: 'Altamar' })).toBeDefined())
    expect(within(table).getByRole('columnheader', { name: 'Infantería' })).toBeDefined()
  })
})
