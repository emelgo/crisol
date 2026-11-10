import { describe, expect, it } from 'vitest'
import { parseCommand } from './strip.tsx'

const people = [
  { id: 'master', name: 'Máster' },
  { id: 'ana', name: 'Ana López' }
]

describe('los atajos del registro', () => {
  it('sin barra, lo que se escribe', () => {
    expect(parseCommand('  hola  ', people)).toEqual({ kind: 'say', text: 'hola' })
  })
  it('/s susurra a quien se nombre (por su primer nombre, sin mayúsculas)', () => {
    expect(parseCommand('/s ana no te fíes', people)).toEqual({ kind: 'say', text: 'no te fíes', whisper: ['ana'] })
    expect(parseCommand('/s máster robo la bolsa', people)).toMatchObject({ whisper: ['master'] })
    expect(parseCommand('/s nadie hola', people)).toEqual({ kind: 'error', code: 'noRecipient' })
  })
  it('/t tira, /yo es una acción y /ooc, fuera de personaje', () => {
    expect(parseCommand('/t 1d20+5 # Sigilo', people)).toEqual({ kind: 'roll', formula: '1d20+5 # Sigilo' })
    expect(parseCommand('/yo se esconde', people)).toEqual({ kind: 'say', text: 'se esconde', style: 'emote' })
    expect(parseCommand('/ooc ¿pedimos pizza?', people)).toEqual({ kind: 'say', text: '¿pedimos pizza?', style: 'ooc' })
  })
})
