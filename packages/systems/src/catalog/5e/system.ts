/**
 * El 5e de serie (srd-5e): las reglas que calculan un personaje y una criatura, con el SRD 5.1 (2014) y el 5.2.1
 * (2024) como fuentes que la campaña activa. Términos de las traducciones oficiales de los dos SRD (CC BY 4.0). Las
 * distancias van en pies y los pesos en libras (en español se enseñan en metros y kilos: ×0,3 y ×0,5)
 */
import { FORMAT, type System } from '../../format.ts'

const t = (es: string, en: string) => ({ es, en })
const options = (list: readonly (readonly [string, string, string])[]) =>
  list.map(([value, es, en]) => ({ value, label: t(es, en) }))

export const ABILITIES = [
  ['fue', 'Fuerza', 'Strength', 'FUE', 'STR'],
  ['des', 'Destreza', 'Dexterity', 'DES', 'DEX'],
  ['con', 'Constitución', 'Constitution', 'CON', 'CON'],
  ['int', 'Inteligencia', 'Intelligence', 'INT', 'INT'],
  ['sab', 'Sabiduría', 'Wisdom', 'SAB', 'WIS'],
  ['car', 'Carisma', 'Charisma', 'CAR', 'CHA']
] as const

export const SKILLS = [
  ['acrobacias', 'Acrobacias', 'Acrobatics', 'des'],
  ['atletismo', 'Atletismo', 'Athletics', 'fue'],
  ['conocimiento_arcano', 'Conocimiento arcano', 'Arcana', 'int'],
  ['engano', 'Engaño', 'Deception', 'car'],
  ['historia', 'Historia', 'History', 'int'],
  ['interpretacion', 'Interpretación', 'Performance', 'car'],
  ['intimidacion', 'Intimidación', 'Intimidation', 'car'],
  ['investigacion', 'Investigación', 'Investigation', 'int'],
  ['juego_de_manos', 'Juego de manos', 'Sleight of Hand', 'des'],
  ['medicina', 'Medicina', 'Medicine', 'sab'],
  ['naturaleza', 'Naturaleza', 'Nature', 'int'],
  ['percepcion', 'Percepción', 'Perception', 'sab'],
  ['perspicacia', 'Perspicacia', 'Insight', 'sab'],
  ['persuasion', 'Persuasión', 'Persuasion', 'car'],
  ['religion', 'Religión', 'Religion', 'int'],
  ['sigilo', 'Sigilo', 'Stealth', 'des'],
  ['supervivencia', 'Supervivencia', 'Survival', 'sab'],
  ['trato_con_animales', 'Trato con animales', 'Animal Handling', 'sab']
] as const

export const DAMAGE_TYPES = [
  ['acido', 'Ácido', 'Acid'],
  ['contundente', 'Contundente', 'Bludgeoning'],
  ['cortante', 'Cortante', 'Slashing'],
  ['frio', 'Frío', 'Cold'],
  ['fuego', 'Fuego', 'Fire'],
  ['fuerza', 'Fuerza', 'Force'],
  ['necrotico', 'Necrótico', 'Necrotic'],
  ['perforante', 'Perforante', 'Piercing'],
  ['psiquico', 'Psíquico', 'Psychic'],
  ['radiante', 'Radiante', 'Radiant'],
  ['relampago', 'Relámpago', 'Lightning'],
  ['trueno', 'Trueno', 'Thunder'],
  ['veneno', 'Veneno', 'Poison']
] as const

export const CONDITIONS = [
  ['agarrado', 'Agarrado', 'Grappled'],
  ['apresado', 'Apresado', 'Restrained'],
  ['asustado', 'Asustado', 'Frightened'],
  ['aturdido', 'Aturdido', 'Stunned'],
  ['cansancio', 'Cansancio', 'Exhaustion'],
  ['cegado', 'Cegado', 'Blinded'],
  ['derribado', 'Derribado', 'Prone'],
  ['ensordecido', 'Ensordecido', 'Deafened'],
  ['envenenado', 'Envenenado', 'Poisoned'],
  ['hechizado', 'Hechizado', 'Charmed'],
  ['incapacitado', 'Incapacitado', 'Incapacitated'],
  ['inconsciente', 'Inconsciente', 'Unconscious'],
  ['invisible', 'Invisible', 'Invisible'],
  ['paralizado', 'Paralizado', 'Paralyzed'],
  ['petrificado', 'Petrificado', 'Petrified']
] as const

const SIZES = [
  ['diminuta', 'Diminuta', 'Tiny'],
  ['pequena', 'Pequeña', 'Small'],
  ['mediana', 'Mediana', 'Medium'],
  ['grande', 'Grande', 'Large'],
  ['enorme', 'Enorme', 'Huge'],
  ['gargantuesca', 'Gargantuesca', 'Gargantuan']
] as const

