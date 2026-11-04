import { describe, expect, it } from 'vitest'
import { deriveSealKey, hashSecret, newSecret, openSecret, sealSecret } from './secrets.ts'

const key = deriveSealKey('un-secreto-del-servidor-de-32-caracteres')

describe('secretos de enlaces', () => {
  it('son de 256 bits, distintos cada vez y en base64url', () => {
    const a = newSecret()
    expect(a).toMatch(/^[\w-]{43}$/)
    expect(newSecret()).not.toBe(a)
  })

  it('el hash es estable y no contiene el secreto', () => {
    const secret = newSecret()
    expect(hashSecret(secret)).toBe(hashSecret(secret))
    expect(hashSecret(secret)).not.toContain(secret)
  })

  it('cifrar y descifrar devuelve el mismo secreto, y el cifrado no lo contiene', () => {
    const secret = newSecret()
    const sealed = sealSecret(secret, key)
    expect(sealed).not.toContain(secret)
    expect(openSecret(sealed, key)).toBe(secret)
  })

  it('cada cifrado es distinto aunque el secreto sea el mismo', () => {
    const secret = newSecret()
    expect(sealSecret(secret, key)).not.toBe(sealSecret(secret, key))
  })

  it('con otra clave no se descifra', () => {
    const sealed = sealSecret(newSecret(), key)
    expect(() => openSecret(sealed, deriveSealKey('otro-secreto-del-servidor-de-32-car'))).toThrow()
  })

  it('un cifrado alterado no se descifra', () => {
    const sealed = sealSecret(newSecret(), key)
    // Cambia de verdad el penúltimo carácter (el último solo lleva parte de un byte en base64)
    const tampered = `${sealed.slice(0, -2)}${sealed.at(-2) === 'A' ? 'B' : 'A'}${sealed.slice(-1)}`
    expect(() => openSecret(tampered, key)).toThrow()
  })

  it('una etiqueta recortada no se descifra', () => {
    const [version, iv, tag = '', encrypted] = sealSecret('hola', key).split('.')
    const short = Buffer.from(tag, 'base64url').subarray(0, 12).toString('base64url')
    expect(() => openSecret([version, iv, short, encrypted].join('.'), key)).toThrow()
  })

  it('un formato desconocido no se descifra', () => {
    expect(() => openSecret('v9.loquesea', key)).toThrow('Formato')
  })
})
