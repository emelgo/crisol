import { beforeEach, describe, expect, it } from 'vitest'
import { chosenMotion, resolveMotion, setMotion } from './motion.ts'

describe('las animaciones', () => {
  beforeEach(() => localStorage.clear())

  it('vienen completas por defecto, aunque el sistema pida menos movimiento', () => {
    expect(chosenMotion()).toBe('full')
    expect(resolveMotion(chosenMotion(), true)).toBe('full')
  })

  it('reducidas, solo fundidos; como el sistema, lo que pida el sistema', () => {
    expect(resolveMotion('reduced', false)).toBe('reduced')
    expect(resolveMotion('system', true)).toBe('reduced')
    expect(resolveMotion('system', false)).toBe('full')
  })

  it('lo elegido se recuerda y se aplica a la página', () => {
    setMotion('reduced')
    expect(chosenMotion()).toBe('reduced')
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})