const WEAPON_PROPERTIES = [
  ['municion', 'Munición', 'Ammunition'],
  ['sutil', 'Sutil', 'Finesse'],
  ['pesada', 'Pesada', 'Heavy'],
  ['ligera', 'Ligera', 'Light'],
  ['recarga', 'Recarga', 'Loading'],
  ['alcance', 'Alcance', 'Reach'],
  ['arrojadiza', 'Arrojadiza', 'Thrown'],
  ['a_dos_manos', 'A dos manos', 'Two-Handed'],
  ['versatil', 'Versátil', 'Versatile'],
  ['especial', 'Especial', 'Special']
] as const

const MASTERIES = [
  ['debilitar', 'Debilitar', 'Sap'],
  ['derribar', 'Derribar', 'Topple'],
  ['empujar', 'Empujar', 'Push'],
  ['hender', 'Hender', 'Cleave'],
  ['mellar', 'Mellar', 'Nick'],
  ['molestar', 'Molestar', 'Vex'],
  ['ralentizar', 'Ralentizar', 'Slow'],
  ['rozar', 'Rozar', 'Graze']
] as const

const SCHOOLS = [
  ['abjuracion', 'Abjuración', 'Abjuration'],
  ['adivinacion', 'Adivinación', 'Divination'],
  ['conjuracion', 'Conjuración', 'Conjuration'],
  ['encantamiento', 'Encantamiento', 'Enchantment'],
  ['evocacion', 'Evocación', 'Evocation'],
  ['ilusion', 'Ilusión', 'Illusion'],
  ['nigromancia', 'Nigromancia', 'Necromancy'],
  ['transmutacion', 'Transmutación', 'Transmutation']
] as const

const RARITIES = [
  ['comun', 'Común', 'Common'],
  ['infrecuente', 'Infrecuente', 'Uncommon'],
  ['rara', 'Rara', 'Rare'],
  ['muy_rara', 'Muy rara', 'Very Rare'],
  ['legendaria', 'Legendaria', 'Legendary'],
  ['artefacto', 'Artefacto', 'Artifact']
] as const

const abilityOptions = ABILITIES.map(([value, es, en]) => ({ value, label: t(es, en) }))

/** Los campos de una característica: su puntuación, su modificador, su salvación y lo de lanzar conjuros con ella */
const abilityFields = (bonus: string) => ({
  puntuacion: {
    kind: 'number',
    label: t('Puntuación', 'Score'),
    min: 1,
    max: 30,
    default: 10,
    integer: true
  },
  mod: {
    kind: 'derived',
    label: t('Modificador', 'Modifier'),
    formula: 'floor((@este.puntuacion - 10) / 2)',
    signed: true
  },
  salvacion_grado: {
    kind: 'number',
    label: t('Competencia en la salvación', 'Saving throw proficiency'),
    help: t('1, competente', '1, proficient'),
    min: 0,
    max: 1,
    default: 0
  },
  salvacion: {
    kind: 'derived',
    label: t('Salvación', 'Saving throw'),
    formula: `@este.mod + @este.salvacion_grado * @competencia${bonus}`,
    signed: true
  },
  cd_conjuros: {
    kind: 'derived',
    label: t('CD de salvación de conjuros', 'Spell save DC'),
    formula: '8 + @competencia + @este.mod'
  },
  ataque_conjuros: {
    kind: 'derived',
    label: t('Bonificador de ataque de conjuros', 'Spell attack bonus'),
    formula: '@competencia + @este.mod',
    signed: true
  }
})

const abilities = (bonus: string) => ({
  kind: 'set',
  label: t('Características', 'Abilities'),
  elements: ABILITIES.map(([key, es, en, abes, aben]) => ({ key, label: t(es, en), abbr: t(abes, aben) })),
  fields: abilityFields(bonus)
})

const skills = (bonus: string) => ({
  kind: 'set',
  label: t('Habilidades', 'Skills'),
  elements: SKILLS.map(([key, es, en, car]) => ({ key, label: t(es, en), values: { car } })),
  fields: {
    car: { kind: 'choice', label: t('Característica', 'Ability'), options: abilityOptions, default: 'fue' },
    grado: {
      kind: 'number',
      label: t('Competencia', 'Proficiency'),
      help: t('0,5, media; 1, competente; 2, pericia', '0.5, half; 1, proficient; 2, expertise'),
      min: 0,
      max: 2,
      default: 0
    },
    total: {
      kind: 'derived',
      label: t('Total', 'Total'),
      formula: `@caracteristicas[@este.car].mod + floor(@este.grado * @competencia)${bonus}`,
      signed: true
    }
  }
})

