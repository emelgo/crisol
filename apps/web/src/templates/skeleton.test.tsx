import { EXAMPLE_TEMPLATES as BUILT_IN_TEMPLATES } from '@crisol/domain'
import { pageFromMarkdown } from '@crisol/editor/markdown'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { SkeletonEditor, skeletonOf } from './skeleton.tsx'

describe('el texto de una plantilla', () => {
  it('de ida y vuelta sale igual: el de cada plantilla de serie', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(skeletonOf(pageFromMarkdown(template.skeleton).body), template.id).toBe(template.skeleton)
    }
  })

  // Escribir en él, en la e2e (en happy-dom, ProseMirror no recibe bien el teclado)
  it('enseña lo escrito con sus apartados', async () => {
    render(
      <SkeletonEditor skeleton={'## En una frase\n\n## La verdad\n'} readOnly={false} onChange={() => undefined} />
    )
    const box = await screen.findByRole('textbox', { name: 'Texto de la plantilla' })
    expect([...box.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['En una frase', 'La verdad'])
    expect(box.getAttribute('contenteditable')).toBe('true')
  })

  it('el de una de serie se lee, sin poder cambiarlo', async () => {
    render(<SkeletonEditor skeleton={'## Quién es\n'} readOnly onChange={() => undefined} />)
    const box = await screen.findByRole('textbox', { name: 'Texto de la plantilla' })
    expect(box.getAttribute('contenteditable')).toBe('false')
  })
})
