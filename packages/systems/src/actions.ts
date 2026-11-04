/**
 * Las acciones de un documento (ADR-0012): el ataque (el dado del sistema más su bono), la salvación (su CD), el daño en
 * partes y la curación, con los nombres de quien lo lleva, @este (el documento) y @ajustes. Un conjuro se tira a un
 * nivel (el de su espacio) y escala: por cada nivel por encima del base o con una tabla, por el nivel al que se tira o
 * por uno de quien lo lleva (los trucos, con el del personaje)
 */
import {
  type CriticalRule,
  type DiceNode,
  type DieRoller,
  doubleDice,
  formatDice,
  parseDice,
  type RollResult,
  rollTree
} from '@crisol/dice'
import type { DocumentItem, SystemDocument } from './evaluate.ts'
import type { System } from './format.ts'
import type { Value } from './formulas/functions.ts'
import type { Mechanics } from './mechanics.ts'
import { own } from './own.ts'
import { applyMode, armFormula, formula, labelOf, node, RollError, rollContext, valueIn } from './rolls.ts'
import { type Language, textOf } from './text.ts'

type Action = NonNullable<Mechanics['actions']>[number]

export interface ActionOptions {
  /** A qué nivel se tira (el del espacio de un conjuro); sin él, el base */
  level?: number
  /** Un modo del sistema para el ataque (`ventaja`) */
  mode?: string
  /** Si el ataque fue crítico: los dados del daño, dobles */
  critical?: boolean
  roller?: DieRoller
  language?: Language
  settings?: Record<string, unknown>
}

export interface DamagePart {
  /** Ya armada y escalada: `10d6`, `1d8+3` */
  formula: string
  /** Lo que da de media, redondeado hacia abajo (el 63 de 18d6); con dados que se repiten o se quedan, no se sabe */
  average: number | null
  type?: string
  label?: string
  tree: DiceNode
}

export interface PreparedAction {
  /** El objeto del que sale (null: del propio documento, como una criatura) */
  item: string | null
  key: string
  label: string
  activation?: string
  /** El nivel al que se tira, si escala */
  level?: number
  /** La tirada de ataque, armada (`1d20 + 5`), y su bono */
  attack: string | null
  bonus: number | null
  save: { ability: string; abilityLabel: string; dc: number; success?: string } | null
  damage: DamagePart[]
  heal: DamagePart | null
  range?: string
  uses?: string
  recharge?: string
  cost?: number
  attackTree: DiceNode | null
}

/** De quién es una acción: un objeto que lleva o el propio documento */
function ownerOf(doc: SystemDocument, itemId: string | null): { item: DocumentItem | null; mechanics?: Mechanics } {
  if (itemId === null) return { item: null, ...(doc.mechanics ? { mechanics: doc.mechanics } : {}) }
  const item = doc.items?.find((it) => it.id === itemId)
  if (!item) throw new RollError(`No lleva «${itemId}»`)
  return { item, ...(item.mechanics ? { mechanics: item.mechanics } : {}) }
}

/** El nombre de una característica (Destreza) por su clave, en cualquier conjunto de quien tira */
function abilityLabel(system: System, typeKey: string, key: string, language: Language) {
  for (const field of Object.values(own(system.types, typeKey)?.fields ?? {}))
    if (field.kind === 'set') {
      const element = field.elements.find((e) => e.key === key)
      if (element) return textOf(element.label, language)
    }
  return key
}

/** Sin los nombres de sus números: para enseñarla (`1d20+5`, `10d6`) */
function plain(tree: DiceNode): string {
  const strip = (n: DiceNode): DiceNode => {
    switch (n.kind) {
      case 'number':
        return { kind: 'number', value: n.value }
      case 'negate':
        return { kind: 'negate', value: strip(n.value) }
      case 'binary':
        return { ...n, left: strip(n.left), right: strip(n.right) }
      case 'dice': {
        const { label: _label, ...dice } = n
        return dice
      }
    }
  }
  return formatDice(strip(tree))
}

/** La media de unos dados (de lo que se suma, se resta, se multiplica o se divide) */
function averageOf(n: DiceNode): number | null {
  switch (n.kind) {
    case 'number':
      return n.value
    case 'negate': {
      const v = averageOf(n.value)
      return v === null ? null : -v
    }
    case 'binary': {
      const a = averageOf(n.left)
      const b = averageOf(n.right)
      if (a === null || b === null) return null
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : b === 0 ? null : a / b
    }
    case 'dice': {
      const plain = !n.keep && !n.explode && !n.reroll && !n.success && !n.failure && !n.implodeOn
      if (!plain) return null
      return n.sides === 'F' ? 0 : (n.count * (n.sides + 1)) / 2
    }
  }
}

