import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from './client.ts'
import { runMigrations } from './migrate.ts'
import { freshTestDatabase } from './testing.ts'

describe('migraciones', () => {
  let url: string
  let conn: ReturnType<typeof connect>

  beforeAll(async () => {
    url = await freshTestDatabase('crisol_test_db')
    conn = connect(url, { max: 1 })
  })

  afterAll(async () => {
    await conn.close()
  })

  it('activan la búsqueda sin acentos y por parecido', async () => {
    const [row] = await conn.sql`select unaccent('Éxito en Eana') as text, similarity('Eana', 'Eanna') > 0.3 as similar`
    expect(row).toEqual({ text: 'Exito en Eana', similar: true })
  })

  it('se pueden aplicar otra vez sin cambiar nada', async () => {
    await expect(runMigrations(url)).resolves.toBeUndefined()
  })
})

describe('freshTestDatabase', () => {
  it('rechaza nombres que no sean identificadores simples', async () => {
    await expect(freshTestDatabase('x"; drop database crisol; --')).rejects.toThrow('Nombre de base de datos')
  })
})
