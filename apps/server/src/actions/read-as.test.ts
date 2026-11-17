/**
 * La guarda de ADR-0017: toda acción que se puede leer como jugador (con readAs en su entrada) pasa por la proyección
 * (authorizedView o viewedPage), y nadie más autoriza con page.view a mano. Así una vía nueva no se olvida de filtrar
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ACTIONS } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'

const here = import.meta.dirname
const sources = readdirSync(here)
  .filter((name) => name.endsWith('.ts') && !name.includes('.test.'))
  .map((name) => ({ name, text: readFileSync(join(here, name), 'utf8') }))

/** El cuerpo de la implementación de una acción: desde implement(nombre, hasta el siguiente implement( */
function implementationOf(action: string) {
  for (const { text } of sources) {
    const start = text.indexOf(`implement(${action},`)
    if (start === -1) continue
    const next = text.indexOf('implement(', start + 10)
    return text.slice(start, next === -1 ? undefined : next)
  }
  return null
}

describe('leer como jugador (ADR-0017)', () => {
  const withReadAs = ACTIONS.filter((action) => {
    const shape = (action.input as { shape?: Record<string, unknown> }).shape
    return shape !== undefined && 'asCharacterId' in shape
  }).map((action) => action.name)

  it('hay acciones con readAs', () => {
    expect(withReadAs.length).toBeGreaterThan(8)
  })

  /** Ayudantes que pasan por la proyección (cada uno, comprobado abajo): una acción puede ir por ellos */
  const WRAPPERS = ['viewedBoard', 'viewedCalendar', 'viewedChronology']
  const projected = new RegExp(`viewedPage\\(|authorizedView\\(|${WRAPPERS.map((name) => `${name}\\(`).join('|')}`)

  it.each(withReadAs)('%s pasa por la proyección', (action) => {
    const body = implementationOf(action)
    expect(body, `sin implementación de ${action}`).not.toBeNull()
    expect(body).toMatch(projected)
  })

  it.each(WRAPPERS)('el ayudante %s pasa por la proyección', (name) => {
    const source = sources.find(({ text }) => text.includes(`async function ${name}(`))?.text ?? ''
    const start = source.indexOf(`async function ${name}(`)
    expect(start, `sin ${name}`).toBeGreaterThan(-1)
    const body = source.slice(start, source.indexOf('\n}\n', start))
    expect(body).toMatch(/viewedPage\(|authorizedView\(/)
  })

  it('nadie autoriza page.view a mano fuera de wiki/reader.ts', () => {
    const offenders = sources.filter(({ text }) => /authorize\([^)]*'page\.view'/.test(text)).map(({ name }) => name)
    expect(offenders).toEqual([])
  })
})
