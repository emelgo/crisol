import { describe, expect, it } from 'vitest'
import { average, dnd5eContext } from './dnd5e.ts'
import { htmlToMarkdown } from './html.ts'

/** Una criatura hecha a mano, con la forma de las de dnd5e: un arma sutil, un aliento y su VD */
const goblin = {
  _id: 'trasgo0000000001',
  name: 'Trasgo',
  type: 'npc',
  system: {
    abilities: { str: { value: 8 }, dex: { value: 15 }, cha: { value: 14 } },
    attributes: { spellcasting: 'cha' },
    skills: { prc: { value: 1 } },
    details: { cr: 0.25 }
  }
}
const scimitar = {
  _id: 'cimitarra0000001',
  name: 'Cimitarra',
  type: 'weapon',
  system: {
    properties: ['fin', 'lgt'],
    damage: { base: { number: 1, denomination: 6, types: ['slashing'] } },
    activities: {
      ataque0000000001: {
        type: 'attack',
        range: { value: '5' },
        attack: { ability: '', bonus: '', flat: false, type: { value: 'melee' } },
        damage: { includeBase: true, parts: [{ number: 1, denomination: 4, types: ['fire'] }] }
      }
    }
  }
}
const bow = {
  _id: 'arco000000000001',
  name: 'Arco corto',
  type: 'weapon',
  system: {
    range: { value: 80, long: 320 },
    magicalBonus: 1,
    damage: { base: { number: 1, denomination: 6, types: ['piercing'] } },
    activities: {
      a: { type: 'attack', attack: { type: { value: 'ranged' } }, damage: { includeBase: true, parts: [] } }
    }
  }
}
const breath = {
  _id: 'aliento000000001',
  name: 'Aliento',
  type: 'feat',
  system: {
    activities: {
      salvacion0000001: {
        type: 'save',
        save: { ability: ['dex'], dc: { calculation: 'con', formula: '' } },
        damage: { parts: [{ number: 4, denomination: 6, types: ['fire'] }] },
        target: { template: { type: 'cone', size: '15' }, affects: { type: 'creature' } }
      }
    }
  }
}
const fireball = {
  _id: 'bola000000000001',
  name: 'Bola de fuego',
  type: 'spell',
  system: {
    level: 3,
    target: { template: { type: 'sphere', size: '20' }, affects: { type: 'creature' } },
    activities: { s: { type: 'save', save: { ability: 'dex', dc: { calculation: 'spellcasting' } } } }
  }
}

const render = (html: string, document: object | null, actor: object | null = goblin, self = 'Trasgo') =>
  htmlToMarkdown(html, { self, ...dnd5eContext(document as never, actor as never) })

describe('lo de dnd5e en los textos', () => {
  it('la media de una fórmula sencilla', () => {
    expect(average('1d6 + 2')).toBe(5)
    expect(average('2d4')).toBe(5)
    expect(average('17d6')).toBe(59)
    expect(average('1d8 - 1')).toBe(3)
    expect(average('1d6 + @mod')).toBeNull()
  })

  it('el ataque de un arma sutil, con la competencia por su VD, y su daño con la característica', () => {
    expect(render('<p>[[/attack extended]]. [[/damage average extended]].</p>', scimitar)).toBe(
      'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing plus 2 (1d4) Fire damage.'
    )
    expect(render('[[/attack]] [[/damage]]', scimitar)).toBe('+4 1d6 + 2 Slashing plus 1d4 Fire')
    expect(render('[[/attack extended]]; [[/damage average]]', bow)).toBe(
      'Ranged Attack Roll: +5, range 80/320 ft; 6 (1d6 + 3) Piercing'
    )
    // Sin criatura (en el compendio), sin números
    expect(render('[[/attack extended]]', scimitar, null)).toBe('Melee Attack Roll: reach 5 ft')
  })

  it('el daño escrito, con su media y su tipo', () => {
    expect(render('[[/damage 1d4 slashing average]] y [[/damage formula=2d6 type=cold|fire]]', scimitar)).toBe(
      '2 (1d4) Slashing y 2d6 Cold or Fire'
    )
  })

  it('las salvaciones: la de la actividad (con su CD calculada) o la escrita', () => {
    expect(render('[[/save extended]]', breath)).toBe('Dexterity Saving Throw: DC 10')
    expect(render('una [[/save cha 15]] o [[/save ability=wis dc=12]]', null)).toBe('una DC 15 Charisma o DC 12 Wisdom')
    expect(render('[[/save]]', fireball)).toBe('DC 12 Dexterity')
    expect(render('[[/save]]', fireball, null)).toBe('Dexterity')
  })

  it('las pruebas, con sus nombres', () => {
    expect(render('[[/check ability=int skill=inv dc=15]], [[/check 20 nature]], [[/check dex]]', null)).toBe(
      'DC 15 Intelligence (Investigation), DC 20 Nature, Dexterity'
    )
  })

  it('los valores: lo que afecta, la plantilla, la CD y los de la criatura', () => {
    expect(
      render(
        '[[lookup @labels.description.affects capitalize]] in a [[lookup @labels.description.template]], level [[lookup @item.level]]',
        fireball,
        null
      )
    ).toBe('Each creature in a 20-foot-radius Sphere, level 3')
    expect(
      render(
        'DC [[lookup @save.dc.value]], a [[lookup @target.template.size]]-foot cone of [[lookup @target.affects.type]]s',
        breath
      )
    ).toBe('DC 10, a 15-foot cone of creatures')
    expect(
      render(
        '[[lookup @attributes.spell.dc]] [[lookup @abilities.str.mod]] [[lookup @skills.prc.passive]] [[lookup @details.cr]] [[lookup @nada]]{?}',
        null
      )
    ).toBe('12 −1 12 0.25 ?')
  })

  it('otras plantillas', () => {
    const shaped = (type: string) => ({
      ...fireball,
      system: { target: { template: { type, size: '30', width: '10', height: '40' } } }
    })
    const label = (type: string) => render('[[lookup @labels.description.template]]', shaped(type), null)
    expect(label('line')).toBe('30-foot-long, 10-foot-wide Line')
    expect(label('cylinder')).toBe('30-foot-radius, 40-foot-high Cylinder')
    expect(label('cube')).toBe('30-foot Cube')
  })
})
