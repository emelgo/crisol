import { describe, expect, it } from 'vitest'
import { markdownWithoutSecrets } from './page.ts'

describe('un texto sin sus secretos ni sus notas ocultas (los capítulos que lee quien no dirige)', () => {
  it('quita los secretos y las notas ocultas y deja lo demás', () => {
    const text =
      '# Capítulo\n\nTexto público.\n\n> [!secreto]\n> El rey es un dragón.\n\n%% nota del máster %%\n\n- uno\n- dos\n'
    expect(markdownWithoutSecrets(text)).toBe('# Capítulo\n\nTexto público.\n\n- uno\n- dos')
  })

  it('también el que va metido dentro de otro bloque', () => {
    const text = '> [!nota] Aviso\n> Dentro\n>\n> > [!secreto]\n> > Escondido\n'
    const clean = markdownWithoutSecrets(text)
    expect(clean).not.toContain('Escondido')
    expect(clean).toContain('Dentro')
  })

  it('un texto sin secretos queda igual (sin el salto del final)', () => {
    expect(markdownWithoutSecrets('Solo texto.\n')).toBe('Solo texto.')
  })
})
