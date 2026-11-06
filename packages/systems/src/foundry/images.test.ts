import { describe, expect, it } from 'vitest'
import { convertFoundry } from './convert.ts'
import { foundryFixture } from './fixture.ts'
import { imagesOf, licenseOf, zipPathOf } from './images.ts'
import { readManifest } from './manifest.ts'

describe('las imágenes de un sistema de Foundry (docs/specs/imagenes.md)', () => {
  it('el manifiesto dice sus mapas de arte, con su crédito', () => {
    expect(foundryFixture().manifest.artMappings).toEqual([
      { mapping: 'systems/mazmorra/json/arte.json', credit: 'Fichas de Alguien.' }
    ])
    expect(readManifest({ id: 'x', title: 'X' }, 'system').artMappings).toEqual([])
  })

  it('cada entrada lleva su imagen: la de su documento o, en un actor, su retrato del mapa de arte', () => {
    const { file } = convertFoundry(foundryFixture())
    const byName = (name: string) => file.content.find((c) => (c.data.name as { es: string }).es === name)
    expect(byName('Bola de fuego')?.img).toBe('systems/mazmorra/icons/fuego.webp')
    expect(byName('Trasgo')?.img).toBe('systems/mazmorra/tokens/trasgo.webp')
    // Sin imagen, nada
    expect(byName('Daga')?.img).toBeUndefined()
    expect(imagesOf(file, foundryFixture().art)).toEqual([
      { path: 'systems/mazmorra/icons/fuego.webp', credit: null },
      { path: 'systems/mazmorra/tokens/trasgo.webp', credit: 'Fichas de Alguien.' }
    ])
  })

  it('una ruta de Foundry, dentro del zip: sin el prefijo de su paquete, con la carpeta raíz del zip', () => {
    expect(zipPathOf('systems/dnd5e/tokens/a.webp', { id: 'dnd5e', kind: 'system', root: 'dnd5e/' })).toBe(
      'dnd5e/tokens/a.webp'
    )
    expect(zipPathOf('modules/mio/art/b.png', { id: 'mio', kind: 'module', root: '' })).toBe('art/b.png')
    // Lo de serie de Foundry (icons/…) o de otro paquete no viene en el zip
    expect(zipPathOf('icons/svg/mystery-man.svg', { id: 'dnd5e', kind: 'system', root: '' })).toBeNull()
    expect(zipPathOf('modules/otro/x.webp', { id: 'dnd5e', kind: 'system', root: '' })).toBeNull()
  })

  it('la licencia de una imagen: la del aviso más cercano, y si nombra el archivo, la de su línea', () => {
    const notices = {
      'dnd5e/tokens/LICENSE':
        'Forgotten Adventures. These tokens may not be redistributed or used outside of Foundry Virtual Tabletop.',
      'dnd5e/icons/LICENSE':
        'Icons from Game-icons.net under the Creative Commons license.\n/svg/backpack.svg - "Light backpack" by Delapouite under CC BY 3.0\n/svg/statuses/blinded.svg - by mikiko.art under CC BY-NC-SA 4.0',
      'dnd5e/icons/svg/schools/LICENSE':
        'copyright Wizards of the Coast LLC and may not be used for any purpose other than running the dnd5e game system within Foundry Virtual Tabletop.',
      'dnd5e/LICENSE.txt': 'Permission is hereby granted, free of charge, to any person obtaining a copy (MIT)'
    }
    expect(licenseOf('dnd5e/tokens/dragon/Red.webp', notices)).toBe('foundry-only')
    expect(licenseOf('dnd5e/icons/svg/backpack.svg', notices)).toBe('cc-by')
    expect(licenseOf('dnd5e/icons/svg/statuses/blinded.svg', notices)).toBe('cc-by-nc-sa')
    expect(licenseOf('dnd5e/icons/svg/schools/evocation.svg', notices)).toBe('foundry-only')
    expect(licenseOf('dnd5e/ui/logo.webp', notices)).toBe('mit')
    expect(licenseOf('otro/x.webp', {})).toBe('unknown')
  })
})
