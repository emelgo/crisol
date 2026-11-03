/**
 * Las plantillas de página (ADR-0009): sus campos (propiedades con el id de su campo y su valor inicial), los bloques de
 * su panel y el esqueleto del texto en Markdown. Las de serie viven aquí, en español (son contenido, no interfaz) y no se
 * cambian; las de la cuenta tienen la misma forma y se guardan en la base de datos
 */
import { conformTo, type PageProperty } from './properties.ts'

/** Los iconos que puede llevar una plantilla (la web los dibuja) */
export const TEMPLATE_ICONS = [
  'user',
  'castle',
  'shield',
  'gem',
  'scroll',
  'calendar',
  'hourglass',
  'flag',
  'swords',
  'crown',
  'skull',
  'map',
  'book',
  'flame',
  'tree',
  'ship',
  'sparkles',
  'template'
] as const

export type TemplateIcon = (typeof TEMPLATE_ICONS)[number]

/** Un bloque del panel de la plantilla (su forma la comprueba el contrato del panel) */
export type TemplateBlock = { id: string; type: string } & Record<string, unknown>

export interface PageTemplate {
  /** El id legible de una de serie («pnj») o el de una propia */
  id: string
  name: string
  icon: TemplateIcon
  /** De cuál se copió */
  basedOn: string | null
  /** Ella y todas de las que viene, de la más cercana a la primera: las tablas casan con cualquiera */
  line: string[]
  builtIn: boolean
  fields: PageProperty[]
  panel: TemplateBlock[]
  skeleton: string
}

/** El linaje de una plantilla: ella y el de la que se copió */
export const lineOf = (id: string, basedOnLine: readonly string[] | null): string[] => [id, ...(basedOnLine ?? [])]

const image = (id: string): TemplateBlock => ({ id, type: 'image', fileId: null, caption: '' })
const text = (field: string, name: string): PageProperty => ({ name, field, type: 'text', value: '' })
const choice = (field: string, name: string, options: string[]): PageProperty => ({
  name,
  field,
  type: 'choice',
  value: '',
  options
})
const link = (field: string, name: string, targets: string[]): PageProperty => ({
  name,
  field,
  type: 'pages',
  single: true,
  targets,
  value: []
})
const links = (field: string, name: string, targets: string[]): PageProperty => ({
  name,
  field,
  type: 'pages',
  targets,
  value: []
})
const number = (field: string, name: string): PageProperty => ({ name, field, type: 'number', value: null })

const builtIn = (template: Omit<PageTemplate, 'basedOn' | 'line' | 'builtIn'>): PageTemplate => ({
  ...template,
  basedOn: null,
  line: [template.id],
  builtIn: true
})

