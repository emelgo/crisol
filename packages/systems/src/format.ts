/**
 * El formato de un sistema de reglas (ADR-0011): datos, con la forma del manifiesto de Foundry (tipos por clase de
 * documento, paquetes, idiomas), y lo propio de Crisol: fórmulas, tiradas, dados y ajustes de campaña. Las claves del
 * formato van en inglés; las de cada sistema (sus tipos, campos y tiradas), las que elija quien lo hace.
 *
 * El esquema se construye dos veces: el flexible conserva lo que no conoce (se guarda tal cual) y el estricto solo sirve
 * para avisar de ello
 */
import { z } from 'zod'
import { LANGUAGES, type Text, text } from './text.ts'

/** La versión del formato: sube si un cambio obliga a convertir los sistemas guardados */
export const FORMAT = 1

/** Lo que cabe en un sistema */
export const LIMITS = {
  /** El documento entero, en bytes de JSON */
  bytes: 2 * 1024 * 1024,
  fieldsPerType: 500,
  types: 100,
  rolls: 200,
  /** Grupos dentro de grupos (y columnas de una lista) */
  depth: 3,
  formula: 2000,
  contentDocuments: 5000,
  contentBytes: 64 * 1024,
  /** Los pasos del creador */
  steps: 20
} as const

/** Una clave de un sistema: la de un tipo, un campo, una tirada… No cambia aunque cambie su nombre */
export const KEY = /^[a-z][a-z0-9_]{0,59}$/
export const KEY_MESSAGE = 'Una clave va en minúsculas, sin espacios ni tildes, como «defensa» o «bono_ataque»'
const key = z.string().regex(KEY, KEY_MESSAGE)
const formula = z.string().trim().min(1).max(LIMITS.formula).describe('fórmula')
const recordOf = <T extends z.ZodType>(value: T, max: number) =>
  z.record(key, value).refine((r) => Object.keys(r).length <= max, `Como mucho, ${max}`)

/** Cómo suena una franja de resultado: la interfaz le da su color */
export const TONES = ['critical', 'success', 'partial', 'failure', 'fumble', 'neutral'] as const
/** Cuándo una tirada es crítica (ADR-0010 lo dejó para cada sistema) */
export const CRITICAL_RULES = ['none', 'd20', 'doubles', 'under'] as const

interface FieldBase {
  label: Text
  help?: Text
  /** Solo lo ve el máster */
  master?: boolean
  /** Se cambia jugando, desde la hoja (las monedas, la inspiración, las notas); los recursos, siempre */
  play?: boolean
}

/** Las clases de campo que caben en una columna o dentro de un conjunto */
export type SimpleField = FieldBase &
  (
    | { kind: 'text'; default?: string; max?: number; lines?: number }
    | { kind: 'number'; default?: number; min?: number; max?: number; integer?: boolean }
    | { kind: 'boolean'; default?: boolean }
    | { kind: 'list'; default?: string[]; max?: number; options?: { value: string; label: Text }[] }
    | { kind: 'choice'; options: { value: string; label: Text }[]; default?: string }
    | { kind: 'link'; to: string; multiple?: boolean }
    | { kind: 'clock'; segments: number; default?: number }
    | { kind: 'dice'; default?: string }
    | { kind: 'resource'; max?: number | string; default?: number; recovery?: 'short' | 'long'; roll?: string }
    | { kind: 'derived'; formula: string; signed?: boolean }
  )

export type Field =
  | SimpleField
  | (FieldBase & { kind: 'group'; fields: Record<string, Field> })
  | (FieldBase & { kind: 'table'; columns: Record<string, SimpleField>; max?: number })
  | (FieldBase & {
      kind: 'set'
      elements: { key: string; label: Text; abbr?: Text; values?: Record<string, string | number | boolean> }[]
      fields: Record<string, SimpleField>
    })
  | (FieldBase & { kind: 'items'; of: string[] })

export type FieldKind = Field['kind']

