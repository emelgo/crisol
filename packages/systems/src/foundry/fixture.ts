/**
 * Un sistema de Foundry pequeño, hecho a mano para las pruebas del importador: armas y un conjuro (objetos), una
 * criatura con lo que lleva (actor), un diario de dos páginas, una tabla de tirar y un paquete de efectos (que no se
 * trae). Con la forma de los documentos de Foundry VTT, sin nada copiado de ningún sistema
 */
import type { FoundryInput } from './convert.ts'
import { type FoundryPackDef, readManifest } from './manifest.ts'

const weapon = (id: string, name: string, damage: number, weight: number, kind: string, folder: string | null) => ({
  _id: id,
  name,
  type: 'weapon',
  folder,
  img: 'icons/weapons/sword.webp',
  system: {
    description: { value: `<p>Una <strong>${name.toLowerCase()}</strong> de buen acero.</p>` },
    source: { book: 'Libro', page: '12' },
    damage: { dice: `1d${damage}`, versatile: '' },
    weight,
    kind,
    finesse: kind === 'ligera',
    tags: ['metal', kind],
    price: { value: weight * 5, denomination: 'po' },
    activities: { abcdefGHIJ123456: { type: 'attack' } }
  }
})

/** El manifiesto y los paquetes, como los da la lectura del zip */
export function foundryFixture(): FoundryInput {
  const manifest = readManifest(
    {
      id: 'mazmorra',
      title: 'Mazmorra',
      version: '2.1.0',
      description: '<p>Un juego de <em>prueba</em>.</p>',
      license: 'MIT',
      documentTypes: { Actor: { monstruo: { htmlFields: ['notas.publicas'] } } },
      packs: [
        { name: 'efectos', label: 'Efectos', type: 'ActiveEffect', path: 'packs/efectos' },
        { name: 'armas', label: 'Armas', type: 'Item', path: 'packs/armas' },
        { name: 'conjuros', label: 'Conjuros', type: 'Item', path: 'packs/conjuros' },
        { name: 'monstruos', label: 'Monstruos', type: 'Actor', path: 'packs/monstruos' },
        { name: 'reglas', label: 'Reglas', type: 'JournalEntry', path: 'packs/reglas' },
        { name: 'tablas', label: 'Tablas', type: 'RollTable', path: 'packs/tablas' }
      ],
      packFolders: [{ name: 'Reglas', packs: ['reglas', 'tablas'] }],
      flags: {
        compendiumArtMappings: {
          mazmorra: {
            mapping: 'systems/mazmorra/json/arte.json',
            credit: '<em>Fichas de <a href="#">Alguien</a>.</em>'
          }
        }
      }
    },
    'system'
  )
  const def = (name: string) => manifest.packs.find((p) => p.name === name) as FoundryPackDef
  return {
    manifest,
    language: 'es',
    // El mapa de arte del manifiesto, ya leído: el retrato de cada actor por su paquete y su id
    art: {
      credit: 'Fichas de Alguien.',
      map: { 'mazmorra.monstruos': { monstruo00000001: { actor: 'systems/mazmorra/tokens/trasgo.webp' } } }
    },
    names: { 'TYPES.Item.weapon': 'Arma', 'TYPES.Item.weaponPl': 'Armas', 'TYPES.Actor.monstruo': 'Monstruo' },
    packs: [
      { ...def('efectos'), documents: [{ _id: 'efecto0000000001', name: 'Aturdido' }], folders: [] },
      {
        ...def('armas'),
        folders: [
          { _id: 'carpetaSencillas', name: 'Sencillas' },
          { _id: 'carpetaMarciales', name: 'Marciales' }
        ],
        documents: [
          weapon('arma000000000001', 'Daga', 4, 1, 'ligera', 'carpetaSencillas'),
          weapon('arma000000000002', 'Espada larga', 8, 3, 'marcial', 'carpetaMarciales'),
          weapon('arma000000000003', 'Hacha', 6, 2, 'marcial', 'carpetaMarciales'),
          weapon('arma000000000004', 'Maza', 6, 4, 'sencilla', 'carpetaSencillas'),
          weapon('arma000000000005', 'Espada corta', 6, 2, 'ligera', 'carpetaMarciales'),
          weapon('arma000000000006', 'Lanza', 6, 3, 'sencilla', null)
        ]
      },
      {
        ...def('conjuros'),
        folders: [],
        documents: [
          {
            _id: 'conjuro000000001',
            name: 'Bola de fuego',
            type: 'spell',
            img: 'systems/mazmorra/icons/fuego.webp',
            system: {
              description: {
                value:
                  '<p>Una explosión. Cada criatura hace una [[/save dex dc=15]] o recibe [[/damage 8d6 type=fire]].</p><p>Ver @UUID[Compendium.mazmorra.reglas.JournalEntry.diario0000000001]{Combate} y @UUID[Compendium.mazmorra.reglas.JournalEntry.diario0000000001].</p>'
              },
              level: 3
            }
          }
        ]
      },
      {
        ...def('monstruos'),
        folders: [],
        documents: [
          {
            _id: 'monstruo00000001',
            name: 'Trasgo',
            type: 'monstruo',
            img: 'icons/svg/mystery-man.svg',
            system: { notas: { publicas: '<p>Pequeño y [[lookup @name lowercase]].</p>' }, pg: { max: 7 }, cr: 0.25 },
            items: [
              {
                _id: 'cimitarra0000001',
                name: 'Cimitarra',
                type: 'weapon',
                system: { description: { value: '<p>[[/r 1d6+2]] de daño cortante.</p>' } }
              },
              { _id: 'huida00000000001', name: 'Huida ágil', type: 'feat', system: { description: { value: '' } } }
            ]
          }
        ]
      },
      {
        ...def('reglas'),
        folders: [],
        documents: [
          {
            _id: 'diario0000000001',
            name: 'Combate',
            pages: [
              {
                _id: 'pagina0000000002',
                name: 'Atacar',
                sort: 200,
                type: 'text',
                text: { content: '<p>Tira 1d20.</p>' }
              },
              {
                _id: 'pagina0000000001',
                name: 'El turno',
                sort: 100,
                type: 'text',
                text: { content: '<h2>Orden</h2><ul><li>Moverse</li><li>Actuar</li></ul>' }
              },
              { _id: 'pagina0000000003', name: 'Mapa', sort: 300, type: 'image', src: 'mapa.webp' }
            ]
          }
        ]
      },
      {
        ...def('tablas'),
        folders: [],
        documents: [
          {
            _id: 'tabla00000000001',
            name: 'Botín',
            formula: '1d8 ',
            replacement: false,
            description: '<p>Lo que llevan.</p>',
            results: [
              { _id: 'r3', type: 'text', range: [5, 6], text: '<p>Una <em>gema</em></p>' },
              { _id: 'r1', type: 'text', range: [1, 3], text: 'Nada | vacío' },
              {
                _id: 'r2',
                type: 'document',
                range: [4, 4],
                name: 'Daga',
                documentUuid: 'Compendium.prueba.armas.Item.arma000000000001'
              },
              {
                _id: 'r4',
                type: 'document',
                range: [7, 8],
                name: 'Espada de otro',
                documentUuid: 'Compendium.otro.armas.Item.zzzzzzzzzzzzzzzz'
              }
            ]
          }
        ]
      }
    ]
  }
}