const list = (es: string, en: string, from?: readonly (readonly [string, string, string])[]) => ({
  kind: 'list',
  label: t(es, en),
  ...(from ? { options: options(from) } : {})
})
const number = (es: string, en: string, extra: Record<string, unknown> = {}) => ({
  kind: 'number',
  label: t(es, en),
  default: 0,
  ...extra
})
const derived = (es: string, en: string, formula: string, extra: Record<string, unknown> = {}) => ({
  kind: 'derived',
  label: t(es, en),
  formula,
  ...extra
})
const yesNo = (es: string, en: string) => ({ kind: 'boolean', label: t(es, en) })
const text = (es: string, en: string, extra: Record<string, unknown> = {}) => ({
  kind: 'text',
  label: t(es, en),
  ...extra
})
const description = text('Descripción', 'Description', { lines: 8 })
/** Lo que se lleva: cuánto, cuánto pesa (en libras) y cuánto cuesta (en piezas de oro) */
const goods = {
  cantidad: number('Cantidad', 'Quantity', { min: 0, default: 1, integer: true }),
  peso: number('Peso (lb)', 'Weight (lb)', { min: 0 }),
  peso_total: derived('Peso total', 'Total weight', '@peso * @cantidad'),
  coste: number('Coste (po)', 'Cost (gp)', { min: 0 })
}

/** El cansancio de 2024 resta 2 por nivel a las pruebas d20; el de 2014 va como estado */
const exhaustion = ' - (@ajustes.reglas == "e2024" ? 2 * @cansancio : 0)'

const modes = [
  { key: 'ventaja', label: t('Con ventaja', 'Advantage'), from: '1d20', to: '2d20kh1', gives: 'advantage' },
  { key: 'desventaja', label: t('Con desventaja', 'Disadvantage'), from: '1d20', to: '2d20kl1', gives: 'disadvantage' }
]
const checkBands = [
  { if: '@objetivo != null && @total >= @objetivo', label: t('Éxito', 'Success'), tone: 'success' },
  { if: '@objetivo != null', label: t('Fallo', 'Failure'), tone: 'failure' }
]

/** Una criatura y un personaje comparten lo de las pruebas: características, habilidades, iniciativa y cansancio */
const shared = (bonus: { saves: string; skills: string }) => ({
  caracteristicas: abilities(bonus.saves),
  habilidades: skills(bonus.skills),
  iniciativa: derived('Iniciativa', 'Initiative', '@caracteristicas.des.mod', { signed: true }),
  percepcion_pasiva: derived('Percepción pasiva', 'Passive Perception', '10 + @habilidades.percepcion.total'),
  cansancio: number('Cansancio', 'Exhaustion', { min: 0, max: 6, integer: true }),
  resistencias: list('Resistencias', 'Resistances', DAMAGE_TYPES),
  inmunidades: list('Inmunidades al daño', 'Damage immunities', DAMAGE_TYPES),
  vulnerabilidades: list('Vulnerabilidades', 'Vulnerabilities', DAMAGE_TYPES),
  inmunidades_estados: list('Inmunidades a estados', 'Condition immunities', CONDITIONS),
  sentidos: list('Sentidos', 'Senses'),
  idiomas: list('Idiomas', 'Languages')
})

/** Los espacios de conjuro por nivel de lanzador (la tabla de la multiclase, que es la de un lanzador completo) */
const slots = (level: number, rule: string) => ({
  kind: 'resource',
  label: t(`Espacios de nivel ${level}`, `Level ${level} slots`),
  max: rule.replaceAll('L', '@nivel_lanzador')
})
const SLOT_RULES = [
  'L >= 3 ? 4 : L == 2 ? 3 : L == 1 ? 2 : 0',
  'L >= 4 ? 3 : L == 3 ? 2 : 0',
  'L >= 6 ? 3 : L == 5 ? 2 : 0',
  'L >= 9 ? 3 : L == 8 ? 2 : L == 7 ? 1 : 0',
  'L >= 18 ? 3 : L >= 10 ? 2 : L == 9 ? 1 : 0',
  'L >= 19 ? 2 : L >= 11 ? 1 : 0',
  'L >= 20 ? 2 : L >= 13 ? 1 : 0',
  'L >= 15 ? 1 : 0',
  'L >= 17 ? 1 : 0'
]

