import { describe, expect, it } from 'vitest'
import { blank } from './catalog/blank.ts'
import { CATALOG, catalogSystem } from './catalog/index.ts'
import { cinco } from './fixtures/cinco.ts'
import { fronteras } from './fixtures/fronteras.ts'
import { FORMAT, LIMITS, type System } from './format.ts'
import { textOf } from './text.ts'
import { fitsFormat, type Problem, validateSystem, whereOf } from './validate.ts'

/** Una copia que se puede cambiar sin tocar la de las pruebas */
const copy = (system: System = fronteras): System & Record<string, unknown> => structuredClone(system)
const errors = (input: unknown) => validateSystem(input).problems.filter((p) => p.severity === 'error')
const only = (input: unknown): Problem => {
  const found = errors(input)
  expect(found, JSON.stringify(found)).toHaveLength(1)
  return found[0] as Problem
}

describe('el formato', () => {
  it('«En blanco», Fronteras y el 5e de prueba valen, sin problemas', () => {
    for (const system of [blank, fronteras, cinco]) {
      const { system: valid, problems } = validateSystem(system)
      expect(problems, textOf(system.name)).toEqual([])
      expect(valid).not.toBeNull()
    }
  })

  it('el catálogo trae «En blanco» con su id fijo', () => {
    expect(CATALOG.map((s) => s.id)).toEqual(['blank'])
    expect(catalogSystem('blank')?.dice?.critical).toBe('d20')
    expect(catalogSystem('nada')).toBeNull()
  })

  it('cada clase de campo, con lo suyo', () => {
    const system = copy(blank)
    system.types.personaje = {
      document: 'actor',
      label: 'Personaje',
      fields: {
        nombre: { kind: 'text', label: 'Nombre', max: 80 },
        nivel: { kind: 'number', label: 'Nivel', min: 1, max: 20, default: 1, integer: true },
        vivo: { kind: 'boolean', label: 'Vivo', default: true },
        idiomas: { kind: 'list', label: 'Idiomas', default: ['Común'] },
        talla: {
          kind: 'choice',
          label: 'Talla',
          options: [{ value: 'mediana', label: 'Mediana' }],
          default: 'mediana'
        },
        patron: { kind: 'link', label: 'Patrón', to: 'personaje' },
        muerte: { kind: 'clock', label: 'Salvaciones', segments: 3 },
        golpe: { kind: 'dice', label: 'Dado de golpe', default: '1d8' },
        pg: { kind: 'resource', label: 'PG', max: '@nivel * 8' },
        defensa: { kind: 'derived', label: 'Defensa', formula: '10 + @nivel' },
        monedas: { kind: 'group', label: 'Monedas', fields: { oro: { kind: 'number', label: 'Oro' } } },
        ataques: {
          kind: 'table',
          label: 'Ataques',
          columns: { nombre: { kind: 'text', label: 'Nombre' }, bono: { kind: 'number', label: 'Bono' } }
        },
        salvaciones: {
          kind: 'set',
          label: 'Salvaciones',
          elements: [{ key: 'fue', label: 'Fuerza' }],
          fields: { competente: { kind: 'boolean', label: 'Competente' } }
        },
        lleva: { kind: 'items', label: 'Lleva', of: ['objeto'] }
      }
    }
    system.types.objeto = { document: 'item', label: 'Objeto', fields: {} }
    expect(validateSystem(system).problems).toEqual([])
  })

  it('los textos, en un idioma o en varios; si falta el pedido, el del primero que haya', () => {
    expect(textOf('Vigor')).toBe('Vigor')
    expect(textOf({ es: 'Fuerza', en: 'Strength' }, 'en')).toBe('Strength')
    expect(textOf({ en: 'Strength' }, 'es')).toBe('Strength')
    expect(textOf(undefined)).toBe('')
    const system = copy()
    system.name = {}
    expect(only(system)).toMatchObject({
      path: 'name',
      where: 'Nombre',
      message: 'Escribe el texto al menos en un idioma'
    })
  })
})

