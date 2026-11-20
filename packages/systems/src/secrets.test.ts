import { describe, expect, it } from 'vitest'
import { dataWithoutSecrets, withoutSecretBlocks } from './secrets.ts'

describe('los secretos del texto de una entrada (ADR-0033)', () => {
  it('se quita el bloque > [!secreto] entero y nada más', () => {
    const text =
      'Un dragón.\n\n> [!secreto]\n> Es la reina disfrazada.\n> Huye al caer la mitad.\n\n> [!nota] Ojo\n> Esto sí.\n\nFin.'
    expect(withoutSecretBlocks(text)).toBe('Un dragón.\n\n> [!nota] Ojo\n> Esto sí.\n\nFin.')
    expect(withoutSecretBlocks('Sin nada.')).toBe('Sin nada.')
  })

  it('en cada texto de sus datos y en cada idioma; lo demás, igual', () => {
    expect(
      dataWithoutSecrets({
        name: { es: 'Dragón', en: 'Dragon' },
        description: { es: 'A.\n\n> [!secreto]\n> B.', en: 'A.\n\n> [!secreto]\n> B.' },
        cr: 5,
        idiomas: ['Común']
      })
    ).toEqual({
      name: { es: 'Dragón', en: 'Dragon' },
      description: { es: 'A.\n', en: 'A.\n' },
      cr: 5,
      idiomas: ['Común']
    })
  })
})
