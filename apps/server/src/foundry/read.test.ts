import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { FoundryError } from '@crisol/systems/foundry'
import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { assemble, inspectFoundryZip, readFoundryZip, readNedb } from './read.ts'
import { foundryZip, inFolder, levelFiles, nedbFile } from './testing.ts'

const manifest = {
  id: 'mazmorra',
  title: 'Mazmorra',
  version: '1.0',
  languages: [{ lang: 'es', path: 'idiomas/es.json' }],
  packs: [
    { name: 'monstruos', label: 'Monstruos', type: 'Actor', path: 'packs/monstruos' },
    { name: 'armas', label: 'Armas', type: 'Item', path: 'packs/armas.db' },
    { name: 'efectos', label: 'Efectos', type: 'ActiveEffect', path: 'packs/efectos' }
  ]
}

const monsters = () =>
  levelFiles({
    '!actors!trasgo0000000001': { name: 'Trasgo', type: 'npc', folder: 'carpeta000000001', items: ['b', 'a'] },
    '!actors.items!trasgo0000000001.a': { name: 'Cimitarra', type: 'weapon' },
    '!actors.items!trasgo0000000001.b': { name: 'Huida', type: 'feat' },
    '!actors.items!trasgo0000000001.c': { name: 'Escudo', type: 'equipment' },
    '!actors.items.effects!trasgo0000000001.a.e': { name: 'Efecto' },
    '!actors.items!perdido000000001.x': { name: 'Sin dueño' },
    '!folders!carpeta000000001': { name: 'Trasgoides', type: 'Actor' },
    '!raro': 'no'
  })

