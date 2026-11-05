/**
 * Cruza nuestras criaturas con las de dnd5e (`datos-locales/dnd5e/`) y dice lo que difiere: acciones que nos faltan,
 * recargas y usos por día perdidos, y etiquetas sin traducir. Solo en local: `node scripts/srd/comparar-dnd5e.ts`
 * (con `--todo`, cada criatura; con `--nuevo`, las que saca ahora el extractor)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { creatureDocs } from './criaturas.ts'
import { dnd5eActors } from './dnd5e.ts'

interface Ours {
  key: string
  type: string
  data: { name: { es: string; en: string } }
  mechanics?: { actions?: { label: { es: string; en: string }; recharge?: string; uses?: string }[] }
}

const file = join(import.meta.dirname, '../../packages/systems/src/catalog/5e/content/criaturas.json')
// Con `--nuevo`, las que saca ahora el extractor (sin escribirlas); si no, las guardadas
const ours = (process.argv.includes('--nuevo') ? creatureDocs() : JSON.parse(readFileSync(file, 'utf8'))) as Ours[]
const all = process.argv.includes('--todo')
/** «Fire Breath (Recharge 5–6)» → «fire breath» */
const plain = (name: string) =>
  name
    .replace(/\s*\(.*\)\s*$/, '')
    .toLowerCase()
    .trim()

const totals = { creatures: 0, unmatched: 0, missing: 0, recharge: 0, untranslated: 0, perfect: 0 }
for (const edition of ['2014', '2024'] as const) {
  const theirs = dnd5eActors(edition)
  for (const creature of ours.filter((c) => c.type === 'criatura' && c.key.endsWith(`_${edition}`))) {
    totals.creatures++
    const match = theirs.get(creature.data.name.en.toLowerCase())
    if (!match) {
      totals.unmatched++
      if (all) console.log(`${creature.key}: sin pareja en dnd5e`)
      continue
    }
    const actions = creature.mechanics?.actions ?? []
    const names = new Set(actions.map((a) => plain(a.label.en)))
    // dnd5e junta los alientos de un dragón de 2014 en «Breath Weapons»; nosotros, cada uno con su recarga
    if (actions.some((a) => /breath$/i.test(plain(a.label.en)) && a.recharge)) names.add('breath weapons')
    // Solo lo que se hace en su turno o fuera de él (no los rasgos pasivos, que no son acciones nuestras)
    const done = match.actions.filter((a) => ['action', 'bonus', 'reaction', 'legendary'].includes(a.activation ?? ''))
    const missing = done.filter((a) => !names.has(plain(a.name)))
    const recharges = match.actions.filter(
      (a) =>
        a.recharge &&
        !actions.some((o) => plain(o.label.en) === plain(a.name) && o.recharge) &&
        !(plain(a.name) === 'breath weapons' && names.has('breath weapons'))
    )
    const untranslated = actions.filter((a) => a.label.es === a.label.en && /[a-z]/i.test(a.label.en))
    totals.missing += missing.length
    totals.recharge += recharges.length
    totals.untranslated += untranslated.length
    if (missing.length === 0 && recharges.length === 0 && untranslated.length === 0) totals.perfect++
    else if (all)
      console.log(
        `${creature.key}: faltan [${missing.map((a) => a.name).join(', ')}]; sin recarga [${recharges
          .map((a) => a.name)
          .join(', ')}]; sin traducir [${untranslated.map((a) => a.label.en).join(', ')}]`
      )
  }
}
console.log(
  `${totals.creatures} criaturas: ${totals.perfect} iguales, ${totals.unmatched} sin pareja; ` +
    `${totals.missing} acciones de menos, ${totals.recharge} recargas perdidas, ${totals.untranslated} sin traducir`
)
