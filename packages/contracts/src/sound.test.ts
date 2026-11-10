import { describe, expect, it } from 'vitest'
import { youtubeVideoId } from './sound.ts'

describe('el id de un vídeo de YouTube', () => {
  it('sale de sus enlaces y del id solo', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
      'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    ])
      expect(youtubeVideoId(link)).toBe('dQw4w9WgXcQ')
  })

  it('lo demás no vale', () => {
    for (const bad of [
      '',
      'hola',
      'https://vimeo.com/123456',
      'https://evil.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=corto',
      'javascript:alert(1)'
    ])
      expect(youtubeVideoId(bad)).toBeNull()
  })
})
