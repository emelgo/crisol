import { describe, expect, it } from 'vitest'
import {
  createTemplateFolder,
  deleteFiles,
  getLinkedContent,
  moveFile,
  moveFiles,
  moveTag,
  moveTemplate,
  updateFolder,
  updateTemplateFolder
} from './index.ts'

const id = () => crypto.randomUUID()
const ok = (schema: { safeParse: (input: unknown) => { success: boolean } }, input: unknown) =>
  schema.safeParse(input).success

describe('carpetas, orden y enlaces: lo que se pide tiene sentido', () => {
  it('una carpeta de archivos cambia algo, y no va delante y detrás a la vez', () => {
    const folderId = id()
    expect(ok(updateFolder.input, { folderId, name: 'Mapas' })).toBe(true)
    expect(ok(updateFolder.input, { folderId, color: null })).toBe(true)
    expect(ok(updateFolder.input, { folderId, after: id() })).toBe(true)
    expect(ok(updateFolder.input, { folderId })).toBe(false)
    expect(ok(updateFolder.input, { folderId, before: id(), after: id() })).toBe(false)
  })

  it('borrar o mover varios archivos pide alguno', () => {
    expect(ok(deleteFiles.input, {})).toBe(false)
    expect(ok(deleteFiles.input, { folderIds: [id()] })).toBe(true)
    expect(ok(moveFiles.input, { folderId: null })).toBe(false)
    expect(ok(moveFiles.input, { fileIds: [id()], folderId: null })).toBe(true)
  })

  it('un archivo se ordena delante o detrás de otro, no de los dos', () => {
    expect(ok(moveFile.input, { fileId: id(), folderId: null, before: id() })).toBe(true)
    expect(ok(moveFile.input, { fileId: id(), folderId: null, before: id(), after: id() })).toBe(false)
  })

  it('una etiqueta se mueve delante o detrás de una hermana, no de las dos', () => {
    expect(ok(moveTag.input, { tag: 'lugar/ciudad', parent: 'sitio', after: 'sitio/aldea' })).toBe(true)
    expect(ok(moveTag.input, { tag: 'lugar/ciudad', parent: null, before: 'a', after: 'b' })).toBe(false)
  })

  it('el nombre de una carpeta de plantillas no lleva barras ni queda vacío', () => {
    expect(createTemplateFolder.input.parse({ name: '  Gente  ' })).toEqual({ parentId: null, name: 'Gente' })
    expect(ok(createTemplateFolder.input, { name: 'Gente/Nobles' })).toBe(false)
    expect(ok(createTemplateFolder.input, { name: 'a\\b' })).toBe(false)
    expect(ok(createTemplateFolder.input, { name: '   ' })).toBe(false)
  })

  it('cambiar una carpeta de plantillas pide algo que cambiar, y un solo lado', () => {
    const folderId = id()
    expect(ok(updateTemplateFolder.input, { folderId, icon: '🗡️' })).toBe(true)
    expect(ok(updateTemplateFolder.input, { folderId, parentId: null })).toBe(true)
    const nothing = updateTemplateFolder.input.safeParse({ folderId })
    expect(nothing.success).toBe(false)
    expect(nothing.error?.issues[0]?.message).toBe('Nada que cambiar')
    expect(ok(updateTemplateFolder.input, { folderId, before: id(), after: id() })).toBe(false)
  })

  it('una plantilla se ordena delante o detrás de otra, no de las dos', () => {
    expect(ok(moveTemplate.input, { templateId: id(), folderId: id(), after: id() })).toBe(true)
    expect(ok(moveTemplate.input, { templateId: id(), folderId: null, before: id(), after: id() })).toBe(false)
  })

  it('lo enlazado con [[@Nombre]] se busca desde un mundo, una campaña o un sistema', () => {
    expect(ok(getLinkedContent.input, { name: 'Bola de fuego', systemId: id() })).toBe(true)
    expect(ok(getLinkedContent.input, { name: 'Bola de fuego', campaignId: id() })).toBe(true)
    const nowhere = getLinkedContent.input.safeParse({ name: 'Bola de fuego' })
    expect(nowhere.error?.issues[0]?.message).toBe('worldId, campaignId o systemId')
  })
})
