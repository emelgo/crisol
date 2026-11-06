import { describe, expect, it } from 'vitest'
import { decodeEntities, htmlToLine, htmlToMarkdown, plainEnrichers } from './html.ts'

describe('el HTML de Foundry, en Markdown', () => {
  it('párrafos, negrita, cursiva, tachado, código y saltos de línea', () => {
    expect(
      htmlToMarkdown(
        '<p>Un <strong>golpe </strong>y <em>otro</em>, <s>no</s> <code>1d6</code>.</p><p>Uno<br>dos</p><div>Suelto</div>'
      )
    ).toBe('Un **golpe** y *otro*, ~~no~~ `1d6`.\n\nUno\ndos\n\nSuelto')
  })

  it('encabezados, citas, reglas y código', () => {
    expect(htmlToMarkdown('<h2>Combate</h2><blockquote><p>Uno</p><p>Dos</p></blockquote><hr><pre>a\n b</pre>')).toBe(
      '## Combate\n\n> Uno\n>\n> Dos\n\n---\n\n```\na\n b\n```'
    )
  })

  it('listas, con las de dentro sangradas, y ordenadas desde su número', () => {
    expect(htmlToMarkdown('<ul><li>Uno<ul><li>Dentro</li></ul></li><li><p>Dos</p></li></ul>')).toBe(
      '- Uno\n  - Dentro\n- Dos'
    )
    expect(htmlToMarkdown('<ol start="3"><li>Tres<li>Cuatro</ol>')).toBe('3. Tres\n4. Cuatro')
  })

  it('tablas: la primera fila de cabecera, las celdas en una línea, | escapado y colspan', () => {
    const html =
      '<table><caption>Daño</caption><thead><tr><th>d6</th><th>Qué</th></tr></thead><tbody>' +
      '<tr><td>1</td><td><p>A | b</p><p>c</p></td></tr><tr><td colspan="2">Todo</td></tr></tbody></table>'
    expect(htmlToMarkdown(html)).toBe('**Daño**\n\n| d6 | Qué |\n| --- | --- |\n| 1 | A \\| b c |\n| Todo |  |')
  })

  it('enlaces de fuera con su dirección; los demás, su texto; las imágenes y los scripts, fuera', () => {
    expect(
      htmlToMarkdown(
        '<p><a href="https://srd.example/x">SRD</a> y <a href="#x">aquí</a><img src="a.webp"><script>x()</script></p>'
      )
    ).toBe('[SRD](https://srd.example/x) y aquí')
  })

  it('las entidades, con nombre y por número', () => {
    expect(decodeEntities('&amp; &lt;b&gt; &mdash; &#8212; &#x2014; &rsquo; &raro;')).toBe('& <b> — — — ’ &raro;')
  })

  it('tolera etiquetas sin cerrar y cierres de más', () => {
    expect(htmlToMarkdown('<p>Uno<p>Dos</span></p><b>tres')).toBe('Uno\n\nDos\n\n**tres**')
    expect(htmlToMarkdown('   ')).toBe('')
  })

  it('en una línea, para una celda', () => {
    expect(htmlToLine('<p>Uno</p><ul><li>dos</li></ul>')).toBe('Uno - dos')
  })
})

describe('los enriquecedores de Foundry', () => {
  it('los enlaces a documentos: su etiqueta o, sin ella, el nombre del documento', () => {
    const nameOf = (id: string) => (id === 'abc123' ? 'Derribado' : undefined)
    expect(
      plainEnrichers(
        '@UUID[Compendium.x.y.Item.abc123]{Tumbado} @UUID[Compendium.x.y.Item.abc123] @Compendium[x.y.zzz]{Z} @Item[nada]',
        { nameOf }
      )
    ).toBe('Tumbado Derribado Z nada')
  })

  it('las referencias y lo incrustado', () => {
    expect(
      plainEnrichers(
        '&Reference[prone]{Derribado}, &amp;Reference[blinded apply=false], &Reference[condition=deafened]'
      )
    ).toBe('Derribado, blinded, deafened')
    expect(plainEnrichers('Antes @Embed[Compendium.x.y.RollTable.t inline] después')).toBe('Antes  después')
  })

  it('las tiradas en línea: su fórmula o su etiqueta', () => {
    expect(
      plainEnrichers('[[/r 1d6 # fuego]] [[1d4+1]] [[/gmr 2d6]]{Secreto} [[/award 50xp]] [[/item Golpe activity=x]]')
    ).toBe('1d6 1d4+1 Secreto 50xp Golpe')
    expect(
      plainEnrichers('[[/damage 2d6 type=fire average]] [[/damage formula=1d8 type=cold|fire]] [[/attack +5]]')
    ).toBe('2d6 fire 1d8 cold/fire +5')
    expect(
      plainEnrichers('[[/check ability=int skill=inv dc=15]] [[/save dex 12]] [[/save con]] [[/check dc=@x]]')
    ).toBe('DC 15 int (inv) DC 12 dex con ')
  })

  it('los valores del documento, con su forma y lo de si no hay', () => {
    const lookup = (path: string) => (path === 'level' ? '3' : undefined)
    expect(
      plainEnrichers(
        'El [[lookup @name lowercase]] de nivel [[lookup @level]], [[lookup @nada]]{nadie} y [[2 + @level]]{Nivel [[lookup @level]]} [[lookup @name capitalize]] [[lookup @name uppercase]]',
        { self: 'trasgo Jefe', lookup }
      )
    ).toBe('El trasgo jefe de nivel 3, nadie y Nivel 3 Trasgo Jefe TRASGO JEFE')
  })

  it('un sistema puede leer sus propias tiradas; si no dice nada, las de siempre', () => {
    const roll = ({ command, words }: { command: string; words: string[] }) =>
      command === 'attack' ? `ataque ${words.join(' ')}` : undefined
    expect(plainEnrichers('[[/attack extended]] [[/damage 1d6]]', { roll })).toBe('ataque extended 1d6')
  })
})
