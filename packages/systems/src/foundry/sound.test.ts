/** El sonido de Foundry a Crisol: listas y sonidos de escena escritos a mano con la forma de cada versión */
import { describe, expect, it } from 'vitest'
import { convertFoundryScene } from './scene.ts'
import { audioSourceOf, convertFoundryPlaylist } from './sound.ts'

const MODULE = { id: 'cripta', kind: 'module' as const, root: 'cripta/' }

describe('las listas de sonido de Foundry', () => {
  it('una de música, secuencial, con sus pistas en su orden, volumen, repetir y fundido en segundos', () => {
    const list = convertFoundryPlaylist({
      _id: 'lista00000000001',
      name: 'Cripta',
      description: '<p>Para la cripta</p>',
      mode: 0,
      channel: 'music',
      fade: 2000,
      sorting: 'm',
      sounds: [
        { _id: 's2', name: 'Eco', path: 'modules/cripta/audio/eco.ogg', volume: 0.5, repeat: false, sort: 200 },
        { _id: 's1', name: 'Goteo', path: 'modules/cripta/audio/goteo.ogg', volume: 0.8, repeat: true, sort: 100 }
      ]
    })
    expect(list).toEqual({
      id: 'lista00000000001',
      name: 'Cripta',
      kind: 'ambient',
      mode: 'sequential',
      fade: 2,
      tracks: [
        { id: 's1', name: 'Goteo', path: 'modules/cripta/audio/goteo.ogg', volume: 0.8, loop: true },
        { id: 's2', name: 'Eco', path: 'modules/cripta/audio/eco.ogg', volume: 0.5, loop: false }
      ]
    })
  })

  it('los modos y las clases: aleatoria, simultánea, botonera (a efectos) e interfaz (a efectos)', () => {
    const of = (doc: Record<string, unknown>) => convertFoundryPlaylist({ _id: 'x', name: 'L', sounds: [], ...doc })
    expect(of({ mode: 1, channel: 'environment' })).toMatchObject({ mode: 'random', kind: 'ambient' })
    expect(of({ mode: 2 })).toMatchObject({ mode: 'simultaneous', kind: 'ambient' })
    expect(of({ mode: -1, channel: 'music' })).toMatchObject({ mode: 'soundboard', kind: 'effects' })
    expect(of({ mode: 0, channel: 'interface' })).toMatchObject({ mode: 'sequential', kind: 'effects' })
    // Orden alfabético; sin nombre, el de su archivo
    const sorted = of({
      sorting: 'a',
      sounds: [
        { _id: 'b', name: 'Zeta', path: 'z.ogg' },
        { _id: 'a', path: 'modules/cripta/audio/alba-de-sangre.mp3' }
      ]
    })
    expect(sorted.tracks.map((t) => t.name)).toEqual(['alba-de-sangre', 'Zeta'])
    expect(sorted.tracks[0]).toMatchObject({ volume: 0.5, loop: false })
  })

  it('de dónde sale cada pista: del zip, YouTube, una dirección, de serie de Foundry o de fuera', () => {
    expect(audioSourceOf('modules/cripta/audio/eco.ogg', MODULE)).toEqual({
      kind: 'zip',
      path: 'modules/cripta/audio/eco.ogg',
      zipPath: 'cripta/audio/eco.ogg'
    })
    expect(audioSourceOf('https://www.youtube.com/watch?v=abcdefghijk', MODULE)).toEqual({
      kind: 'youtube',
      videoId: 'abcdefghijk'
    })
    expect(audioSourceOf('https://example.com/lluvia.mp3', MODULE)).toEqual({
      kind: 'url',
      url: 'https://example.com/lluvia.mp3'
    })
    expect(audioSourceOf('sounds/drums.wav', MODULE)).toEqual({ kind: 'missing', reason: 'core' })
    expect(audioSourceOf('worlds/otro/audio/a.ogg', MODULE)).toEqual({ kind: 'missing', reason: 'outside' })
    expect(audioSourceOf('', MODULE)).toEqual({ kind: 'missing', reason: 'empty' })
  })
})

describe('los sonidos de una escena de Foundry', () => {
  it('pasan a sonidos de escena: radio en casillas, suavizado, muros que frenan o amortiguan y oscuridad', () => {
    const [scene] = convertFoundryScene({
      _id: 'escena0000000001',
      name: 'Cascada',
      width: 1000,
      height: 800,
      padding: 0,
      grid: { type: 1, size: 100, distance: 5 },
      playlist: 'lista00000000001',
      playlistSound: null,
      sounds: [
        {
          _id: 'son1',
          x: 300,
          y: 200,
          radius: 30,
          path: 'modules/cripta/audio/cascada.ogg',
          volume: 0.7,
          walls: true,
          easing: true,
          darkness: { min: 0, max: 1 }
        },
        {
          _id: 'son2',
          x: 500,
          y: 500,
          radius: 10,
          path: 'sounds/grillos.ogg',
          walls: false,
          easing: false,
          darkness: { min: 0.6, max: 1 }
        },
        { _id: 'son3', x: 1, y: 1, radius: 10, path: 'a.ogg', hidden: true }
      ]
    })
    expect(scene?.sounds).toEqual([
      {
        id: 'son1',
        x: 300,
        y: 200,
        radius: 6,
        path: 'modules/cripta/audio/cascada.ogg',
        volume: 0.7,
        easing: true,
        walls: 'block',
        darkOnly: false
      },
      {
        id: 'son2',
        x: 500,
        y: 500,
        radius: 2,
        path: 'sounds/grillos.ogg',
        volume: 0.5,
        easing: false,
        walls: 'muffle',
        darkOnly: true
      }
    ])
    expect(scene?.playlist).toEqual({ playlistId: 'lista00000000001', soundId: null })
    // El apagado no se trae: se cuenta
    expect(scene?.skipped.sounds).toBe(1)
  })
})