const attribution = {
  srd51: t(
    'Esta obra incluye materiales extraídos del Documento de referencia del sistema 5.1 («SRD 5.1») de Wizards of the Coast LLC, que está disponible en https://dnd.wizards.com/es/resources/systems-reference-document. El SRD 5.1 tiene la licencia Creative Commons Atribución/Reconocimiento 4.0 Licencia Pública Internacional, que está disponible en https://creativecommons.org/licenses/by/4.0/legalcode.es.',
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'
  ),
  srd521: t(
    'Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 («SRD 5.2.1») de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.',
    'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'
  )
}

export const fiveE = {
  format: FORMAT,
  id: '5e',
  name: t('5e', '5e'),
  summary: t(
    'Las reglas de quinta edición con el SRD 5.1 (2014) y el 5.2.1 (2024): características, competencias, CA, PG, ataques y conjuros calculados, y su contenido en español y en inglés.',
    'Fifth edition rules with SRD 5.1 (2014) and 5.2.1 (2024): abilities, proficiencies, AC, HP, attacks and spells calculated, with their content in Spanish and English.'
  ),
  version: '1.0',
  languages: ['es', 'en'],
  license: {
    name: t('SRD 5.1 y SRD 5.2.1', 'SRD 5.1 and SRD 5.2.1'),
    license: 'CC BY 4.0',
    attribution: t(
      `${attribution.srd51.es}\n\n${attribution.srd521.es}`,
      `${attribution.srd51.en}\n\n${attribution.srd521.en}`
    )
  },
  types: {
    personaje: {
      document: 'actor',
      label: t('Personaje', 'Character'),
      icon: 'user',
      fields: {
        nivel: derived('Nivel', 'Level', 'max(1, sum(@clases.nivel))'),
        experiencia: number('Experiencia', 'Experience points', { min: 0, integer: true }),
        competencia: derived('Bonificador por competencia', 'Proficiency bonus', 'ceil(@nivel / 4) + 1', {
          signed: true
        }),
        ...shared({ saves: ' + @bono_salvaciones', skills: '' }),
        ca: derived('Clase de armadura', 'Armor Class', '10 + @caracteristicas.des.mod'),
        con_armadura: derived('Con armadura', 'Wearing armor', 'count(@armaduras.puesta) > 0'),
        con_escudo: derived('Con escudo', 'Wielding a shield', 'count(@armaduras.embrazado) > 0'),
        velocidad: number('Velocidad (pies)', 'Speed (feet)', { min: 0, default: 30 }),
        pg_clases: derived('PG de las clases', 'Class hit points', 'sum(@clases.pg)'),
        pg_con: derived('Por la Constitución', 'From Constitution', '@nivel * @caracteristicas.con.mod'),
        pg_max: derived('Puntos de golpe máximos', 'Hit point maximum', '@pg_clases + @pg_con'),
        pg: { kind: 'resource', label: t('Puntos de golpe', 'Hit points'), max: '@pg_max' },
        pg_temporales: number('Puntos de golpe temporales', 'Temporary hit points', { min: 0 }),
        salvaciones_muerte: {
          kind: 'group',
          label: t('Salvaciones contra muerte', 'Death saving throws'),
          fields: {
            exitos: number('Éxitos', 'Successes', { min: 0, max: 3, integer: true }),
            fallos: number('Fallos', 'Failures', { min: 0, max: 3, integer: true })
          }
        },
        inspiracion: yesNo('Inspiración heroica', 'Heroic Inspiration'),
        // Lanzar conjuros: la característica de la primera clase que lanza, su CD, su ataque y sus espacios
        caracteristica_conjuros: derived(
          'Característica para lanzar conjuros',
          'Spellcasting ability',
          'first(@clases.lanzamiento)'
        ),
        cd_conjuros: derived(
          'CD de salvación de conjuros',
          'Spell save DC',
          '(@caracteristica_conjuros != null ? @caracteristicas[@caracteristica_conjuros].cd_conjuros : 8 + @competencia) + @bono_cd_conjuros'
        ),
        ataque_conjuros: derived(
          'Bonificador de ataque de conjuros',
          'Spell attack bonus',
          '(@caracteristica_conjuros != null ? @caracteristicas[@caracteristica_conjuros].ataque_conjuros : @competencia) + @bono_ataque_conjuros',
          { signed: true }
        ),
        nivel_lanzador: number('Nivel de lanzador', 'Spellcaster level', {
          min: 0,
          help: t('Lo suman las clases que lanzan conjuros', 'Added by the spellcasting classes')
        }),
        espacios: {
          kind: 'group',
          label: t('Espacios de conjuro', 'Spell slots'),
          fields: Object.fromEntries(SLOT_RULES.map((rule, i) => [`n${i + 1}`, slots(i + 1, rule)]))
        },
        // La magia de pacto: la ponen sus clases
        pacto_espacios: number('Espacios de pacto', 'Pact slots', { min: 0 }),
        pacto_nivel: number('Nivel de los espacios de pacto', 'Pact slot level', { min: 0, max: 9 }),
        pacto: { kind: 'resource', label: t('Magia de pacto', 'Pact Magic'), max: '@pacto_espacios' },
        // Lo que suman los efectos a muchos sitios a la vez (el anillo, la Furia, un estilo de combate)
        bono_salvaciones: number('Bono a las salvaciones', 'Saving throw bonus'),
        bono_ataque_cac: number('Bono al ataque cuerpo a cuerpo', 'Melee attack bonus'),
        bono_ataque_distancia: number('Bono al ataque a distancia', 'Ranged attack bonus'),
        bono_dano_cac: number('Bono al daño cuerpo a cuerpo', 'Melee damage bonus'),
        bono_dano_distancia: number('Bono al daño a distancia', 'Ranged damage bonus'),
        bono_dano_fue: number('Bono al daño con Fuerza', 'Strength damage bonus'),
        bono_cd_conjuros: number('Bono a la CD de conjuros', 'Spell save DC bonus'),
        bono_ataque_conjuros: number('Bono al ataque de conjuros', 'Spell attack bonus bonus'),
        competencias_armas: list('Competencia con armas', 'Weapon proficiencies'),
        competencias_armaduras: list('Competencia con armaduras', 'Armor training'),
        competencias_herramientas: list('Competencia con herramientas', 'Tool proficiencies'),
        monedas: {
          kind: 'group',
          label: t('Monedas', 'Coins'),
          fields: {
            pc: number('Cobre', 'Copper', { min: 0, integer: true }),
            pp: number('Plata', 'Silver', { min: 0, integer: true }),
            pe: number('Electro', 'Electrum', { min: 0, integer: true }),
            po: number('Oro', 'Gold', { min: 0, integer: true }),
            ppt: number('Platino', 'Platinum', { min: 0, integer: true })
          }
        },
        carga: derived('Carga (lb)', 'Load (lb)', 'sum(@inventario.peso_total)'),
        capacidad: derived('Capacidad de carga (lb)', 'Carrying capacity (lb)', '@caracteristicas.fue.puntuacion * 15'),
        clases: { kind: 'items', label: t('Clases', 'Classes'), of: ['clase'] },
        armaduras: { kind: 'items', label: t('Armaduras', 'Armor'), of: ['armadura'] },
        inventario: {
          kind: 'items',
          label: t('Inventario', 'Inventory'),
          of: ['arma', 'armadura', 'equipo', 'objeto_magico']
        },
        rasgos: {
          kind: 'items',
          label: t('Rasgos', 'Features'),
          of: ['subclase', 'especie', 'trasfondo', 'dote', 'rasgo']
        },
        conjuros: { kind: 'items', label: t('Conjuros', 'Spells'), of: ['conjuro'] },
        estados: { kind: 'items', label: t('Estados', 'Conditions'), of: ['estado'] },
        notas: text('Notas', 'Notes', { lines: 6 })
      }
    },
    criatura: {
      document: 'actor',
      label: t('Criatura', 'Creature'),
      icon: 'skull',
      fields: {
        tamano: { kind: 'choice', label: t('Tamaño', 'Size'), options: options(SIZES), default: 'mediana' },
        tipo: text('Tipo', 'Type'),
        alineamiento: text('Alineamiento', 'Alignment'),
        vd: number('Valor de desafío', 'Challenge rating', { min: 0, max: 30 }),
        px: number('Puntos de experiencia', 'Experience points', { min: 0, integer: true }),
        competencia: derived('Bonificador por competencia', 'Proficiency bonus', 'max(2, ceil(@vd / 4) + 1)', {
          signed: true
        }),
        ...shared({ saves: '', skills: '' }),
        ca: number('Clase de armadura', 'Armor Class', { min: 0, default: 10 }),
        pg_max: number('Puntos de golpe máximos', 'Hit point maximum', { min: 0, default: 1 }),
        pg: { kind: 'resource', label: t('Puntos de golpe', 'Hit points'), max: '@pg_max' },
        dados_golpe: { kind: 'dice', label: t('Dados de golpe', 'Hit dice') },
        velocidad: number('Velocidad (pies)', 'Speed (feet)', { min: 0, default: 30 }),
        velocidades: text('Otras velocidades', 'Other speeds'),
        lleva: {
          kind: 'items',
          label: t('Lo que lleva', 'Gear'),
          of: ['arma', 'armadura', 'equipo', 'objeto_magico', 'rasgo', 'conjuro', 'estado']
        },
        descripcion: description
      }
    },
    clase: {
      document: 'item',
      label: t('Clase', 'Class'),
      icon: 'shield',
      fields: {
        nivel: number('Nivel', 'Level', { min: 1, max: 20, default: 1, integer: true }),
        inicial: yesNo('Su primera clase', 'Starting class'),
        dado: number('Dado de golpe (caras)', 'Hit die (sides)', { min: 4, max: 12, default: 8, integer: true }),
        dado_golpe: { kind: 'dice', label: t('Dado de golpe', 'Hit die'), default: '1d8' },
        dados_usados: number('Dados de golpe gastados', 'Hit dice spent', { min: 0, integer: true }),
        pg: derived(
          'Puntos de golpe de la clase',
          'Class hit points',
          '@inicial ? @dado + (@nivel - 1) * (floor(@dado / 2) + 1) : @nivel * (floor(@dado / 2) + 1)'
        ),
        lanzamiento: text('Característica para lanzar conjuros', 'Spellcasting ability', {
          default: '',
          help: t('int, sab o car; vacía, si no lanza', 'int, sab or car; empty if it does not cast')
        }),
        descripcion: description
      }
    },
    subclase: {
      document: 'item',
      label: t('Subclase', 'Subclass'),
      icon: 'shield',
      fields: { clase: text('Su clase', 'Its class'), descripcion: description }
    },
    especie: {
      document: 'item',
      label: t('Especie', 'Species'),
      icon: 'user',
      fields: {
        tamano: { kind: 'choice', label: t('Tamaño', 'Size'), options: options(SIZES), default: 'mediana' },
        descripcion: description
      }
    },
    trasfondo: {
      document: 'item',
      label: t('Trasfondo', 'Background'),
      icon: 'scroll',
      fields: { descripcion: description }
    },
    dote: {
      document: 'item',
      label: t('Dote', 'Feat'),
      icon: 'sparkles',
      fields: {
        categoria: text('Categoría', 'Category'),
        requisito: text('Requisito', 'Prerequisite'),
        repetible: yesNo('Se puede elegir más de una vez', 'Repeatable'),
        descripcion: description
      }
    },
    rasgo: {
      document: 'item',
      label: t('Rasgo', 'Feature'),
      icon: 'star',
      fields: {
        origen: text('De dónde sale', 'Source'),
        nivel: number('Nivel', 'Level', { min: 0, max: 20, integer: true }),
        activo: yesNo('Activo', 'Active'),
        descripcion: description
      }
    },
    conjuro: {
      document: 'item',
      label: t('Conjuro', 'Spell'),
      icon: 'flame',
      fields: {
        nivel: number('Nivel', 'Level', { min: 0, max: 9, integer: true }),
        escuela: { kind: 'choice', label: t('Escuela', 'School'), options: options(SCHOOLS), default: 'abjuracion' },
        tiempo: text('Tiempo de lanzamiento', 'Casting time'),
        alcance: text('Alcance', 'Range'),
        componentes: text('Componentes', 'Components'),
        duracion: text('Duración', 'Duration'),
        concentracion: yesNo('Concentración', 'Concentration'),
        ritual: yesNo('Ritual', 'Ritual'),
        clases: list('Clases', 'Classes'),
        preparado: yesNo('Preparado', 'Prepared'),
        activo: yesNo('Activo', 'Active'),
        caracteristica: text('Característica para lanzarlo', 'Spellcasting ability', {
          default: '',
          help: t('Vacía: la del personaje', 'Empty: the character’s')
        }),
        cd: derived(
          'CD de salvación',
          'Save DC',
          '@caracteristica != "" ? @portador.caracteristicas[@caracteristica].cd_conjuros + @portador.bono_cd_conjuros : @portador.cd_conjuros'
        ),
        ataque: derived(
          'Bonificador de ataque',
          'Attack bonus',
          '@caracteristica != "" ? @portador.caracteristicas[@caracteristica].ataque_conjuros + @portador.bono_ataque_conjuros : @portador.ataque_conjuros',
          { signed: true }
        ),
        descripcion: description
      }
    },
    arma: {
      document: 'item',
      label: t('Arma', 'Weapon'),
      icon: 'sword',
      fields: {
        categoria: {
          kind: 'choice',
          label: t('Categoría', 'Category'),
          options: options([
            ['sencilla', 'Sencilla', 'Simple'],
            ['marcial', 'Marcial', 'Martial']
          ]),
          default: 'sencilla'
        },
        base: text('Arma', 'Weapon type', {
          help: t('La de las competencias (espada_larga)', 'For proficiency (longsword)')
        }),
        distancia: yesNo('A distancia', 'Ranged'),
        propiedades: list('Propiedades', 'Properties', WEAPON_PROPERTIES),
        maestria: {
          kind: 'choice',
          label: t('Maestría', 'Mastery'),
          options: options(MASTERIES),
          default: 'debilitar'
        },
        dano: { kind: 'dice', label: t('Daño', 'Damage'), default: '1d4' },
        dano_versatil: { kind: 'dice', label: t('Daño a dos manos', 'Two-handed damage') },
        tipo_dano: {
          kind: 'choice',
          label: t('Tipo de daño', 'Damage type'),
          options: options(DAMAGE_TYPES),
          default: 'contundente'
        },
        alcance_distancia: text('Distancia (pies)', 'Range (feet)'),
        bono: number('Bono mágico', 'Magic bonus'),
        equipado: yesNo('Equipada', 'Equipped'),
        ...goods,
        competente: derived(
          'Competente',
          'Proficient',
          'has(@portador.competencias_armas, @categoria) || has(@portador.competencias_armas, @base)'
        ),
        caracteristica: derived(
          'Característica',
          'Ability',
          '@distancia ? "des" : has(@propiedades, "sutil") && @portador.caracteristicas.des.mod > @portador.caracteristicas.fue.mod ? "des" : "fue"'
        ),
        ataque: derived(
          'Bonificador de ataque',
          'Attack bonus',
          '@portador.caracteristicas[@caracteristica].mod + (@competente ? @portador.competencia : 0) + @bono + (@distancia ? @portador.bono_ataque_distancia : @portador.bono_ataque_cac)',
          { signed: true }
        ),
        dano_bono: derived(
          'Bono al daño',
          'Damage bonus',
          '@portador.caracteristicas[@caracteristica].mod + @bono + (@distancia ? @portador.bono_dano_distancia : @portador.bono_dano_cac) + (@caracteristica == "fue" ? @portador.bono_dano_fue : 0)',
          { signed: true }
        ),
        descripcion: description
      }
    },
    armadura: {
      document: 'item',
      label: t('Armadura', 'Armor'),
      icon: 'shield',
      fields: {
        categoria: {
          kind: 'choice',
          label: t('Categoría', 'Category'),
          options: options([
            ['ligera', 'Ligera', 'Light'],
            ['media', 'Media', 'Medium'],
            ['pesada', 'Pesada', 'Heavy'],
            ['escudo', 'Escudo', 'Shield']
          ]),
          default: 'ligera'
        },
        ca_base: number('CA', 'AC', { min: 0, default: 10 }),
        suma_des: yesNo('Suma la Destreza', 'Adds Dexterity'),
        des_max: number('Destreza, como mucho', 'Dexterity, at most', {
          min: 0,
          help: t('0: sin tope', '0: no limit')
        }),
        fuerza: number('Fuerza necesaria', 'Strength required', { min: 0 }),
        sigilo_desventaja: yesNo('Desventaja en Sigilo', 'Stealth disadvantage'),
        bono: number('Bono mágico', 'Magic bonus'),
        equipado: yesNo('Puesta', 'Worn'),
        ...goods,
        escudo: derived('Es un escudo', 'Is a shield', '@categoria == "escudo"'),
        puesta: derived('Puesta', 'Worn', '@equipado && @categoria != "escudo"'),
        embrazado: derived('Embrazado', 'Wielded', '@equipado && @categoria == "escudo"'),
        ca: derived(
          'CA con quien la lleva',
          'AC with its wearer',
          '@ca_base + @bono + (@suma_des ? (@des_max > 0 ? min(@portador.caracteristicas.des.mod, @des_max) : @portador.caracteristicas.des.mod) : 0)'
        ),
        descripcion: description
      }
    },
    equipo: {
      document: 'item',
      label: t('Equipo', 'Gear'),
      icon: 'backpack',
      fields: {
        categoria: text('Categoría', 'Category'),
        equipado: yesNo('Equipado', 'Equipped'),
        ...goods,
        descripcion: description
      }
    },
    objeto_magico: {
      document: 'item',
      label: t('Objeto mágico', 'Magic item'),
      icon: 'gem',
      fields: {
        tipo: text('Tipo', 'Type'),
        rareza: { kind: 'choice', label: t('Rareza', 'Rarity'), options: options(RARITIES), default: 'comun' },
        sintonia: yesNo('Requiere sintonización', 'Requires attunement'),
        sintonizado: yesNo('Sintonizado', 'Attuned'),
        equipado: yesNo('Equipado', 'Equipped'),
        activo: yesNo('Activo', 'Active'),
        ...goods,
        descripcion: description
      }
    },
    estado: {
      document: 'item',
      label: t('Estado', 'Condition'),
      icon: 'zap',
      fields: {
        activo: { kind: 'boolean', label: t('Activo', 'Active'), default: true },
        nivel: number('Nivel', 'Level', { min: 0, max: 6, integer: true }),
        descripcion: description
      }
    },
    regla: {
      document: 'item',
      label: t('Regla', 'Rule'),
      icon: 'book',
      fields: { capitulo: text('Capítulo', 'Chapter'), descripcion: description }
    }
  },
  rolls: {
    prueba: {
      label: t('Prueba de característica', 'Ability check'),
      formula: `1d20 + @este.mod${exhaustion}`,
      for: { set: 'caracteristicas' },
      target: 'optional',
      bands: checkBands,
      modes
    },
    salvacion: {
      label: t('Tirada de salvación', 'Saving throw'),
      formula: `1d20 + @este.salvacion${exhaustion}`,
      for: { set: 'caracteristicas' },
      target: 'optional',
      bands: checkBands,
      modes
    },
    habilidad: {
      label: t('Prueba de habilidad', 'Skill check'),
      formula: `1d20 + @este.total${exhaustion}`,
      for: { set: 'habilidades' },
      target: 'optional',
      bands: checkBands,
      modes
    },
    iniciativa: { label: t('Iniciativa', 'Initiative'), formula: `1d20 + @iniciativa${exhaustion}`, modes },
    ataque: {
      label: t('Ataque', 'Attack'),
      formula: `1d20 + @este.ataque${exhaustion}`,
      for: { items: ['arma'] },
      target: 'optional',
      bands: [
        { if: '@natural == 20', label: t('Crítico', 'Critical hit'), tone: 'critical' },
        { if: '@natural == 1', label: t('Fallo', 'Miss'), tone: 'fumble' },
        { if: '@objetivo != null && @total >= @objetivo', label: t('Impacta', 'Hit'), tone: 'success' },
        { if: '@objetivo != null', label: t('Falla', 'Miss'), tone: 'failure' }
      ],
      modes
    },
    dano: {
      label: t('Daño', 'Damage'),
      formula: '@este.dano + @este.dano_bono',
      for: { items: ['arma'] }
    },
    dano_dos_manos: {
      label: t('Daño a dos manos', 'Two-handed damage'),
      formula:
        '(@este.dano_versatil != null && @este.dano_versatil != "" ? @este.dano_versatil : @este.dano) + @este.dano_bono',
      for: { items: ['arma'] }
    },
    salvacion_muerte: {
      label: t('Salvación contra muerte', 'Death saving throw'),
      formula: '1d20',
      bands: [
        { if: '@natural == 20', label: t('Recupera 1 PG', 'Regain 1 HP'), tone: 'critical' },
        { if: '@natural == 1', label: t('Dos fallos', 'Two failures'), tone: 'fumble' },
        { if: '@total >= 10', label: t('Éxito', 'Success'), tone: 'success' },
        { if: 'true', label: t('Fallo', 'Failure'), tone: 'failure' }
      ],
      modes
    },
    dado_golpe: {
      label: t('Dado de golpe', 'Hit die'),
      formula: '@este.dado_golpe + @caracteristicas.con.mod',
      for: { items: ['clase'] }
    }
  },
  dice: { default: '1d20', critical: 'd20' },
  sources: [
    {
      key: 'srd51',
      name: 'SRD 5.1',
      license: 'CC BY 4.0',
      attribution: attribution.srd51,
      url: 'https://dnd.wizards.com/resources/systems-reference-document',
      edition: '2014',
      publisher: 'Wizards of the Coast',
      released: '2023-01-27'
    },
    {
      key: 'srd521',
      name: 'SRD 5.2.1',
      license: 'CC BY 4.0',
      attribution: attribution.srd521,
      url: 'https://www.dndbeyond.com/srd',
      edition: '2024',
      publisher: 'Wizards of the Coast',
      released: '2025-04-22'
    }
  ],
  packs: [],
  settings: {
    reglas: {
      label: t('Reglas generales', 'General rules'),
      help: t(
        'El cansancio, los dados de golpe al descansar, la sorpresa y lo demás que cambió.',
        'Exhaustion, hit dice on a rest, surprise and everything else that changed.'
      ),
      kind: 'choice',
      options: [
        { value: 'e2024', label: '2024' },
        { value: 'e2014', label: '2014' }
      ],
      default: 'e2024'
    },
    multiclase_mixta: {
      label: t('Multiclase con clases de las dos ediciones', 'Multiclassing across both editions'),
      kind: 'boolean',
      default: false
    }
  }
} as unknown as System
