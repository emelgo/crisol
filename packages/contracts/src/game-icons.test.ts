import { describe, expect, it } from 'vitest'
import { GAME_ICON_AUTHORS, GAME_ICONS, gameIcon } from './game-icons.ts'
import { pageIcon } from './pages.ts'

describe('los iconos de rol', () => {
  it('un icono es un emoji o uno del paquete («gi:<id>»); uno que no está, no', () => {
    expect(pageIcon.safeParse('🐉').success).toBe(true)
    expect(pageIcon.safeParse('gi:dragon-head').success).toBe(true)
    expect(pageIcon.safeParse('gi:no-existe').success).toBe(false)
    expect(pageIcon.safeParse('dragon').success).toBe(false)
    expect(gameIcon('gi:castle')).toMatchObject({ label: 'Castillo', group: 'lugares', author: 'lorc' })
    expect(gameIcon('🏰')).toBeNull()
  })

  it('sin repetidos, y cada autor con su nombre para el crédito', () => {
    expect(new Set(GAME_ICONS.map((icon) => icon.id)).size).toBe(GAME_ICONS.length)
    for (const icon of GAME_ICONS) expect(GAME_ICON_AUTHORS[icon.author], icon.id).toBeDefined()
  })
})
