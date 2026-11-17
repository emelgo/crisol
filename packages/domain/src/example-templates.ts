/**
 * Plantillas de ejemplo, solo para las pruebas y la API falsa de la web: las que fueron de serie hasta la tanda 3 de la
 * revisión (ADR-0024; la migración 0077 convirtió en propias las que estaban en uso). Sus ids legibles («pnj») no son
 * los de una plantilla de verdad (un uuid): el servidor las encuentra también por su nombre
 */
import type { PageProperty, RelationRole } from './properties.ts'
import type { PageTemplate, TemplateBlock } from './templates.ts'

const image = (id: string): TemplateBlock => ({ id, type: 'image', fileId: null, caption: '' })
/** Una tabla que se llena sola: las páginas de la plantilla template cuyo campo field apunta a esta */
const table = (id: string, title: string, template: string, field: string, columns: string[]): TemplateBlock => ({
  id,
  type: 'related',
  title,
  template,
  field,
  columns,
  sort: 'title'
})
const text = (field: string, name: string): PageProperty => ({ name, field, type: 'text', value: '' })
const choice = (field: string, name: string, options: string[]): PageProperty => ({
  name,
  field,
  type: 'choice',
  value: '',
  options
})
/** Su papel en las relaciones y cómo se lee al revés (módulo 10) */
type Relation = { role?: RelationRole; inverseName?: string }
const link = (field: string, name: string, targets: string[], relation: Relation = {}): PageProperty => ({
  name,
  field,
  type: 'pages',
  single: true,
  targets,
  ...relation,
  value: []
})
const links = (field: string, name: string, targets: string[], relation: Relation = {}): PageProperty => ({
  name,
  field,
  type: 'pages',
  targets,
  ...relation,
  value: []
})
const number = (field: string, name: string): PageProperty => ({ name, field, type: 'number', value: null })

const example = (template: Omit<PageTemplate, 'basedOn' | 'line'>): PageTemplate => ({
  ...template,
  basedOn: null,
  line: [template.id]
})

export const EXAMPLE_TEMPLATES: readonly PageTemplate[] = [
  example({
    id: 'pnj',
    name: 'PNJ',
    icon: '🧙',
    fields: [
      text('especie', 'Especie'),
      text('rol', 'Rol'),
      link('faccion', 'Facción', ['faccion'], { role: 'member-of', inverseName: 'Miembros' }),
      link('lugar', 'Lugar', ['lugar']),
      // Sin género: valen para cualquiera (docs/diseno.md)
      choice('estado', 'Estado', ['Vive', 'Ha muerto', 'En paradero desconocido', 'No se sabe']),
      links('padres', 'Padres', ['pnj'], { role: 'parent', inverseName: 'Hijos' }),
      links('pareja', 'Pareja', ['pnj'], { role: 'partner', inverseName: 'Pareja' })
    ],
    panel: [image('retrato'), table('llevaencima', 'Lleva encima', 'objeto', 'portador', ['tipo', 'rareza'])],
    skeleton: '## Quién es\n\n## Cómo interpretarlo\n\n## Ganchos\n'
  }),
  example({
    id: 'lugar',
    name: 'Lugar',
    icon: '🏰',
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
      link('dentro-de', 'Dentro de', ['lugar'], { inverseName: 'Contiene' }),
      number('poblacion', 'Población'),
      link('gobierna', 'Gobierna', ['pnj'])
    ],
    panel: [
      image('imagen'),
      table('lugaresdentro', 'Lugares dentro', 'lugar', 'dentro-de', ['tipo']),
      table('habitantes', 'Habitantes', 'pnj', 'lugar', ['rol', 'estado'])
    ],
    skeleton: '## Descripción\n\n## Ganchos\n'
  }),
  example({
    id: 'faccion',
    name: 'Facción',
    icon: '🛡️',
    fields: [
      choice('tipo', 'Tipo', ['Reino', 'Casa noble', 'Gremio', 'Orden', 'Culto', 'Compañía', 'Banda', 'Tribu']),
      link('lider', 'Líder', ['pnj'], { role: 'leads', inverseName: 'Dirige' }),
      link('sede', 'Sede', ['lugar'], { inverseName: 'Sede de' }),
      text('objetivo', 'Objetivo')
    ],
    panel: [image('emblema'), table('miembros', 'Miembros', 'pnj', 'faccion', ['rol', 'estado'])],
    skeleton: '## Quiénes son\n\n## Qué quieren\n\n## Ganchos\n'
  }),
  example({
    id: 'objeto',
    name: 'Objeto',
    icon: '💎',
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
      link('portador', 'Portador', ['pnj'], { inverseName: 'Lleva encima' })
    ],
    panel: [image('imagen')],
    skeleton: '## Descripción\n\n## Historia\n'
  }),
  example({
    id: 'mision',
    name: 'Misión',
    icon: '📜',
    fields: [
      choice('estado', 'Estado', ['Pendiente', 'En curso', 'Completada', 'Fallida']),
      link('la-da', 'La da', ['pnj', 'faccion']),
      link('lugar', 'Lugar', ['lugar']),
      text('recompensa', 'Recompensa')
    ],
    panel: [],
    skeleton: '## Objetivos\n\n- [ ] Primer objetivo\n\n## Qué pasa\n'
  }),
  example({
    id: 'sesion',
    name: 'Sesión',
    icon: '📅',
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
