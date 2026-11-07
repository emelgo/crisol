import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { filesFromZip, readFoundryZip, slimZip, toBase64 } from './foundry-zip.ts'

const manifest = {
  id: 'fronteras',
  title: 'Fronteras',
  version: '2.1',
  packs: [
    { name: 'conjuros', label: 'Conjuros', type: 'Item', path: 'packs/conjuros' },
    { name: 'criaturas', label: 'Criaturas', type: 'Actor', path: './packs/criaturas' },
    { name: 'escenas', label: 'Escenas', type: 'Scene', path: 'packs/escenas' },
    { name: 'viejo', label: 'Viejo', entity: 'Item' }
  ]
}
const zip = (root: string) =>
  zipSync({
    [`${root}system.json`]: strToU8(JSON.stringify(manifest)),
    [`${root}lang/en.json`]: strToU8('{}'),
    [`${root}packs/conjuros/000001.ldb`]: strToU8('a'),
    [`${root}packs/criaturas/000001.ldb`]: strToU8('b'),
    [`${root}packs/viejo`]: strToU8('c'),
    [`${root}packs/escenas/000001.ldb`]: strToU8('d'),
    [`${root}assets/mapa.webp`]: new Uint8Array(1000),
    [`${root}packs/conjuros/sub/system.json`]: strToU8('{"id":"otro"}')
  })

describe('el zip de Foundry, antes de subirlo', () => {
  it('su manifiesto (el más cercano a la raíz) y los compendios que se traen', () => {
    const read = readFoundryZip(zip('fronteras/'))
    expect(read).toMatchObject({
      kind: 'system',
      id: 'fronteras',
      title: 'Fronteras',
      version: '2.1',
      root: 'fronteras/'
    })
    expect(read?.packs.map((p) => `${p.name}:${p.type}:${p.path}`)).toEqual([
      'conjuros:Item:packs/conjuros',
      'criaturas:Actor:packs/criaturas',
      'viejo:Item:packs/viejo'
    ])
    // Las escenas y aventuras, aparte: van a un mundo
    expect(read?.scenePacks.map((p) => `${p.name}:${p.type}`)).toEqual(['escenas:Scene'])
  })

  it('lo que no es de Foundry, null', () => {
    expect(readFoundryZip(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(readFoundryZip(zipSync({ 'nada.txt': strToU8('x') }))).toBeNull()
    expect(readFoundryZip(zipSync({ 'module.json': strToU8('{roto') }))).toBeNull()
    expect(readFoundryZip(zipSync({ 'module.json': strToU8('{"id":"m"}') }))).toMatchObject({
      kind: 'module',
      packs: []
    })
  })

  it('se sube solo el manifiesto, sus idiomas y los compendios elegidos', () => {
    const bytes = zip('')
    const read = readFoundryZip(bytes)
    if (!read) throw new Error('sin manifiesto')
    const slim = Object.keys(unzipSync(slimZip(bytes, read, ['conjuros', 'viejo']))).sort()
    expect(slim).toEqual([
      'lang/en.json',
      'packs/conjuros/000001.ldb',
      'packs/conjuros/sub/system.json',
      'packs/viejo',
      'system.json'
    ])
    expect(toBase64(strToU8('Hola'))).toBe('SG9sYQ==')
  })

  it('para las escenas: sus paquetes, y sus imágenes por su ruta (las que vienen y no pasan del tope)', () => {
    const bytes = zip('fronteras/')
    const read = readFoundryZip(bytes)
    if (!read) throw new Error('sin manifiesto')
    expect(Object.keys(unzipSync(slimZip(bytes, read, ['escenas']))).sort()).toEqual([
      'fronteras/lang/en.json',
      'fronteras/packs/escenas/000001.ldb',
      'fronteras/system.json'
    ])
    const files = filesFromZip(bytes, read, ['systems/fronteras/assets/mapa.webp', 'icons/svg/mystery-man.svg'])
    expect([...files.keys()]).toEqual(['systems/fronteras/assets/mapa.webp'])
    expect(files.get('systems/fronteras/assets/mapa.webp')).toHaveLength(1000)
    expect(filesFromZip(bytes, read, ['systems/fronteras/assets/mapa.webp'], 500).size).toBe(0)
  })
})