describe('leer el zip de Foundry', () => {
  it('el manifiesto dentro de su carpeta, su idioma y sus paquetes LevelDB y NeDB', async () => {
    const zip = foundryZip({
      'mazmorra/system.json': manifest,
      'mazmorra/idiomas/es.json': { TYPES: { Actor: { npc: 'Criatura' } } },
      'mazmorra/otra/module.json': { id: 'otro' },
      ...inFolder('mazmorra/packs/monstruos', await monsters()),
      'mazmorra/packs/armas.db': nedbFile([
        { _id: 'daga', name: 'Daga', type: 'weapon' },
        { _id: 'maza', name: 'Maza', type: 'weapon' },
        { _id: 'daga', name: 'Daga afilada', type: 'weapon' },
        { _id: 'maza', $$deleted: true }
      ])
    })
    const before = (await readdir(tmpdir())).filter((n) => n.startsWith('crisol-foundry-'))
    const read = await readFoundryZip(zip, { language: 'es' })
    expect(read.manifest).toMatchObject({ id: 'mazmorra', kind: 'system' })
    expect(read.names).toEqual({ 'TYPES.Actor.npc': 'Criatura' })
    const [actors, items, effects] = read.packs
    expect(actors?.documents).toHaveLength(1)
    expect(actors?.documents[0]).toMatchObject({ _id: 'trasgo0000000001', name: 'Trasgo' })
    // Lo de dentro, en el orden de su lista y luego lo demás
    expect(((actors?.documents[0]?.items ?? []) as { name: string }[]).map((i) => i.name)).toEqual([
      'Huida',
      'Cimitarra',
      'Escudo'
    ])
    expect(actors?.folders).toEqual([{ _id: 'carpeta000000001', name: 'Trasgoides', folder: null }])
    expect(items?.documents.map((d) => d.name)).toEqual(['Daga afilada'])
    expect(effects?.documents).toEqual([])
    // La carpeta temporal se borra
    expect((await readdir(tmpdir())).filter((n) => n.startsWith('crisol-foundry-'))).toEqual(before)
  })

  it('solo los paquetes que se piden; uno que no existe, un error', async () => {
    const zip = foundryZip({ 'system.json': manifest, 'packs/armas.db': nedbFile([{ _id: 'd', name: 'Daga' }]) })
    const read = await readFoundryZip(zip, { packs: ['armas'], language: 'en' })
    expect(read.packs.map((p) => p.name)).toEqual(['armas'])
    expect(read.names).toEqual({})
    await expect(readFoundryZip(zip, { packs: ['nada'], language: 'es' })).rejects.toThrow(
      'No tiene los paquetes «nada»'
    )
    // Un paquete que no está en el zip: vacío
    expect((await readFoundryZip(zip, { language: 'es' })).packs[0]?.documents).toEqual([])
  })

  it('un módulo, con lang/en.json si no hay otro', async () => {
    const zip = foundryZip({
      'module.json': { id: 'extra', relationships: { systems: [{ id: 'mazmorra' }] } },
      'lang/en.json': { 'TYPES.Item': { weapon: 'Weapon' } }
    })
    const read = await readFoundryZip(zip, { language: 'es' })
    expect(read.manifest).toMatchObject({ kind: 'module', system: 'mazmorra' })
    expect(read.names).toEqual({ 'TYPES.Item.weapon': 'Weapon' })
  })

  it('cuántos documentos tiene cada paquete', async () => {
    const zip = foundryZip({ 'system.json': manifest, ...inFolder('packs/monstruos', await monsters()) })
    const { packs } = await inspectFoundryZip(zip)
    expect(packs).toEqual([
      { name: 'monstruos', label: 'Monstruos', type: 'Actor', documents: 1, supported: true },
      { name: 'armas', label: 'Armas', type: 'Item', documents: 0, supported: true },
      { name: 'efectos', label: 'Efectos', type: 'ActiveEffect', documents: 0, supported: false }
    ])
  })

  it('lo que no vale: no es un zip, sin manifiesto, un manifiesto roto, una base rota', async () => {
    const code = async (zip: Uint8Array) => {
      try {
        await readFoundryZip(zip, { language: 'es' })
        return null
      } catch (error) {
        return error instanceof FoundryError ? error.message : String(error)
      }
    }
    expect(await code(new TextEncoder().encode('hola'))).toBe('No es un zip')
    expect(await code(foundryZip({ 'leeme.txt': 'x' }))).toBe('No tiene system.json ni module.json')
    expect(await code(foundryZip({ 'a/b/c/d/e/system.json': manifest }))).toBe('No tiene system.json ni module.json')
    expect(await code(foundryZip({ 'system.json': '{roto' }))).toBe('system.json no es JSON')
    expect(await code(foundryZip({ 'system.json': manifest, 'packs/monstruos/CURRENT': 'nada' }))).toBe(
      'No se pudo leer el paquete «Monstruos»'
    )
    expect(await code(zipSync({}))).toBe('No tiene system.json ni module.json')
  })
})

describe('las piezas', () => {
  it('assemble deja fuera lo que no es un documento', () => {
    expect(assemble([['!items!a', 3]]).documents).toEqual([])
  })

  it('assemble junta lo de dentro a cualquier profundidad; un campo con un solo id, su documento', () => {
    const { documents } = assemble([
      ['!scenes!s', { name: 'Cripta', tokens: ['t'], levels: ['l'] }],
      ['!scenes.levels!s.l', { name: 'Planta' }],
      ['!scenes.tokens!s.t', { name: 'Goblin', delta: 'd' }],
      ['!scenes.tokens.delta!s.t.d', { system: { hp: 3 }, effects: ['e'] }],
      ['!scenes.tokens.delta.effects!s.t.d.e', { name: 'Apresado' }],
      ['!scenes.regions.behaviors!s.r.b', { type: 'huérfano' }],
      ['!scenes.tokens!s', { name: 'mal' }]
    ])
    expect(documents).toEqual([
      {
        _id: 's',
        name: 'Cripta',
        levels: [{ _id: 'l', name: 'Planta' }],
        tokens: [
          {
            _id: 't',
            name: 'Goblin',
            delta: { _id: 'd', system: { hp: 3 }, effects: [{ _id: 'e', name: 'Apresado' }] }
          }
        ]
      }
    ])
  })

  it('readNedb salta las líneas rotas y las que no tienen id', () => {
    expect(readNedb('{"_id":"a","name":"A"}\n{roto\n{"name":"sin id"}\n\n[1]')).toEqual([{ _id: 'a', name: 'A' }])
  })
})