export const BUILT_IN_TEMPLATES: readonly PageTemplate[] = [
  builtIn({
    id: 'pnj',
    name: 'PNJ',
    icon: 'user',
    fields: [
      text('especie', 'Especie'),
      text('rol', 'Rol'),
      link('faccion', 'Facción', ['faccion']),
      link('lugar', 'Lugar', ['lugar']),
      // Sin género: valen para cualquiera (docs/diseno.md)
      choice('estado', 'Estado', ['Vive', 'Ha muerto', 'En paradero desconocido', 'No se sabe']),
      links('padres', 'Padres', ['pnj']),
      links('pareja', 'Pareja', ['pnj'])
    ],
    panel: [image('retrato')],
    skeleton: '## Quién es\n\n## Cómo interpretarlo\n\n## Ganchos\n'
  }),
  builtIn({
    id: 'lugar',
    name: 'Lugar',
    icon: 'castle',
    fields: [
      // De lo más grande a lo más pequeño
      choice('tipo', 'Tipo', [
        'Plano',
        'Continente',
        'Región',
        'Reino',
        'Ciudad',
        'Pueblo',
        'Aldea',
        'Barrio',
        'Edificio',
        'Mazmorra',
        'Paraje'
      ]),
      link('dentro-de', 'Dentro de', ['lugar']),
      number('poblacion', 'Población'),
      link('gobierna', 'Gobierna', ['pnj'])
    ],
    panel: [image('imagen')],
    skeleton: '## Descripción\n\n## Ganchos\n'
  }),
  builtIn({
    id: 'faccion',
    name: 'Facción',
    icon: 'shield',
    fields: [
      choice('tipo', 'Tipo', ['Reino', 'Casa noble', 'Gremio', 'Orden', 'Culto', 'Compañía', 'Banda', 'Tribu']),
      link('lider', 'Líder', ['pnj']),
      link('sede', 'Sede', ['lugar']),
      text('objetivo', 'Objetivo')
    ],
    panel: [image('emblema')],
    skeleton: '## Quiénes son\n\n## Qué quieren\n\n## Ganchos\n'
  }),
  builtIn({
    id: 'objeto',
    name: 'Objeto',
    icon: 'gem',
    fields: [
      choice('tipo', 'Tipo', [
        'Arma',
        'Armadura',
        'Escudo',
        'Poción',
        'Pergamino',
        'Anillo',
        'Varita',
        'Vara',
        'Bastón',
        'Objeto maravilloso',
        'Munición',
        'Herramienta',
        'Equipo',
        'Tesoro'
      ]),
      choice('rareza', 'Rareza', ['Común', 'Poco común', 'Raro', 'Muy raro', 'Legendario', 'Artefacto']),
      { name: 'Sintonización', field: 'sintonizacion', type: 'boolean', value: false },
      text('valor', 'Valor'),
      link('portador', 'Portador', ['pnj'])
    ],
    panel: [image('imagen')],
    skeleton: '## Descripción\n\n## Historia\n'
  }),
  builtIn({
    id: 'mision',
    name: 'Misión',
    icon: 'scroll',
    fields: [
      choice('estado', 'Estado', ['Pendiente', 'En curso', 'Completada', 'Fallida']),
      link('la-da', 'La da', ['pnj', 'faccion']),
      link('lugar', 'Lugar', ['lugar']),
      text('recompensa', 'Recompensa')
    ],
    panel: [],
    skeleton: '## Objetivos\n\n- [ ] Primer objetivo\n\n## Qué pasa\n'
  }),
  builtIn({
    id: 'sesion',
    name: 'Sesión',
    icon: 'calendar',
    fields: [
      number('numero', 'Número'),
      // Como texto hasta el calendario del mundo (módulo 8)
      text('fecha', 'Fecha'),
      links('aparecen', 'Aparecen', ['pnj'])
    ],
    panel: [],
    skeleton: '## Resumen\n\n## Qué pasó\n\n## Pendiente\n'
  })
]

/** Una de serie, por su id */
export const builtInTemplate = (id: string): PageTemplate | undefined => BUILT_IN_TEMPLATES.find((t) => t.id === id)

/** Lo que sale de una plantilla para una página nueva: sus copias (cambiarlas no toca la plantilla) */
export interface Instance {
  template: string
  line: string[]
  properties: PageProperty[]
  panel: TemplateBlock[]
  markdown: string
}

/** Una página nueva desde una plantilla: sus campos, su panel con ids nuevos (newId) y su esqueleto */
export function instantiate(template: PageTemplate, newId: () => string): Instance {
  return {
    template: template.id,
    line: [...template.line],
    properties: structuredClone(template.fields),
    panel: template.panel.map((block) => ({ ...structuredClone(block), id: newId() })),
    markdown: template.skeleton
  }
}

/** Cómo se casa un nombre con un campo: sin espacios de los lados, mayúsculas ni tildes («Faccion» es «Facción») */
export const fieldKey = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('es')

/**
 * Los campos de una plantilla con las propiedades que se dan al crear (la IA, el YAML): cada una va a su campo por su
 * nombre, con el nombre y la forma del campo; los que no se dan, con su valor inicial; las que no son de ningún campo,
 * detrás. Si una no cabe en su campo, cuál
 */
export function fillTemplate(
  fields: readonly PageProperty[],
  given: readonly PageProperty[]
): { properties: PageProperty[] } | { problem: { given: string; field: string } } {
  const byKey = new Map(given.map((property) => [fieldKey(property.name), property]))
  const used = new Set<string>()
  const properties: PageProperty[] = []
  for (const field of fields) {
    const key = fieldKey(field.name)
    const value = byKey.get(key)
    if (!value) {
      properties.push(structuredClone(field))
      continue
    }
    used.add(key)
    const shaped = conformTo(field, value)
    if (!shaped) return { problem: { given: value.name, field: field.name } }
    properties.push({ ...shaped, name: field.name })
  }
  for (const property of given) if (!used.has(fieldKey(property.name))) properties.push(property)
  return { properties }
}
