import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from './client.ts'
import { user } from './schema/auth.ts'
import { organizationMembers, organizations } from './schema/organizations.ts'
import { pages } from './schema/pages.ts'
import { pageTemplates } from './schema/templates.ts'
import { worlds } from './schema/worlds.ts'
import { freshTestDatabase } from './testing.ts'

/** La migración 0077, por sus sentencias: se vuelve a pasar sobre datos sembrados (en una base vacía no hizo nada) */
const MIGRATION = readFileSync(new URL('../drizzle/0077_plantillas_de_serie_propias.sql', import.meta.url), 'utf8')
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter(Boolean)

describe('las plantillas de serie en uso pasan a ser propias (migración 0077, ADR-0024)', () => {
  let conn: ReturnType<typeof connect>

  beforeAll(async () => {
    conn = connect(await freshTestDatabase('crisol_test_de_serie'), { max: 1 })
  })

  afterAll(async () => {
    await conn?.close()
  })

  it('las que usa una cuenta (y las que esas nombran), con los mismos campos; sus páginas y tablas, apuntando a ellas', async () => {
    await conn.db.insert(user).values({ id: 'enrique', name: 'Enrique', email: 'enrique@crisol.test' })
    const [org] = await conn.db.insert(organizations).values({ name: 'Fateforge' }).returning()
    const [other] = await conn.db.insert(organizations).values({ name: 'Otra' }).returning()
    const organizationId = org?.id ?? ''
    await conn.db.insert(organizationMembers).values({ organizationId, userId: 'enrique', role: 'owner' })
    const [world] = await conn.db.insert(worlds).values({ organizationId, name: 'Eana' }).returning()
    const worldId = world?.id ?? ''
    // Un PNJ hecho con la de serie, una facción con su tabla de miembros y una propia copiada de PNJ
    const [varn] = await conn.db
      .insert(pages)
      .values({
        worldId,
        title: 'Varn',
        position: 'a0',
        template: 'pnj',
        templateLine: ['pnj'],
        properties: [
          { name: 'Facción', field: 'faccion', type: 'pages', single: true, targets: ['faccion'], value: [] }
        ]
      })
      .returning()
    const [hermandad] = await conn.db
      .insert(pages)
      .values({
        worldId,
        title: 'La Hermandad',
        position: 'a1',
        template: 'faccion',
        templateLine: ['faccion'],
        panel: [
          {
            id: 'miembros',
            type: 'related',
            title: 'Miembros',
            template: 'pnj',
            field: 'faccion',
            columns: [],
            sort: 'title'
          }
        ]
      })
      .returning()
    const [own] = await conn.db
      .insert(pageTemplates)
      .values({ organizationId, name: 'PNJ de Eana', icon: 'user', basedOn: 'pnj', line: ['x', 'pnj'] })
      .returning()

    for (const statement of MIGRATION) await conn.sql.unsafe(statement)

    const made = await conn.db.select().from(pageTemplates).where(eq(pageTemplates.organizationId, organizationId))
    const byName = new Map(made.map((t) => [t.name, t]))
    // PNJ nombra a Facción, Lugar y Objeto (sus enlaces y sus tablas): pasan las cuatro, no Misión ni Sesión
    expect([...byName.keys()].sort()).toEqual(['Facción', 'Lugar', 'Objeto', 'PNJ', 'PNJ de Eana'])
    const pnj = byName.get('PNJ')
    const faccion = byName.get('Facción')
    expect(pnj?.line).toEqual([pnj?.id])
    expect(pnj?.createdBy).toBe('enrique')
    // Los mismos ids de campo, y sus enlaces y tablas apuntando a las nuevas
    expect(((pnj?.fields ?? []) as { field: string }[]).map((f) => f.field)).toContain('faccion')
    expect(JSON.stringify(pnj?.fields)).toContain(`"targets":["${faccion?.id}"]`)
    expect(JSON.stringify(faccion?.panel)).toContain(`"template":"${pnj?.id}"`)
    // Ninguna tabla ni enlace apunta ya a una de serie (los ids de campo, «faccion», se quedan como estaban)
    expect(JSON.stringify(made)).not.toMatch(/"template":"(pnj|faccion|lugar|objeto)"/)
    expect(JSON.stringify(made)).not.toMatch(/"targets":\[[^\]]*"(pnj|faccion|lugar|objeto)"/)
    // Las páginas: su plantilla, su linaje, sus propiedades y sus tablas
    const [varnNow] = await conn.db
      .select()
      .from(pages)
      .where(eq(pages.id, varn?.id ?? ''))
    expect(varnNow).toMatchObject({ template: pnj?.id, templateLine: [pnj?.id] })
    expect(JSON.stringify(varnNow?.properties)).toContain(`"targets":["${faccion?.id}"]`)
    const [hermandadNow] = await conn.db
      .select()
      .from(pages)
      .where(eq(pages.id, hermandad?.id ?? ''))
    expect(hermandadNow?.template).toBe(faccion?.id)
    expect(JSON.stringify(hermandadNow?.panel)).toContain(`"template":"${pnj?.id}"`)
    // La propia copiada de PNJ, con su linaje al día
    const [ownNow] = await conn.db
      .select()
      .from(pageTemplates)
      .where(eq(pageTemplates.id, own?.id ?? ''))
    expect(ownNow).toMatchObject({ basedOn: pnj?.id, line: ['x', pnj?.id] })
    // Una cuenta que no usaba ninguna no recibe nada; y pasarla otra vez no repite nada
    expect(
      await conn.db
        .select()
        .from(pageTemplates)
        .where(eq(pageTemplates.organizationId, other?.id ?? ''))
    ).toEqual([])
    for (const statement of MIGRATION) await conn.sql.unsafe(statement)
    expect(
      await conn.db.select().from(pageTemplates).where(eq(pageTemplates.organizationId, organizationId))
    ).toHaveLength(5)
  })
})
