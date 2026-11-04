import { describe, expect, it } from 'vitest'
import { type ContentItem, FILE_BYTES, fileName, toFile, validateContent, validateFile } from './file.ts'
import { cinco } from './fixtures/cinco.ts'
import { fronteras } from './fixtures/fronteras.ts'
import { FORMAT, LIMITS } from './format.ts'

const anillo: ContentItem = {
  type: 'objeto',
  key: 'anillo-proteccion',
  source: 'srd51',
  data: { name: 'Anillo de protección', bono_ca: 1 }
}

describe('el archivo de un sistema', () => {
  it('ida y vuelta: el sistema y su contenido llegan igual', () => {
    const file = toFile(cinco, [anillo])
    const round = validateFile(JSON.parse(JSON.stringify(file)))
    expect(round.problems).toEqual([])
    expect(round.file).toEqual(file)
  })

  it('su nombre al bajarlo, sin tildes ni espacios', () => {
    expect(fileName(fronteras)).toBe('fronteras.crisol-system.json')
    expect(fileName({ ...cinco, name: { es: 'Reglas de Ëana: 2.ª' } })).toBe('reglas-de-eana-2.crisol-system.json')
    expect(fileName({ ...cinco, name: '¿?' })).toBe('sistema.crisol-system.json')
  })

  it('lo que no es un archivo de sistema, otra versión del formato o uno demasiado grande', () => {
    expect(validateFile({ hola: 1 }).problems[0]?.message).toBe('No es el archivo de un sistema de Crisol')
    expect(validateFile([]).problems[0]?.message).toBe('No es el archivo de un sistema de Crisol')
    expect(validateFile({ ...toFile(fronteras, []), format: FORMAT + 1 }).problems[0]?.message).toBe(
      `Es de otra versión del formato (${FORMAT + 1}); esta es la ${FORMAT}`
    )
    const big = toFile(fronteras, [
      { ...anillo, type: 'objeto', source: null, data: { name: 'x', relleno: 'x'.repeat(FILE_BYTES) } }
    ])
    expect(validateFile(big).problems[0]?.message).toBe('Como mucho, 10 MB')
  })

  it('los problemas del sistema, con su ruta dentro del archivo', () => {
    const broken = structuredClone(fronteras)
    Object.assign(broken.types.personaje?.fields.defensa as object, { formula: '7 + @vigr' })
    const { file, problems } = validateFile(toFile(broken, []))
    expect(file).toBeNull()
    expect(problems).toEqual([
      expect.objectContaining({
        path: 'system.types.personaje.fields.defensa.formula',
        where: 'Personaje › Defensa › Fórmula'
      })
    ])
  })
})

describe('el contenido de un sistema', () => {
  it('de sus tipos, con claves sin repetir, fuentes que existen, su nombre y su tamaño', () => {
    const problems = validateContent(cinco, [
      anillo,
      { ...anillo, key: 'espada', type: 'arma' },
      { ...anillo, key: 'anillo-proteccion' },
      { ...anillo, key: 'Mal Escrita' },
      { ...anillo, key: 'otro', source: 'srd99' },
      { ...anillo, key: 'sin-nombre', data: { bono_ca: 1 } },
      { ...anillo, key: 'grande', data: { name: 'Grande', texto: 'x'.repeat(LIMITS.contentBytes) } },
      'nada',
      { ...anillo, key: 'sin-datos', data: [] }
    ])
    expect(problems.map((p) => [p.path, p.where, p.message])).toEqual([
      ['content[1].type', 'Contenido › Anillo de protección › Tipo', 'No existe el tipo «arma»'],
      ['content[2].key', 'Contenido › Anillo de protección › Clave', '«anillo-proteccion» está repetida'],
      [
        'content[3].key',
        'Contenido › Anillo de protección › Clave',
        'Una clave va en minúsculas, sin espacios ni tildes'
      ],
      ['content[4].source', 'Contenido › Anillo de protección › Fuente', 'No existe la fuente «srd99»'],
      ['content[5].data.name', 'Contenido › sin-nombre › Datos › Nombre', 'Falta su nombre'],
      ['content[6].data', 'Contenido › Grande › Datos', 'Como mucho, 64 KB por documento'],
      ['content[7]', 'Contenido › 8.º', 'Tiene que ser un documento'],
      ['content[8].data', 'Contenido › sin-datos › Datos', 'Tiene que ser un objeto']
    ])
    expect(validateContent(cinco, { no: 'lista' })[0]?.message).toBe('Tiene que ser una lista')
    expect(
      validateContent(
        cinco,
        Array.from({ length: LIMITS.contentDocuments + 1 }, () => anillo)
      )[0]?.message
    ).toBe('Como mucho, 5000 documentos')
  })

  it('un nombre en varios idiomas vale', () => {
    expect(validateContent(cinco, [{ ...anillo, data: { name: { en: 'Ring of protection' } } }])).toEqual([])
  })
})
