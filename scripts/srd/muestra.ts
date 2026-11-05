/**
 * Una muestra al azar del contenido del 5e para revisarlo contra los PDF (el punto de control 4 de srd-5e): unos 20
 * documentos de cada tipo, con su página en cada PDF, su automatización y el principio de su texto. Siempre la misma
 * (con su semilla), para que se pueda volver a ella: `node scripts/srd/muestra.ts > tasks/muestra-srd-5e.md`
 */
import { fiveE } from '../../packages/systems/src/catalog/5e/system.ts'
import { catalogContent } from '../../packages/systems/src/catalog/content.ts'
import type { ContentItem } from '../../packages/systems/src/file.ts'
import { consoleIo, type Io } from '../io.ts'

/** Un generador de números al azar con semilla (mulberry32): la misma muestra cada vez */
export function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** Unos cuantos de una lista, al azar y sin repetir */
export function sample<T>(items: readonly T[], count: number, random: () => number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0] as T)
  return out
}

const text = (value: unknown, lang: 'es' | 'en') =>
  typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? String((value as Record<string, unknown>)[lang] ?? '')
      : ''

/** La muestra en Markdown: por tipo, cada documento con su página y lo primero de su texto en español */
export function report(content: readonly ContentItem[], perType = 20, seed = 2026): string {
  const random = seeded(seed)
  const types = [...new Set(content.map((c) => c.type))]
  const editionOf = (c: ContentItem) => fiveE.sources?.find((s) => s.key === c.source)?.edition ?? '?'
  const lines = [
    '# Muestra del contenido del 5e (srd-5e, punto de control 4)',
    '',
    'Unos 20 de cada tipo, al azar. Para cada uno: abrir el PDF en su página y mirar que el nombre, los números y el',
    'texto cuadran en los dos idiomas (los PDF están en `datos-locales/srd/`: el 5.1 inglés y español, y el 5.2.1).',
    'Lo que esté mal, apuntarlo aquí al lado.',
    ''
  ]
  for (const type of types) {
    const label = text(fiveE.types[type]?.label, 'es') || type
    lines.push(`## ${label}`, '')
    for (const item of sample(
      content.filter((c) => c.type === type),
      perType,
      random
    )) {
      const pages = item.ref?.pages ?? {}
      const body = text(item.data.descripcion, 'es').replace(/\s+/g, ' ').slice(0, 220)
      lines.push(
        `- [ ] **${text(item.data.name, 'es')}** / ${text(item.data.name, 'en')} — ${editionOf(item)}, pág. ${pages.es ?? '?'} (es) y ${pages.en ?? '?'} (en); ${item.mechanics?.automation ?? 'text'}${body ? `\n  > ${body}…` : ''}`
      )
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function main(io: Io = consoleIo) {
  io.out(report(catalogContent('5e')))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