describe('cada problema dice dónde y por qué', () => {
  it('una clase que no existe, por su ruta y por sus nombres', () => {
    const system = copy()
    ;(system.types.personaje?.fields as Record<string, unknown>).vigor = { kind: 'numero', label: 'Vigor' }
    expect(only(system)).toEqual({
      path: 'types.personaje.fields.vigor.kind',
      where: 'Personaje › Vigor › Clase',
      message: 'No existe la clase «numero»',
      severity: 'error'
    })
  })

  it('lo que falta, lo que sobra de largo y lo que no tiene forma', () => {
    const system = copy()
    delete (system as Record<string, unknown>).version
    expect(only(system)).toMatchObject({ path: 'version', where: 'Versión', message: 'Falta' })
    const long = copy()
    long.name = 'x'.repeat(300)
    expect(only(long).message).toBe('Como mucho, 200 caracteres')
    const wrong = copy()
    ;(wrong as Record<string, unknown>).languages = 'es'
    expect(only(wrong).message).toBe('Tiene que ser una lista')
  })

  it('una clave con mayúsculas o espacios', () => {
    const system = copy()
    ;(system.types.personaje?.fields as Record<string, unknown>)['Bono ataque'] = { kind: 'number', label: 'Bono' }
    expect(only(system)).toMatchObject({
      path: 'types.personaje.fields.Bono ataque',
      message: 'Una clave va en minúsculas, sin espacios ni tildes, como «defensa» o «bono_ataque»'
    })
  })

  it('otra versión del formato', () => {
    const system = copy()
    ;(system as Record<string, unknown>).format = FORMAT + 1
    expect(only(system)).toMatchObject({ path: 'format', message: `Tiene que ser «${FORMAT}»` })
  })

  it('los rangos y las opciones', () => {
    const system = copy()
    const fields = system.types.personaje?.fields as unknown as Record<string, Record<string, unknown>>
    Object.assign(fields.vigor as object, { min: 3, max: -1 })
    expect(only(system)).toMatchObject({
      where: 'Personaje › Vigor › Mínimo',
      message: 'El mínimo es mayor que el máximo'
    })
    const options = copy()
    Object.assign(options.types.movimiento?.fields.atributo as object, { default: 'fuerza' })
    expect(only(options)).toMatchObject({
      where: 'Movimiento › Atributo › Valor inicial',
      message: '«fuerza» no es una de sus opciones'
    })
    const clock = copy()
    Object.assign(clock.types.personaje?.fields.experiencia as object, { default: 9 })
    expect(only(clock).message).toBe('Como mucho, 8')
  })

  it('lo que se nombra tiene que existir', () => {
    const link = copy()
    ;(link.types.personaje?.fields as Record<string, unknown>).patron = { kind: 'link', label: 'Patrón', to: 'deidad' }
    expect(only(link)).toMatchObject({
      path: 'types.personaje.fields.patron.to',
      message: 'No existe el tipo «deidad»'
    })
    const items = copy()
    Object.assign(items.types.personaje?.fields.lleva as object, { of: ['personaje'] })
    expect(only(items).message).toBe('«personaje» no es un tipo de objeto')
    const target = copy()
    ;(target.types.objeto?.modifiers as { target: string }[])[0] = { target: 'armadura', value: '1' } as never
    expect(only(target)).toMatchObject({
      where: 'Objeto › Bonos › 1.ª › Objetivo',
      message: 'Ningún personaje tiene «armadura»'
    })
    const roll = copy()
    Object.assign(roll.rolls?.atributo as object, { for: { fields: ['vigor', 'fe'] } })
    expect(only(roll)).toMatchObject({ path: 'rolls.atributo.for.fields[1]', message: 'No existe el campo «fe»' })
    const set = copy(cinco)
    Object.assign(set.rolls?.caracteristica as object, { for: { set: 'habilidades' } })
    expect(only(set).message).toBe('No existe el conjunto «habilidades»')
    const pack = copy(cinco)
    ;(pack.packs as unknown[])[0] = { key: 'objetos', label: 'Objetos', document: 'item', types: ['arma'] }
    expect(only(pack)).toMatchObject({ path: 'packs[0].types[0]', message: 'No existe el tipo «arma»' })
    const wrongClass = copy(cinco)
    ;(wrongClass.packs as unknown[])[0] = { key: 'gente', label: 'Gente', document: 'item', types: ['personaje'] }
    expect(only(wrongClass).message).toBe('«personaje» no es de objetos')
  })

  it('solo los objetos dan bonos', () => {
    const system = copy()
    system.types.personaje = {
      ...(system.types.personaje as System['types'][string]),
      modifiers: [{ target: 'defensa', value: '1' }]
    }
    expect(only(system)).toMatchObject({ path: 'types.personaje.modifiers[0]', message: 'Solo los objetos dan bonos' })
  })

  it('los dados de los modos y de la tirada por defecto, con el error de la notación', () => {
    const system = copy()
    Object.assign(system.dice as object, { default: '2d' })
    expect(only(system)).toMatchObject({ path: 'dice.default', where: 'Dados › Valor inicial' })
    const modes = copy()
    ;(modes.rolls?.atributo?.modes as { to: string }[])[0] = {
      key: 'ventaja',
      label: 'Con ventaja',
      from: '2d6',
      to: '3d6kh4'
    } as never
    expect(only(modes).message).toBe('No se puede quedar con 4 de 3 dados')
    const twice = copy()
    ;(twice.rolls?.atributo?.modes as { key: string }[])[1] = {
      key: 'ventaja',
      label: 'Otra',
      from: '2d6',
      to: '3d6kh2'
    } as never
    expect(only(twice).message).toBe('«ventaja» está repetido')
  })

  it('las franjas, por su número', () => {
    expect(whereOf(fronteras, ['rolls', 'atributo', 'bands', 1, 'if'])).toBe(
      'Tiradas › Atributo › Resultado, 2.ª franja › Si'
    )
    expect(whereOf(cinco, ['sources', 0, 'attribution'])).toBe('Fuentes › SRD 5.1 › Atribución')
    expect(whereOf(cinco, ['types', 'personaje', 'fields', 'caracteristicas', 'fields', 'mod', 'formula'])).toBe(
      'Personaje › Características › Modificador › Fórmula'
    )
  })

  it('los ajustes de campaña', () => {
    const system = copy(cinco)
    Object.assign(system.settings?.metodos as object, { default: ['estandar', 'dados'] })
    expect(only(system)).toMatchObject({
      path: 'settings.metodos.default',
      message: '«dados» no es una de sus opciones'
    })
    const empty = copy(cinco)
    Object.assign(empty.settings as object, { otro: { kind: 'choice', label: 'Otro' } })
    expect(only(empty).message).toBe('Hace falta al menos una opción')
  })

  it('lo repetido', () => {
    const system = copy(cinco)
    system.languages = ['es', 'es']
    ;(system.sources as { key: string }[])[1] = { ...(system.sources?.[0] as object) } as never
    const found = errors(system).map((p) => p.message)
    expect(found).toEqual(['«es» está repetido', '«srd51» está repetida'])
    const set = copy(cinco)
    const elements = ((set.types.personaje?.fields.caracteristicas ?? {}) as { elements: { key: string }[] }).elements
    elements[1] = { ...(elements[0] as { key: string }) }
    // Sin «des», la fórmula de la CA, que lo usa, también falla
    expect(errors(set).map((p) => p.message)).toEqual(['«fue» está repetido', '«des» no existe en «@caracteristicas»'])
  })
})

