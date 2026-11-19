import { describe, expect, it } from 'vitest'
import { GAME_ICON_AUTHORS, GAME_ICON_GROUPS, gameIconId, isGameIcon } from './game-icons.ts'
import { FEATURED_GAME_ICONS, GAME_ICONS, gameIcon, searchGameIcons } from './game-icons-catalog.ts'
import { pageIcon } from './pages.ts'

describe('los iconos de rol', () => {
  it('un icono es un emoji o uno del paquete («gi:<id>»); uno que no está, no', () => {
    expect(pageIcon.safeParse('🐉').success).toBe(true)
    expect(pageIcon.safeParse('gi:dragon-head').success).toBe(true)
    expect(pageIcon.safeParse('gi:no-existe').success).toBe(false)
    expect(pageIcon.safeParse('dragon').success).toBe(false)
    expect(gameIcon('gi:castle')).toMatchObject({
      label: 'Castillo',
      group: 'edificios',
      author: 'lorc',
      featured: true
    })
    expect(gameIcon('🏰')).toBeNull()
    expect(gameIconId('gi:dragon-head')).toBe('dragon-head')
    expect(gameIconId('gi:../x')).toBeNull()
    expect(isGameIcon('gi:castle-delapouite')).toBe(true)
  })

  it('todos los del paquete, sin repetidos, cada uno con su nombre, su grupo y su autor; los de antes, destacados', () => {
    expect(GAME_ICONS.length).toBeGreaterThan(4000)
    expect(new Set(GAME_ICONS.map((icon) => icon.id)).size).toBe(GAME_ICONS.length)
    // Ningún nombre repetido: el buscador los nombra por él
    expect(new Set(GAME_ICONS.map((icon) => icon.label.toLocaleLowerCase('es'))).size).toBe(GAME_ICONS.length)
    for (const icon of GAME_ICONS) {
      expect(GAME_ICON_AUTHORS[icon.author], icon.id).toBeDefined()
      expect(GAME_ICON_GROUPS, icon.id).toContain(icon.group)
      expect(icon.label, icon.id).not.toBe('')
      expect(`gi:${icon.id}`.length, icon.id).toBeLessThanOrEqual(48)
    }
    expect(FEATURED_GAME_ICONS.length).toBe(337)
    for (const group of GAME_ICON_GROUPS) expect(searchGameIcons('', group).length, group).toBeGreaterThan(20)
  })

  it('se buscan en español (sin tildes, por sus palabras y por su grupo) o en inglés; lo más parecido, primero', () => {
    expect(searchGameIcons('dragon')[0]?.id).toBe('dragon-head')
    expect(searchGameIcons('Castillo')[0]?.label).toBe('Castillo')
    expect(searchGameIcons('espada').map((icon) => icon.id)).toEqual(expect.arrayContaining(['broadsword', 'katana']))
    expect(searchGameIcons('crossed swords')[0]?.id).toBe('crossed-swords')
    // Por el nombre del grupo, todo el grupo
    expect(searchGameIcons('arma').length).toBeGreaterThan(searchGameIcons('', 'armas').length - 1)
    expect(searchGameIcons('zzzz')).toEqual([])
    expect(searchGameIcons('espada', 'magia').every((icon) => icon.group === 'magia')).toBe(true)
  })
})
