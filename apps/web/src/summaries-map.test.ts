import { describe, expect, it } from 'vitest'
import { i18next } from './i18n.ts'
import { summaryOf } from './summaries.ts'

const t = i18next.t.bind(i18next)
const say = (action: string, details: Record<string, unknown>) => summaryOf(t, { action, details })

describe('las frases del historial: orden, pestañas, mapas y etiquetas', () => {
  it('ordenar las subpáginas de una página o las del primer nivel', () => {
    expect(say('sortPageChildren', { title: 'Lugares' })).toBe('ordenó las subpáginas de «Lugares»')
    expect(say('sortPageChildren', { title: null })).toBe('ordenó las páginas del primer nivel')
  })

  it('las pestañas de una página', () => {
    expect(say('createPageTab', { name: 'Costa', title: 'Puerto Ceniza' })).toBe(
      'añadió el mapa «Costa» a «Puerto Ceniza»'
    )
    expect(say('deletePageTab', { name: 'Costa', page: 'Puerto Ceniza' })).toBe(
      'quitó la pestaña «Costa» de «Puerto Ceniza»'
    )
    expect(say('updatePageTab', { from: 'Costa', to: 'Litoral', title: 'Puerto Ceniza' })).toBe(
      'renombró la pestaña «Costa» de «Puerto Ceniza» a «Litoral»'
    )
    expect(say('updatePageTab', { name: 'Costa', title: 'Puerto Ceniza', color: 'sea' })).toBe(
      'cambió la pestaña «Costa» de «Puerto Ceniza»'
    )
  })

  it('el mapa: su imagen o su escala', () => {
    expect(say('updateMap', { name: 'Costa', title: 'Puerto Ceniza', image: 'x' })).toBe(
      'puso la imagen del mapa «Costa» de «Puerto Ceniza»'
    )
    expect(say('updateMap', { name: 'Costa', title: 'Puerto Ceniza', scale: 2 })).toBe(
      'cambió la escala del mapa «Costa» de «Puerto Ceniza»'
    )
  })

  it('los pines: ponerlos, cambiarlos, moverlos y quitarlos; sin nombre, «Pin sin nombre»', () => {
    expect(say('createMapPin', { label: 'El faro', map: 'Costa', title: 'Puerto Ceniza' })).toBe(
      'puso el pin «El faro» en el mapa «Costa» de «Puerto Ceniza»'
    )
    expect(say('updateMapPin', { pin: 'El faro', map: 'Costa' })).toBe('cambió el pin «El faro» del mapa «Costa»')
    expect(say('updateMapPin', { pin: 'El faro', map: 'Costa', moved: true })).toBe(
      'movió el pin «El faro» del mapa «Costa»'
    )
    expect(say('deleteMapPin', { pin: '', map: 'Costa' })).toBe('quitó el pin «Pin sin nombre» del mapa «Costa»')
  })

  it('las etiquetas de la cuenta', () => {
    expect(say('colorTag', { tag: 'lugar' })).toBe('cambió el color de la etiqueta «lugar»')
    expect(say('setFileTags', { name: 'faro.png' })).toBe('cambió las etiquetas de «faro.png»')
    expect(say('updateTag', { tag: 'lugar', name: 'sitio' })).toContain('«sitio»')
  })
})

describe('las frases del historial: los sistemas y el de una campaña', () => {
  it('crear, cambiar, subir y borrar un sistema', () => {
    expect(say('createSystem', { name: 'Fronteras' })).toBe('creó el sistema «Fronteras»')
    expect(say('updateSystem', { name: 'Fronteras' })).toBe('cambió el sistema «Fronteras»')
    expect(say('importSystem', { name: 'Fronteras' })).toBe('subió el sistema «Fronteras»')
    expect(say('deleteSystem', { name: 'Fronteras' })).toBe('borró el sistema «Fronteras»')
  })

  it('elegir el sistema de una campaña, quitarlo o cambiar lo que elige de él', () => {
    expect(say('updateCampaign', { name: 'La Marca', system: 'Fronteras' })).toBe(
      'eligió el sistema «Fronteras» para la campaña «La Marca»'
    )
    expect(say('updateCampaign', { name: 'La Marca', system: null })).toBe('quitó el sistema de la campaña «La Marca»')
    expect(say('updateCampaign', { name: 'La Marca', systemChoices: true })).toBe(
      'cambió lo que elige la campaña «La Marca» de su sistema'
    )
  })
})

describe('las frases del historial: personajes', () => {
  it('crearlo, cambiarlo (nombre, dueño, terminarlo, confirmar un nivel), borrarlo y volver a una versión', () => {
    expect(say('createCharacter', { name: 'Thora', campaign: 'La Marca' })).toBe(
      'creó el personaje «Thora» en «La Marca»'
    )
    expect(say('updateCharacter', { name: 'Thora' })).toBe('cambió el personaje «Thora»')
    expect(say('updateCharacter', { name: 'Thora P.', from: 'Thora' })).toBe(
      'renombró el personaje «Thora» a «Thora P.»'
    )
    expect(say('updateCharacter', { name: 'Thora', owner: true })).toBe('cambió quién juega el personaje «Thora»')
    expect(say('updateCharacter', { name: 'Thora', confirm: 'created' })).toBe('terminó de crear el personaje «Thora»')
    expect(say('updateCharacter', { name: 'Thora', confirm: 'level' })).toBe('confirmó el nivel del personaje «Thora»')
    expect(say('deleteCharacter', { name: 'Thora' })).toBe('borró el personaje «Thora»')
    expect(say('restoreCharacterVersion', { name: 'Thora' })).toBe('volvió el personaje «Thora» a una versión anterior')
  })
})