describe('lo que el formato no conoce', () => {
  it('se avisa, no impide guardarlo y se conserva', () => {
    const system = copy()
    Object.assign(system.types.personaje?.fields.vigor as object, { icon: 'musculo' })
    const { system: valid, problems } = validateSystem(system)
    expect(problems).toEqual([
      {
        path: 'types.personaje.fields.vigor.icon',
        where: 'Personaje › Vigor › icon',
        message: 'Crisol no conoce «icon»: se guarda tal cual, sin usarlo',
        severity: 'warning'
      }
    ])
    expect(((valid?.types.personaje?.fields.vigor ?? {}) as unknown as Record<string, unknown>).icon).toBe('musculo')
  })
})

describe('los límites', () => {
  it('2 MB, 500 campos por tipo y 3 niveles de campos dentro de otros', () => {
    const big = copy()
    big.summary = 'x'.repeat(10)
    ;(big as Record<string, unknown>).relleno = 'x'.repeat(LIMITS.bytes)
    expect(only(big).message).toMatch(/^Como mucho, 2 MB/)
    const many = copy()
    many.types.personaje = {
      document: 'actor',
      label: 'Personaje',
      fields: Object.fromEntries(
        Array.from({ length: 260 }, (_, i) => [
          `g${i}`,
          { kind: 'group', label: 'G', fields: { a: { kind: 'number', label: 'A' } } }
        ])
      )
    }
    many.rolls = {}
    many.types.objeto = { document: 'item', label: 'Objeto', fields: {} }
    expect(only(many)).toMatchObject({ path: 'types.personaje.fields', message: 'Como mucho, 500 campos por tipo' })
    const deep = copy()
    const n = (fields: Record<string, unknown>) => ({ kind: 'group', label: 'G', fields })
    ;(deep.types.personaje?.fields as Record<string, unknown>).a = n({
      b: n({ c: n({ d: { kind: 'number', label: 'D' } }) })
    })
    expect(only(deep)).toMatchObject({
      path: 'types.personaje.fields.a.fields.b.fields.c.fields.d',
      message: 'Como mucho, 3 niveles de campos dentro de otros'
    })
  })
})

