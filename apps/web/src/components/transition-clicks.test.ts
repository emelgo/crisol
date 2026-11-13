import { afterEach, describe, expect, it, vi } from 'vitest'
import { installTransitionClicks } from './transition-clicks.ts'

describe('pulsar durante una transición de vista', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('el clic que va a la raíz acaba la transición y llega a lo que hay debajo', async () => {
    let finish: () => void = () => undefined
    const skipTransition = vi.fn(() => finish())
    const fake = {
      skipTransition,
      finished: new Promise<void>((resolve) => {
        finish = resolve
      }),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve()
    }
    Object.defineProperty(document, 'startViewTransition', { configurable: true, writable: true, value: () => fake })
    installTransitionClicks()
    const button = document.createElement('button')
    const pressed = vi.fn()
    button.addEventListener('click', pressed)
    document.body.append(button)
    document.elementFromPoint = vi.fn(() => button)
    document.startViewTransition(() => undefined)
    document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(skipTransition).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(pressed).toHaveBeenCalledOnce())
    expect(document.elementFromPoint).toHaveBeenCalledWith(10, 20)
    // Acabada, otro clic en la raíz no hace nada
    document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(skipTransition).toHaveBeenCalledOnce()
  })
})
