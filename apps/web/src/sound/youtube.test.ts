import { describe, expect, it } from 'vitest'
import { youtubeError, youtubeStep } from './youtube.tsx'

const base = { expected: 30, current: 30, playing: true, paused: false, duration: 300, loop: false }

describe('YouTube a la vez que los demás', () => {
  it('corrige solo si se desvía más de 1,5 s', () => {
    expect(youtubeStep({ ...base, current: 31.2 })).toEqual({ seek: null, play: false, pause: false })
    expect(youtubeStep({ ...base, current: 32 })).toEqual({ seek: 30, play: false, pause: false })
  })

  it('arranca lo parado, para en pausa y al acabar', () => {
    expect(youtubeStep({ ...base, playing: false })).toMatchObject({ play: true })
    expect(youtubeStep({ ...base, paused: true })).toMatchObject({ play: false, pause: true })
    expect(youtubeStep({ ...base, expected: null })).toMatchObject({ seek: null, pause: true })
  })

  it('los vídeos que no dejan insertarse se distinguen de los que no existen', () => {
    expect(youtubeError(101)).toBe('embed')
    expect(youtubeError(150)).toBe('embed')
    expect(youtubeError(100)).toBe('missing')
  })
})
