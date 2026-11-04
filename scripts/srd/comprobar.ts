/**
 * Comprueba lo sacado del SRD: que valida con el 5e, que cada documento lleva sus dos idiomas y su página, y que hay lo
 * medido de cada tipo en cada edición. `node scripts/srd/comprobar.ts`
 */
import { MEASURED } from '../../packages/systems/src/catalog/5e/measured.ts'
import { fiveE } from '../../packages/systems/src/catalog/5e/system.ts'
import { catalogContent } from '../../packages/systems/src/catalog/content.ts'
import { validateContent } from '../../packages/systems/src/file.ts'
import { consoleIo, type Io } from '../io.ts'

export function check(io: Io = consoleIo): boolean {
  const content = catalogContent('5e')
  let ok = true
  const fail = (text: string) => {
    ok = false
    io.err(text)
  }
  for (const p of validateContent(fiveE, content).slice(0, 20)) fail(`${p.where}: ${p.message}`)
  for (const item of content) {
    const name = item.data.name as Record<string, unknown>
    if (typeof name?.es !== 'string' || typeof name?.en !== 'string') fail(`${item.key}: le falta un idioma`)
    if (!item.ref?.pages?.es || !item.ref?.pages?.en) fail(`${item.key}: le falta su página`)
  }
  const counted: Record<string, Record<string, number>> = {}
  for (const item of content) {
    const edition = fiveE.sources?.find((s) => s.key === item.source)?.edition ?? '?'
    counted[item.type] = { ...counted[item.type], [edition]: (counted[item.type]?.[edition] ?? 0) + 1 }
  }
  for (const type of new Set([...Object.keys(MEASURED), ...Object.keys(counted)]))
    for (const edition of ['2014', '2024'] as const) {
      const want = MEASURED[type]?.[edition] ?? 0
      const got = counted[type]?.[edition] ?? 0
      if (want !== got) fail(`${type} ${edition}: hay ${got}, se midieron ${want}`)
      else io.out(`${type} ${edition}: ${got}`)
    }
  io.out(ok ? `Todo bien: ${content.length} documentos` : 'Hay problemas')
  return ok
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = check() ? 0 : 1
