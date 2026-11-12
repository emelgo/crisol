import { describe, expect, it } from 'vitest'
import { inviteSecret } from './home.tsx'

describe('el código de una invitación', () => {
  it('sale de su enlace, entero o sin el dominio', () => {
    expect(inviteSecret('https://crisol.example/unirse/AbC123xyz_-9')).toBe('AbC123xyz_-9')
    expect(inviteSecret('  /unirse/AbC123xyz?x=1 ')).toBe('AbC123xyz')
  })

  it('o es el código solo', () => {
    expect(inviteSecret('AbC123xyz')).toBe('AbC123xyz')
  })

  it('lo que no lo parece, nada', () => {
    expect(inviteSecret('')).toBeNull()
    expect(inviteSecret('hola')).toBeNull()
    expect(inviteSecret('https://otra.web/pagina con espacios')).toBeNull()
  })
})