describe('lo declarativo de un sistema de Foundry cabe en el formato', () => {
  // Un manifiesto con la forma del de un sistema de Foundry, escrito para esta prueba (sin nada suyo)
  const manifest = {
    id: 'aventura',
    title: 'Aventura',
    description: 'Un sistema de prueba',
    version: '2.1.0',
    compatibility: { minimum: '13', verified: '14' },
    documentTypes: {
      Actor: { character: { htmlFields: ['details.biography'] }, npc: {} },
      Item: { weapon: {}, spell: { htmlFields: ['description'] } }
    },
    packs: [{ name: 'weapons', label: 'Weapons', type: 'Item', system: 'aventura' }],
    languages: [{ lang: 'en', name: 'English', path: 'lang/en.json' }]
  }

  it('sus tipos, sus paquetes y sus idiomas casan uno a uno', () => {
    const types = Object.fromEntries(
      Object.entries(manifest.documentTypes).flatMap(([document, subtypes]) =>
        Object.keys(subtypes).map((key) => [
          key,
          { document: document === 'Actor' ? 'actor' : 'item', label: key, fields: {} }
        ])
      )
    )
    const system = {
      format: FORMAT,
      id: manifest.id,
      name: manifest.title,
      summary: manifest.description,
      version: manifest.version,
      languages: manifest.languages.map((l) => l.lang),
      types,
      // Un paquete es de una clase de documento, y puede mezclar sus tipos
      packs: manifest.packs.map((p) => ({
        key: p.name,
        label: p.label,
        document: p.type === 'Actor' ? 'actor' : 'item'
      }))
    }
    expect(validateSystem(system).problems).toEqual([])
  })
})

describe('la forma de un sistema, para el editor', () => {
  it('con valores que no valen, sí; con uno de otra clase, no', () => {
    const good = structuredClone(fronteras)
    expect(fitsFormat(good)).toBe(true)
    const empty = structuredClone(fronteras)
    empty.name = ''
    ;(empty.rolls?.atributo?.bands?.[0] as { tone: string }).tone = 'otro'
    expect(fitsFormat(empty)).toBe(true)
    const wrong = structuredClone(fronteras) as unknown as { types: { personaje: { fields: unknown } } }
    wrong.types.personaje.fields = []
    expect(fitsFormat(wrong)).toBe(false)
    const label = structuredClone(fronteras) as unknown as { name: unknown }
    label.name = 5
    expect(fitsFormat(label)).toBe(false)
    const kind = structuredClone(fronteras) as unknown as {
      types: { personaje: { fields: { vigor: { kind: string } } } }
    }
    kind.types.personaje.fields.vigor.kind = 'raro'
    expect(fitsFormat(kind)).toBe(false)
    expect(fitsFormat(5)).toBe(false)
    expect(fitsFormat({})).toBe(false)
  })
})
