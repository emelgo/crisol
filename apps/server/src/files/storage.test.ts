import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { testDataDir } from '../testing.ts'
import { diskStorage } from './storage.ts'

/** Los archivos que quedan en la carpeta de un mundo */
const leftIn = async (root: string, worldId: string) => readdir(join(root, worldId)).catch(() => [])

describe('el almacenamiento en disco', () => {
  it('guarda lo que llega entero', async () => {
    const root = testDataDir()
    const world = randomUUID()
    const stored = await diskStorage(root).write(world, Readable.from([Buffer.from('hola')]), 100)
    expect(stored.size).toBe(4)
    expect(await leftIn(root, world)).toHaveLength(1)
  })

  it('una subida cortada a medias (cancelada) no deja nada', async () => {
    const root = testDataDir()
    const world = randomUUID()
    const body = new Readable({ read() {} })
    body.push(Buffer.from('un trozo'))
    const writing = diskStorage(root).write(world, body, 100)
    setTimeout(() => body.destroy(), 20)
    await expect(writing).rejects.toThrow()
    expect(await leftIn(root, world)).toEqual([])
  })
})