function build(strict: boolean) {
  const obj = <S extends z.ZodRawShape>(shape: S) => (strict ? z.strictObject(shape) : z.looseObject(shape))
  const base = {
    label: text().describe('Su nombre'),
    help: text(500).optional().describe('Una ayuda corta, para quien rellena la hoja'),
    master: z.boolean().optional().describe('Solo lo ve el máster'),
    play: z
      .boolean()
      .optional()
      .describe(
        'Se cambia jugando, desde la hoja (las monedas, la inspiración, las notas; en uno de objetos, lo que se añade del compendio, como el inventario); los recursos, siempre'
      )
  }
  const kind = (value: string, what: string) => z.literal(value).describe(what)

  // Las clases de campo que caben en una columna o dentro de un conjunto
  const simple = [
    obj({
      ...base,
      kind: kind('text', 'Un texto'),
      default: z.string().max(20000).optional(),
      max: z.int().min(1).max(20000).optional().describe('Como mucho, tantos caracteres'),
      lines: z.int().min(1).max(40).optional().describe('Las líneas que se ven al escribirlo')
    }),
    obj({
      ...base,
      kind: kind('number', 'Un número'),
      default: z.number().finite().optional(),
      min: z.number().finite().optional(),
      max: z.number().finite().optional(),
      integer: z.boolean().optional().describe('Solo enteros')
    }),
    obj({ ...base, kind: kind('boolean', 'Sí o no'), default: z.boolean().optional() }),
    obj({
      ...base,
      kind: kind('list', 'Una lista de textos cortos (idiomas, rasgos)'),
      default: z.array(z.string().max(200)).max(200).optional(),
      max: z.int().min(1).max(200).optional(),
      options: z
        .array(obj({ value: key, label: text() }))
        .min(1)
        .max(200)
        .optional()
        .describe('Si solo valen unas, cuáles: su valor (una clave) y su nombre (los tipos de daño)')
    }),
    obj({
      ...base,
      kind: kind('choice', 'Una opción de una lista'),
      options: z
        .array(obj({ value: key, label: text() }))
        .min(1)
        .max(100)
        .describe('Las opciones: su valor (una clave) y su nombre'),
      default: key.optional().describe('El valor de la opción de entrada')
    }),
    obj({
      ...base,
      kind: kind('link', 'Un enlace a otro documento'),
      to: key.describe('El tipo al que apunta'),
      multiple: z.boolean().optional().describe('Varios')
    }),
    obj({
      ...base,
      kind: kind('clock', 'Un reloj de segmentos que se llenan'),
      segments: z.int().min(2).max(12),
      default: z.int().min(0).max(12).optional()
    }),
    obj({
      ...base,
      kind: kind('dice', 'Unos dados que se escriben (el dado de golpe: 1d8)'),
      default: formula.optional()
    }),
    obj({
      ...base,
      kind: kind('resource', 'Algo que se gasta y se recupera (los PG), con su máximo'),
      max: z.union([z.number().finite(), formula]).optional().describe('Un número o una fórmula'),
      default: z.number().finite().optional(),
      recovery: z
        .enum(['short', 'long'])
        .optional()
        .describe('Con qué descanso se llena: short (el corto y el largo) o long (solo el largo, sin decirlo)'),
      roll: formula
        .optional()
        .describe(
          'Una tirada para su máximo (los PG tirados de una criatura al ponerla en juego: @dados_golpe); sin ella, su máximo'
        )
    }),
    obj({
      ...base,
      kind: kind('derived', 'Un valor calculado con una fórmula, sin dados (la defensa, el bono de competencia)'),
      formula,
      signed: z.boolean().optional().describe('Se enseña con signo (+2)')
    })
  ] as const
  const simpleField = z.discriminatedUnion('kind', simple) as unknown as z.ZodType<SimpleField>

  const field: z.ZodType<Field> = z.lazy(() =>
    z.discriminatedUnion('kind', [
      ...simple,
      obj({
        ...base,
        kind: kind('group', 'Unos campos juntos'),
        fields: recordOf(field, LIMITS.fieldsPerType).describe('Sus campos, por su clave')
      }),
      // Una lista de filas, cada una con sus columnas (como el inventario de texto o los ataques)
      obj({
        ...base,
        kind: kind('table', 'Una lista de filas, cada una con sus columnas (los ataques)'),
        columns: recordOf(simpleField, 30).describe('Sus columnas: campos que no son grupos, listas ni conjuntos'),
        max: z.int().min(1).max(1000).optional().describe('Como mucho, tantas filas')
      }),
      // Unos elementos fijos, cada uno con los mismos campos (las características, las habilidades)
      obj({
        ...base,
        kind: kind(
          'set',
          'Unos elementos fijos, cada uno con los mismos campos (las características: @caracteristicas.des.mod)'
        ),
        elements: z
          .array(
            obj({
              key,
              label: text(),
              abbr: text(10).optional().describe('Su abreviatura (DES)'),
              values: z
                .record(key, z.union([z.string().max(200), z.number().finite(), z.boolean()]))
                .optional()
                .describe('Sus valores iniciales, si no son los del campo (Sigilo: { car: des })')
            })
          )
          .min(1)
          .max(100)
          .describe('Los elementos: su clave, su nombre, su abreviatura y sus valores iniciales'),
        fields: recordOf(simpleField, 30).describe('Los campos de cada elemento')
      }),
      // Lo que lleva o tiene: documentos de esos tipos de objeto (una clase, una espada, un conjuro)
      obj({
        ...base,
        kind: kind(
          'items',
          'Lo que lleva o tiene: documentos de unos tipos de objeto (una clase, una espada, un conjuro)'
        ),
        of: z.array(key).min(1).max(20).describe('Los tipos de objeto que caben')
      })
    ])
  ) as unknown as z.ZodType<Field>

  // Un objeto (un anillo, un rasgo, un estado) da bonos a un campo de quien lo lleva, si se cumple su condición
  const modifier = obj({
    target: z
      .string()
      .min(1)
      .max(200)
      .describe('El campo de quien lo lleva, por su ruta (defensa, caracteristicas.des.valor)'),
    value: formula.describe('Cuánto suma: una fórmula con los campos del objeto'),
    when: formula.optional().describe('Cuándo suma: una fórmula de sí o no (@equipado)'),
    label: text().optional()
  })

  const type = obj({
    document: z
      .enum(['actor', 'item'])
      .describe(
        'actor: los personajes y las criaturas; item: lo que llevan o tienen (armas, rasgos, conjuros, estados)'
      ),
    label: text().describe('Su nombre'),
    icon: z.string().max(40).optional().describe('Un icono de lucide (user, gem, sword)'),
    fields: recordOf(field, LIMITS.fieldsPerType).describe('Sus campos, por su clave, en el orden de la hoja'),
    modifiers: z
      .array(modifier)
      .max(50)
      .optional()
      .describe('Los bonos que da a quien lo lleva (un anillo, +1 a la defensa)')
  })

  const roll = obj({
    label: text().describe('Su nombre'),
    formula: formula.describe('Los dados y los campos del personaje (2d6 + @este, 1d20 + @caracteristicas.des.mod)'),
    // Una por cada uno de estos campos, o por cada elemento de un conjunto; dentro, @este es ese
    for: z
      .union([
        obj({ fields: z.array(key).min(1).max(100) }),
        obj({ set: key }),
        obj({ items: z.array(key).min(1).max(50) })
      ])
      .optional()
      .describe(
        'Una por cada uno de estos campos ({ fields: [vigor, astucia] }), por cada elemento de un conjunto ({ set: caracteristicas }) o por cada objeto que lleve de estos tipos ({ items: [arma] }); dentro, @este es ese'
      ),
    target: z
      .enum(['none', 'optional', 'required'])
      .optional()
      .describe('Si pide una dificultad o una CA, @objetivo: none (no), optional o required'),
    variants: z
      .array(obj({ if: formula.describe('Cuándo: una fórmula de sí o no'), formula }))
      .max(20)
      .optional()
      .describe('Otra fórmula cuando se cumple algo: gana la primera'),
    bands: z
      .array(
        obj({
          if: formula.describe('Cuándo: sí o no, con @total, @natural (el primer dado) y @objetivo (@total >= 10)'),
          label: text().describe('Cómo se llama lo que sale'),
          tone: z.enum(TONES).describe('Su color en la interfaz')
        })
      )
      .max(20)
      .optional()
      .describe('Lo que sale, en franjas: gana la primera que se cumple (la última suele ser «true»)'),
    // Cambian los dados de la fórmula, ya leída (la ventaja: 2d6 por 3d6kh2)
    modes: z
      .array(
        obj({
          key,
          label: text(),
          from: formula.optional().describe('Los dados que cambia (2d6), sin @'),
          to: formula.optional().describe('Por cuáles (3d6kh2: tres, y se quedan los dos mayores)'),
          add: formula
            .optional()
            .describe(
              'Dados que se suman a la tirada (1d6) o, con «-», se restan (-1d6); sin @. Con from y to o en su lugar'
            ),
          gives: z
            .enum(['advantage', 'disadvantage'])
            .optional()
            .describe('Si es el que ponen los efectos de ventaja (advantage) o de desventaja (disadvantage)')
        })
      )
      .max(10)
      .optional()
      .describe('Cambian unos dados por otros al tirar, como la ventaja')
  })

  const source = obj({
    key,
    name: text().describe('Su nombre (SRD 5.1)'),
    license: z.string().trim().min(1).max(200).describe('Su licencia (CC BY 4.0, Propia)'),
    attribution: text(4000).describe('La atribución que pide su licencia'),
    url: z.url({ protocol: /^https?$/ }).optional(),
    edition: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional()
      .describe('Su edición («2014», «2024»): la campaña elige cuáles valen'),
    publisher: text().optional().describe('Su editorial'),
    released: z.iso.date().optional().describe('Cuándo salió (AAAA-MM-DD): de lo repetido, gana lo más nuevo')
  })
  // Los bloques de la hoja: tipos neutros; cada uno dice qué campos lee y qué se tira desde él
  const label = text().optional().describe('Su título (sin él, el del campo)')
  const leaf = [
    obj({
      kind: z.literal('header').describe('Su nombre, su línea y su retrato')
    }),
    obj({
      kind: z
        .literal('stats')
        .describe(
          'Cifras grandes (la CA, la iniciativa) o un sí o no (la inspiración): una por campo; las que se cambian jugando, se escriben'
        ),
      label,
      fields: z.array(key).min(1).max(12),
      rolls: z.record(key, key).optional().describe('Por campo, la tirada que se hace al pulsarlo (iniciativa)')
    }),
    obj({
      kind: z.literal('resource').describe('Un recurso con daño, curación y temporales (los PG)'),
      label,
      field: key
    }),
    obj({
      kind: z.literal('set').describe('Un conjunto en tabla (las características, las habilidades), con su tirada'),
      label,
      field: key,
      columns: z.array(key).min(1).max(6),
      roll: key.optional().describe('La tirada por cada elemento (prueba, salvación, habilidad)')
    }),
    obj({ kind: z.literal('group').describe('Un grupo de campos (las monedas, los espacios)'), label, field: key }),
    obj({
      kind: z.literal('list').describe('Campos de lista (idiomas, competencias)'),
      label,
      fields: z.array(key).min(1).max(12)
    }),
    obj({
      kind: z.literal('items').describe('Lo que lleva de un campo de objetos (el inventario), con sus tiradas'),
      label,
      field: key,
      types: z.array(key).max(20).optional().describe('Solo de estos tipos (las armas)'),
      columns: z.array(key).max(6).optional().describe('Sus campos que se ven'),
      rolls: z.array(key).max(4).optional().describe('Las tiradas por cada uno (ataque, daño)')
    }),
    obj({ kind: z.literal('actions').describe('Lo que puede hacer (ataques, conjuros), de la mecánica'), label }),
    obj({ kind: z.literal('uses').describe('Los usos limitados (la Furia), con su recuperación'), label }),
    obj({ kind: z.literal('text').describe('Un texto (las notas)'), label, field: key })
  ] as const
  const leafBlock = z.discriminatedUnion('kind', [...leaf])
  const block = z.discriminatedUnion('kind', [
    ...leaf,
    obj({
      kind: z.literal('columns').describe('Bloques uno al lado de otro'),
      blocks: z.array(leafBlock).min(1).max(4)
    }),
    obj({
      kind: z.literal('tabs').describe('Pestañas con sus bloques'),
      tabs: z
        .array(obj({ label: text(), blocks: z.array(leafBlock).max(20) }))
        .min(1)
        .max(8)
    })
  ])

  // Los pasos del creador: tipos neutros, sin nada de un juego concreto
  const scoreMethod = z.discriminatedUnion('kind', [
    obj({
      key,
      label: text(),
      kind: z.literal('array').describe('Repartir unos valores fijos (15, 14, 13, 12, 10, 8)'),
      values: z.array(z.int().min(-100).max(1000)).min(1).max(20)
    }),
    obj({
      key,
      label: text(),
      kind: z.literal('pointbuy').describe('Comprar con puntos: lo que cuesta cada valor'),
      budget: z.int().min(0).max(1000),
      costs: z
        .record(z.string().regex(/^-?\d+$/), z.int().min(0).max(1000))
        .describe('Lo que cuesta cada valor, por su número («8»: 0, «15»: 9)')
    }),
    obj({
      key,
      label: text(),
      kind: z.literal('roll').describe('Tirar cada uno en el servidor (4d6kh3) y repartirlos'),
      formula
    }),
    obj({
      key,
      label: text(),
      kind: z.literal('manual').describe('Escribirlos a mano, entre un mínimo y un máximo'),
      min: z.int().min(-100).max(1000),
      max: z.int().min(-100).max(1000)
    })
  ])
  const stepBase = {
    key,
    label: text().describe('Su nombre en la barra de pasos'),
    help: text(500).optional().describe('Una ayuda corta'),
    when: formula.optional().describe('Solo sale si se cumple (sobre el personaje)'),
    creation: z.boolean().optional().describe('Solo al crearlo: al subir de nivel no sale')
  }
  const step = z.discriminatedUnion('kind', [
    obj({
      ...stepBase,
      kind: z
        .literal('content')
        .describe('Elegir documentos del contenido de un tipo (la clase, la especie, el trasfondo)'),
      type: key.describe('El tipo de lo que se elige'),
      min: z.int().min(0).max(20).optional().describe('Cuántos hacen falta (sin decirlo, 1)'),
      max: z.int().min(1).max(20).optional().describe('Cuántos como mucho (sin decirlo, como min)'),
      levels: z
        .boolean()
        .optional()
        .describe('Cada uno lleva su nivel (las clases): el del personaje es la suma; el primero es el inicial')
    }),
    obj({
      ...stepBase,
      kind: z.literal('scores').describe('Generar las puntuaciones de un conjunto (las características)'),
      set: key.describe('El conjunto del personaje'),
      field: key.describe('El campo de cada elemento que se rellena (la puntuación)'),
      methods: z.array(scoreMethod).min(1).max(6)
    }),
    obj({
      ...stepBase,
      kind: z.literal('fields').describe('Escribir o elegir campos del personaje (su alineamiento, sus notas)'),
      fields: z.array(key).min(1).max(20)
    }),
    obj({ ...stepBase, kind: z.literal('summary').describe('El resumen, al final') })
  ])
  const setting = obj({
    label: text().describe('Su nombre'),
    help: text(500).optional().describe('Una ayuda corta'),
    kind: z
      .enum(['boolean', 'number', 'choice', 'choices'])
      .describe('boolean (sí o no), number, choice (una opción) o choices (varias)'),
    options: z
      .array(obj({ value: key, label: text() }))
      .max(50)
      .optional()
      .describe('Las opciones, si es choice o choices'),
    default: z
      .union([z.boolean(), z.number(), key, z.array(key)])
      .optional()
      .describe('Su valor en una campaña nueva')
  })

  return obj({
    format: z.literal(FORMAT).describe('La versión del formato: 1'),
    id: z.string().min(1).max(100).describe('Su id: lo pone Crisol al guardarlo'),
    name: text().describe('Su nombre'),
    summary: text(8000).optional().describe('De qué va el juego, en pocas frases'),
    version: z.string().trim().min(1).max(40).describe('La versión que le pone quien lo hace («1.0»)'),
    languages: z.array(z.enum(LANGUAGES)).min(1).max(LANGUAGES.length).describe('Los idiomas de sus textos'),
    license: source
      .omit({ key: true })
      .optional()
      .describe('De dónde sale el juego y con qué licencia (si sale de un libro o de un SRD)'),
    types: recordOf(
      type.extend({
        sheet: obj({ blocks: z.array(block).max(60) })
          .optional()
          .describe(
            'La hoja de este tipo de actor (la de una criatura, al estilo de su statblock), con los mismos bloques que la del personaje. Sin ella: la del sistema si es el personaje y, si no, una por defecto de sus campos'
          ),
        damage: obj({
          resist: key.optional().describe('Su campo de lista con los tipos de daño que resiste (mitad)'),
          immune: key.optional().describe('Los que no le hacen nada'),
          vulnerable: key.optional().describe('Los que le hacen el doble')
        })
          .optional()
          .describe(
            'Para aplicarle daño desde una tirada: qué campos dicen sus resistencias, inmunidades y vulnerabilidades'
          )
      }),
      LIMITS.types
    ).describe('Los tipos de documento, por su clave: los personajes y los objetos'),
    rolls: recordOf(roll, LIMITS.rolls).optional().describe('Las tiradas del juego, por su clave'),
    dice: obj({
      default: formula.optional().describe('La tirada con la que empieza la ficha de dados (2d6), sin @'),
      critical: z
        .enum(CRITICAL_RULES)
        .describe(
          'Cuándo es crítica: none (nunca), d20 (el 20 natural; el 1, pifia), doubles (dados iguales) o under (se tira por debajo: el 1 es crítico)'
        )
    })
      .optional()
      .describe('Los dados del juego'),
    sources: z.array(source).max(50).optional().describe('Las fuentes de su contenido: cada campaña elige cuáles usa'),
    // Como en Foundry, un paquete es de una clase de documento y puede mezclar sus tipos (armas, armaduras…); types, si
    // solo lleva algunos
    packs: z
      .array(
        obj({
          key,
          label: text(),
          document: z.enum(['actor', 'item']),
          types: z.array(key).max(50).optional().describe('Solo estos tipos')
        })
      )
      .max(100)
      .optional()
      .describe('Los paquetes de su contenido: documentos de una clase (actor o item), de unos tipos o de todos'),
    settings: recordOf(setting, 50)
      .optional()
      .describe('Los ajustes de campaña: reglas opcionales que elige cada campaña'),
    // Su sitio para la hoja y los pasos del creador: los dicen `hoja` y `personajes`
    sheet: obj({ blocks: z.array(block).max(60) })
      .optional()
      .describe(
        'La hoja del personaje, por bloques (docs/specs/hoja.md): cifras, un recurso, un conjunto, un grupo, listas, objetos, acciones, usos y texto, en pestañas o columnas. Sin ella, una por defecto de sus campos'
      ),
    card: z
      .array(key)
      .max(4)
      .optional()
      .describe('Los campos del personaje que se ven en su tarjeta y su vista previa (el nivel, los PG, la CA)'),
    party: obj({
      items: key
        .optional()
        .describe('El campo de objetos del personaje (su inventario) al que va lo que coge del grupo'),
      coins: key.optional().describe('El grupo de números del personaje con sus monedas (cobre, plata, oro…)')
    })
      .optional()
      .describe(
        'El inventario del grupo de una campaña: dónde lleva cada personaje lo que coge del grupo y sus monedas. Sin él, su primer campo de objetos y su primer grupo de números que se cambian jugando'
      ),
    creation: z
      .array(step)
      .max(LIMITS.steps)
      .optional()
      .describe(
        'Los pasos del creador de personajes (ADR-0013), en su orden: elegir del contenido, generar puntuaciones o escribir campos; lo que hay que elegir de lo concedido lo calcula Crisol'
      ),
    levelUp: z.array(z.unknown()).max(100).optional().describe('Subir de nivel: llega después'),
    compendium: obj({
      sections: z
        .array(
          obj({
            key,
            label: text().describe('Su nombre, en plural (Conjuros, Equipo)'),
            types: z.array(key).min(1).max(20).describe('Los tipos que lleva, en su orden')
          })
        )
        .min(1)
        .max(30)
        .describe('Sus secciones, como los estantes de una biblioteca, en su orden'),
      types: recordOf(
        obj({
          label: text().optional().describe('Su nombre en plural, como carpeta dentro de su sección (Armas)'),
          folder: obj({
            field: key.describe('El campo que reparte sus documentos en carpetas (el nivel de un conjuro)'),
            base: z
              .boolean()
              .optional()
              .describe('De un texto, solo lo de delante: «Dragón (cromático)» va con «Dragón»'),
            labels: z
              .record(z.string().max(60), text())
              .optional()
              .describe('El nombre de algún valor (el nivel 0 de un conjuro, «Trucos»)'),
            template: text().optional().describe('El nombre de los demás, con {valor} («Nivel {valor}»)')
          })
            .optional()
            .describe('Sus carpetas: por el valor de un campo'),
          filters: z
            .array(
              obj({
                field: key.describe('El campo por el que se filtra (la escuela de un conjuro, el VD de una criatura)'),
                labels: z
                  .record(z.string().max(60), text())
                  .optional()
                  .describe('El nombre de algún valor (mago → Mago), si el campo no los tiene')
              })
            )
            .max(8)
            .optional()
            .describe('Sus filtros, en este orden: solo salen los valores que tiene')
        }),
        100
      ).optional()
    })
      .optional()
      .describe(
        'Cómo se ordena su compendio: sus secciones (Reglas, Clases, Conjuros, Equipo, Criaturas…) con sus tipos y, en cada tipo, sus carpetas (los conjuros por nivel, las criaturas por tipo). Sin él, una sección por tipo'
      )
  })
}

/** El que se guarda: conserva lo que no conoce */
export const systemSchema = build(false)
/** Solo para avisar de lo que el formato no conoce */
export const strictSystemSchema = build(true)

export type System = z.infer<typeof systemSchema>
export type SystemType = System['types'][string]
export type Roll = NonNullable<System['rolls']>[string]
