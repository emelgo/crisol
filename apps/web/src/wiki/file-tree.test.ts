import type { FolderView } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { COMMON, folderChoices, foundTree, matches, splitScopes, type Tree, treeOf, withCommon } from './file-tree.ts'
import type { WorldFile } from './links-context.ts'

const WORLD = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'

const file = (id: string, folderId: string | null, worldId: string | null = WORLD, tags: string[] = []): WorldFile => ({
  id,
  worldId,
  organizationId: ORG,
  name: `${id}.png`,
  folderId,
  position: null,
  kind: 'image',
  mime: 'image/png',
  size: 1,
  url: `/api/files/${id}`,
  tags,
  version: 1,
  updatedAt: '2026-11-12T00:00:00.000Z',
  usedBy: 0
})
const folder = (id: string, parentId: string | null, worldId: string | null = WORLD): FolderView => ({
  id,
  worldId,
  organizationId: ORG,
  parentId,
  name: id,
  position: null,
  color: null,
  icon: null
})
const shape = (tree: Tree, id: string | null = null, depth = 0): string[] =>
  (tree.get(id)?.folders ?? [])
    .flatMap((f) => [`${'  '.repeat(depth)}${f.id}/`, ...shape(tree, f.id, depth + 1)])
    .concat((tree.get(id)?.files ?? []).map((f) => `${'  '.repeat(depth)}${f.id}`))

describe('el árbol de Archivos', () => {
  const listed = {
    files: [file('mapa', 'lugares'), file('suelto', null), file('escudo', null, null), file('runa', 'sellos', null)],
    folders: [folder('lugares', null), folder('sellos', null, null)]
  }

  it('en un mundo, lo común cuelga de «Comunes», tras las carpetas del mundo', () => {
    const { own, common } = splitScopes(listed)
    const tree = treeOf(withCommon(own, common, { name: 'Comunes', organizationId: ORG }))
    expect(shape(tree)).toEqual(['lugares/', '  mapa', `${COMMON}/`, '  sellos/', '    runa', '  escudo', 'suelto'])
  })

  it('al buscar, cada encontrado dentro de todas sus carpetas y nada más', () => {
    const { own, common } = splitScopes(listed)
    const data = withCommon(own, common, { name: 'Comunes', organizationId: ORG })
    const results = data.files.filter((f) => f.id === 'runa')
    expect(shape(foundTree(results, treeOf(data), data.folders))).toEqual([`${COMMON}/`, '  sellos/', '    runa'])
  })

  it('busca por nombre sin tildes ni mayúsculas, o por el principio de una etiqueta con #', () => {
    const one = { name: 'Mapa de Ébano.png', tags: ['lugar/ciudad'] }
    expect(matches(one, 'ebano')).toBe(true)
    expect(matches(one, '  MAPA ')).toBe(true)
    expect(matches(one, '#lugar')).toBe(true)
    expect(matches(one, '#ciudad')).toBe(false)
    expect(matches(one, 'lugar')).toBe(false)
  })

  it('adónde puede ir: las carpetas de su ámbito con su camino, sin «Comunes» ni la que se mueve con las suyas', () => {
    const data = withCommon(
      { files: [], folders: [folder('lugares', null), folder('puertos', 'lugares'), folder('muelles', 'puertos')] },
      { files: [], folders: [folder('sellos', null, null), folder('runas', 'sellos', null)] },
      { name: 'Comunes', organizationId: ORG }
    )
    expect(folderChoices(data.folders, WORLD).map((c) => c.label)).toEqual([
      'lugares',
      'lugares › puertos',
      'lugares › puertos › muelles'
    ])
    expect(folderChoices(data.folders, WORLD, 'puertos').map((c) => c.id)).toEqual(['lugares'])
    expect(folderChoices(data.folders, null).map((c) => c.label)).toEqual(['sellos', 'sellos › runas'])
  })
})
