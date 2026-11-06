import { describe, expect, it } from 'vitest'
import { cleanPath, FoundryError, flattenLang, packOrder, readManifest } from './manifest.ts'

describe('el manifiesto de Foundry', () => {
  it('el de ahora: id, paquetes con su ruta, carpetas, campos de HTML e idiomas', () => {
    const manifest = readManifest(
      {
        id: 'juego',
        title: 'Juego',
        version: '1.2',
        packs: [
          { name: 'objetos', label: 'Objetos', type: 'Item', path: './packs/objetos/', flags: { juego: { x: 1 } } },
          { name: 'sin-tipo', label: 'Nada' },
          { name: 'reglas', type: 'JournalEntry' }
        ],
        packFolders: [{ name: 'Todo', packs: ['reglas'], folders: [{ name: 'Dentro', packs: ['objetos'] }] }],
        documentTypes: { Item: { spell: { htmlFields: ['description.value', 3] } }, Actor: 'no' },
        languages: [{ lang: 'es', path: 'lang/es.json' }, { lang: 'en' }]
      },
      'system'
    )
    expect(manifest).toMatchObject({
      kind: 'system',
      id: 'juego',
      title: 'Juego',
      version: '1.2',
      system: null,
      packs: [
        { name: 'objetos', label: 'Objetos', type: 'Item', path: 'packs/objetos', flags: { juego: { x: 1 } } },
        { name: 'reglas', label: 'reglas', type: 'JournalEntry', path: 'packs/reglas' }
      ],
      htmlFields: { Item: { spell: ['description.value'] } },
      languages: [{ lang: 'es', path: 'lang/es.json' }]
    })
    expect(packOrder(manifest)).toEqual(['reglas', 'objetos'])
  })

  it('el de antes (v9): name en vez de id, entity en vez de type, .db; y el sistema de un módulo', () => {
    const old = readManifest(
      { name: 'viejo', version: 3, packs: [{ name: 'p', entity: 'Actor', path: 'packs/p.db' }], system: ['dnd5e'] },
      'module'
    )
    expect(old).toMatchObject({ id: 'viejo', title: 'viejo', version: '3', system: 'dnd5e' })
    expect(old.packs[0]).toMatchObject({ type: 'Actor', path: 'packs/p.db' })
    expect(readManifest({ id: 'm', relationships: { systems: [{ id: 'pf2e' }] } }, 'module').system).toBe('pf2e')
    expect(readManifest({ id: 'm', systems: ['swade'] }, 'module').system).toBe('swade')
    expect(readManifest({ id: 'm', system: 'wfrp4e' }, 'module').system).toBe('wfrp4e')
  })

  it('sin id o sin objeto, un error', () => {
    expect(() => readManifest({ title: 'x' }, 'system')).toThrow(FoundryError)
    expect(() => readManifest([], 'system')).toThrow('El manifiesto no es un objeto')
  })

  it('las rutas, sin ./ delante ni / detrás', () => {
    expect(cleanPath('.\\packs\\a\\')).toBe('packs/a')
    expect(cleanPath('/packs/a.db')).toBe('packs/a.db')
  })
})

describe('los textos de un idioma, aplanados', () => {
  it('anidados, con puntos en la clave o mezclados', () => {
    expect(
      flattenLang({
        TYPES: { Item: { weapon: 'Weapon' } },
        'TYPES.Actor': { npc: 'NPC' },
        'ITEM.TypeSpell': 'Spell',
        n: 3
      })
    ).toEqual({ 'TYPES.Item.weapon': 'Weapon', 'TYPES.Actor.npc': 'NPC', 'ITEM.TypeSpell': 'Spell' })
  })
})