/** Suma `k` veces unos dados a otros: con los mismos dados, en el mismo término (8d6 y 2d6, 10d6) */
function addTimes(tree: DiceNode, per: DiceNode, k: number): DiceNode {
  if (k <= 0) return tree
  if (per.kind === 'number')
    return { kind: 'binary', op: '+', left: tree, right: { kind: 'number', value: per.value * k } }
  if (per.kind === 'dice') {
    const { count, label: _l, ...rest } = per
    const same = JSON.stringify(rest)
    let merged = false
    const merge = (n: DiceNode): DiceNode => {
      if (merged) return n
      if (n.kind === 'dice') {
        const { count: c, label: _m, ...other } = n
        if (JSON.stringify(other) !== same) return n
        merged = true
        return { ...n, count: c + count * k }
      }
      // Solo en lo que se suma: en 2 * 1d6 o en una resta, no
      if (n.kind === 'binary' && n.op === '+') return { ...n, left: merge(n.left), right: merge(n.right) }
      return n
    }
    const result = merge(tree)
    return merged ? result : { kind: 'binary', op: '+', left: tree, right: { ...per, count: count * k } }
  }
  let sum = tree
  for (let i = 0; i < k; i++) sum = { kind: 'binary', op: '+', left: sum, right: structuredClone(per) }
  return sum
}

/** Arma una acción de un documento: su ataque, su salvación, su daño y su curación, al nivel que se pide. Sin tirarla */
export function prepareAction(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  itemId: string | null,
  actionKey: string,
  options: ActionOptions = {}
): PreparedAction {
  const language = options.language ?? 'es'
  const type = own(system.types, typeKey)
  if (!type) throw new RollError(`No existe el tipo «${typeKey}»`)
  const { item, mechanics } = ownerOf(doc, itemId)
  const action = mechanics?.actions?.find((a) => a.key === actionKey)
  if (!action) throw new RollError(`No existe la acción «${actionKey}»`)
  const { scope, evaluated } = rollContext(system, typeKey, doc, options)
  // @este: el objeto (ya calculado, con lo que sale de quien lo lleva) o, en una criatura, ella misma
  // @origen: lo que lo concedió (la clase de un rasgo, para su nivel)
  scope.origen = node(item?.from ? (evaluated.items[item.from] ?? null) : null)
  scope.este = item
    ? node(evaluated.items[item.id] ?? null)
    : node(
        Object.fromEntries(Object.entries(scope).flatMap(([k, n]) => (k === 'ajustes' ? [] : [[k, n.value]]))) as Value
      )
  const esteLabel = item?.name
  const labelFor = (path: Parameters<typeof labelOf>[1]) => labelOf(type.fields, path, esteLabel, language)
  const arm = (text: string) => armFormula(text, scope, labelFor)
  const number = (text: string, what: string) => {
    const v = valueIn(scope, formula(text))
    if (typeof v !== 'number') throw new RollError(`${what} no da un número`)
    return v
  }

  // El escalado: a qué nivel se tira y qué partes cambia
  const scaling = mechanics?.scaling
  const scales = scaling && (!scaling.action || scaling.action === action.key) ? scaling : undefined
  let level: number | undefined
  if (scales?.mode === 'slot') {
    level = options.level ?? scales.base
    if (level !== undefined && scales.base !== undefined && level < scales.base)
      throw new RollError(`Se tira a nivel ${scales.base} o más`)
  } else if (scales?.mode === 'level' && scales.by) level = number(scales.by, 'El nivel por el que escala')
  // Escala cada parte del daño que diga (sin decirlo, la primera) o, si no hace daño, la curación
  const scale = (tree: DiceNode, index: number | 'heal'): DiceNode => {
    if (!scales || level === undefined) return tree
    if (index === 'heal' ? (action.damage?.length ?? 0) > 0 : !(scales.parts ?? [0]).includes(index)) return tree
    let result = tree
    const step = [...(scales.at ?? [])].sort((a, b) => a.level - b.level).findLast((s) => s.level <= (level as number))
    if (step) result = arm(step.formula)
    if (scales.per) result = addTimes(result, arm(scales.per), level - (scales.base ?? 0))
    return result
  }
  const part = (
    p: { formula: string; type?: string | undefined; label?: Parameters<typeof textOf>[0] | undefined },
    index: number | 'heal'
  ): DamagePart => {
    let tree = scale(arm(p.formula), index)
    // Un crítico dobla los dados del daño, no los de la curación
    if (options.critical && index !== 'heal') tree = doubleDice(tree)
    const average = averageOf(tree)
    return {
      formula: plain(tree),
      average: average === null ? null : Math.floor(average),
      tree,
      ...(p.type ? { type: p.type } : {}),
      ...(p.label ? { label: textOf(p.label, language) } : {})
    }
  }

  // El ataque: el dado del sistema más su bono, con el modo que se pida
  let attackTree: DiceNode | null = null
  let bonus: number | null = null
  if (action.attack) {
    bonus = number(action.attack, 'El bono de ataque')
    attackTree = {
      kind: 'binary',
      op: '+',
      left: parseDice(system.dice?.default ?? '1d20'),
      right: armFormula(action.attack, scope, labelFor)
    }
    if (options.mode) {
      const mode = Object.values(system.rolls ?? {})
        .flatMap((r) => r.modes ?? [])
        .find((m) => m.key === options.mode)
      if (!mode) throw new RollError(`No existe el modo «${options.mode}»`)
      attackTree = applyMode(attackTree, mode).tree
    }
  }
  const damage = (action.damage ?? []).map((p, i) => part(p, i))
  return {
    item: item?.id ?? null,
    key: action.key,
    label: textOf(action.label, language),
    ...(action.activation ? { activation: action.activation } : {}),
    ...(level !== undefined ? { level } : {}),
    attack: attackTree ? plain(attackTree) : null,
    bonus,
    attackTree,
    save: action.save
      ? {
          ability: action.save.ability,
          abilityLabel: abilityLabel(system, typeKey, action.save.ability, language),
          dc: number(action.save.dc, 'La CD'),
          ...(action.save.success ? { success: action.save.success } : {})
        }
      : null,
    damage,
    heal: action.heal ? part({ formula: action.heal }, 'heal') : null,
    ...(action.range ? { range: textOf(action.range, language) } : {}),
    ...(action.uses ? { uses: action.uses } : {}),
    ...(action.recharge ? { recharge: action.recharge } : {}),
    ...(action.cost ? { cost: action.cost } : {})
  }
}

