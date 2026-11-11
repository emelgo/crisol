import { bySiblingPlace } from '@crisol/domain'
import { describe, expect, it } from 'vitest'
import { type Listed, movedIn } from './file-order.ts'

const WORLD = 'w'
const ORG = 'o'
const file = (
  id: string,
  folderId: string | null = null,
  position: string | null = null,
  worldId: string | null = WORLD
) =>
  ({
    id,
    name: `${id}.png`,
    worldId,
    organizationId: ORG,
    folderId,
    position,
    kind: 'image',
    mime: 'image/png',
    size: 1,
    url: '',
    tags: [],
    version: 1,
    updatedAt: '',
    usedBy: 0
  }) as Listed['files'][number]
const folder = (id: string, parentId: string | null = null, position: string | null = null) => ({
  id,
  name: id,
  worldId: WORLD,
  organizationId: ORG,
  parentId,
  position
})
/** Los de una carpeta, en el orden en que se ven */
const filesIn = (list: Listed, folderId: string | null, worldId: string | null = WORLD) =>
  list.files
    .filter((f) => f.folderId === folderId && f.worldId === worldId)
    .sort(bySiblingPlace)
    .map((f) => f.id)

describe('mover en la lista cargada de archivos', () => {
  const list: Listed = {
    files: [file('a', 'mapas'), file('b', 'mapas'), file('c', 'mapas'), file('x'), file('comun', null, null, null)],
    folders: [folder('mapas'), folder('norte', 'mapas'), folder('retratos')]
  }

  it('recolocar en su carpeta: la primera vez, con los puestos de todos sus hermanos', () => {
    const moved = movedIn(list, { kind: 'file', id: 'c' }, { folderId: 'mapas', before: 'a' })
    expect(filesIn(moved, 'mapas')).toEqual(['c', 'a', 'b'])
    expect(moved.files.filter((f) => f.folderId === 'mapas').every((f) => f.position !== null)).toBe(true)
    // Los de otras carpetas y los comunes no se tocan
    expect(moved.files.find((f) => f.id === 'x')?.position).toBeNull()
    expect(moved.files.find((f) => f.id === 'comun')?.position).toBeNull()
    // Ya con puestos, solo cambia el suyo
    const again = movedIn(moved, { kind: 'file', id: 'a' }, { folderId: 'mapas', after: 'b' })
    expect(filesIn(again, 'mapas')).toEqual(['c', 'b', 'a'])
    expect(again.files.filter((f, i) => f.position !== moved.files[i]?.position).map((f) => f.id)).toEqual(['a'])
  })

  it('a otra carpeta: en su puesto, o sin ancla detrás y sin puesto; no se mezcla con los comunes de lo más alto', () => {
    const into = movedIn(list, { kind: 'file', id: 'x' }, { folderId: 'mapas', after: 'a' })
    expect(filesIn(into, 'mapas')).toEqual(['a', 'x', 'b', 'c'])
    const out = movedIn(into, { kind: 'file', id: 'b' }, { folderId: null })
    expect(out.files.find((f) => f.id === 'b')).toMatchObject({ folderId: null, position: null })
    expect(filesIn(out, null)).toEqual(['b'])
    expect(filesIn(out, null, null)).toEqual(['comun'])
  })

  it('las carpetas, igual: delante de una hermana, y dentro de otra en su puesto', () => {
    const order = (l: Listed, parentId: string | null) =>
      l.folders
        .filter((f) => f.parentId === parentId)
        .sort(bySiblingPlace)
        .map((f) => f.id)
    const first = movedIn(list, { kind: 'folder', id: 'retratos' }, { folderId: null, before: 'mapas' })
    expect(order(first, null)).toEqual(['retratos', 'mapas'])
    const inside = movedIn(first, { kind: 'folder', id: 'retratos' }, { folderId: 'mapas', before: 'norte' })
    expect(order(inside, 'mapas')).toEqual(['retratos', 'norte'])
    expect(order(inside, null)).toEqual(['mapas'])
    // Lo que no está en la lista, la deja igual
    expect(movedIn(list, { kind: 'folder', id: 'otra' }, { folderId: null }).folders).toEqual(list.folders)
  })
})