export interface RolledAction extends Omit<PreparedAction, 'attack' | 'attackTree' | 'damage' | 'heal'> {
  /** La tirada de ataque, hecha (su fórmula, su total, su crítico) */
  attack: RollResult | null
  damage: (Omit<DamagePart, 'tree'> & { result: RollResult })[]
  heal: (Omit<DamagePart, 'tree'> & { result: RollResult }) | null
}

/** Tira una acción, sin apuntarla: su ataque (si lo tiene), cada parte de su daño y su curación */
export function tryAction(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  itemId: string | null,
  actionKey: string,
  options: ActionOptions = {}
): RolledAction {
  const prepared = prepareAction(system, typeKey, doc, itemId, actionKey, options)
  const critical = (system.dice?.critical ?? 'd20') as CriticalRule
  const roll = (tree: DiceNode) => rollTree(tree, options.roller, { critical })
  const { attackTree, attack: _formula, damage, heal, ...rest } = prepared
  return {
    ...rest,
    attack: attackTree ? roll(attackTree) : null,
    damage: damage.map(({ tree, ...p }) => ({ ...p, result: roll(tree) })),
    heal: heal ? (({ tree, ...p }) => ({ ...p, result: roll(tree) }))(heal) : null
  }
}

/** Las acciones de todo lo que lleva (y las suyas), armadas a su nivel base; la que falla, con su error */
export function actionsOf(
  system: System,
  typeKey: string,
  doc: SystemDocument,
  options: Omit<ActionOptions, 'level' | 'critical' | 'roller'> = {}
): (Omit<PreparedAction, 'attackTree'> & { error?: string })[] {
  const owners: [string | null, Mechanics | undefined][] = [
    [null, doc.mechanics],
    ...(doc.items ?? []).map((it): [string, Mechanics | undefined] => [it.id, it.mechanics])
  ]
  const list: (Omit<PreparedAction, 'attackTree'> & { error?: string })[] = []
  for (const [itemId, mechanics] of owners)
    for (const action of mechanics?.actions ?? []) {
      try {
        const { attackTree: _tree, ...prepared } = prepareAction(system, typeKey, doc, itemId, action.key, options)
        list.push(prepared)
      } catch (error) {
        if (!(error instanceof RollError)) throw error
        list.push(failed(itemId, action, options.language ?? 'es', error.message))
      }
    }
  return list
}

function failed(item: string | null, action: Action, language: Language, error: string) {
  return {
    item,
    key: action.key,
    label: textOf(action.label, language),
    attack: null,
    bonus: null,
    save: null,
    damage: [],
    heal: null,
    error
  }
}
