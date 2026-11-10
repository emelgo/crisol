/**
 * Traer a un mundo las escenas de un zip de Foundry VTT (docs/specs/escenas-foundry.md): se lee el zip (foundry/read.ts,
 * solo sus paquetes de escenas y aventuras), cada escena se convierte (@crisol/systems/foundry) y pasa a una pestaña
 * «Escena» de una página nueva, con sus muros, sus luces y sus criaturas preparadas; una aventura, con su página y sus
 * diarios. Lo ya traído (por su origen) se cambia en su sitio. Al abrir una escena una campaña por primera vez, sus
 * criaturas preparadas salen en juego y en el mapa, y sus pines, como marcas del máster
 */
import {
  type ActionDefinition,
  createPages,
  createPageTab,
  editPage,
  type FoundryAdventureSummary,
  type FoundryPlaylistSummary,
  type FoundrySceneSummary,
  importFoundryScenes,
  inspectFoundryScenes
} from '@crisol/contracts'
import {
  filesRepo,
  foundryRepo,
  pagesRepo,
  scenesRepo,
  soundRepo,
  systemsRepo,
  tokensRepo,
  type visionRepo
} from '@crisol/db'
import { NotFoundError } from '@crisol/domain'
import type { System } from '@crisol/systems'
import {
  actorOrigins,
  audioSourceOf,
  type ConvertedPlaylist,
  type ConvertedScene,
  contentKeyOf,
  convertFoundryPlaylist,
  convertFoundryScene,
  type FoundryAdventure,
  type FoundryDocument,
  FoundryError,
  htmlToMarkdown,
  readAdventure
} from '@crisol/systems/foundry'
import type { z } from 'zod'
import { readFoundryZip } from '../foundry/read.ts'
import { creaturesChanged, pagesChanged } from '../realtime/events.ts'
import { authorizedWiki } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import * as layers from './layers.ts'
import { implement } from './registry.ts'
import { refreshWorld } from './sound.ts'
import { type Joining, Newcomers, shortLabel } from './tokens.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Una escena del zip: de qué paquete, en qué aventura y convertida */
interface ZipScene {
  pack: string
  adventure: FoundryAdventure | null
  scene: ConvertedScene
}

/** Una lista de sonido del zip: de qué paquete, en qué aventura y convertida */
interface ZipPlaylist {
  pack: string
  adventure: FoundryAdventure | null
  playlist: ConvertedPlaylist
}

/** Lo que dura una pista traída si el navegador no pudo medirla (un vídeo, una dirección que no deja), en segundos */
const UNKNOWN_DURATION = 300

/** Las escenas, aventuras y listas de un zip: el manifiesto, sus paquetes de actores (para sus criaturas) y lo leído */
async function readScenes(zip: string) {
  let read: Awaited<ReturnType<typeof readFoundryZip>>
  try {
    read = await readFoundryZip(Buffer.from(zip, 'base64'), {
      language: 'en',
      documents: ['Scene', 'Adventure', 'Playlist']
    })
  } catch (error) {
    if (error instanceof FoundryError) throw new InvalidRequestError(error.code, error.message)
    throw error
  }
  const scenes: ZipScene[] = []
  const adventures: Array<{ pack: string; adventure: FoundryAdventure }> = []
  const playlists: ZipPlaylist[] = []
  for (const pack of read.packs) {
    if (pack.type === 'Playlist')
      for (const doc of pack.documents)
        playlists.push({ pack: pack.name, adventure: null, playlist: convertFoundryPlaylist(doc) })
    if (pack.type === 'Scene')
      for (const doc of pack.documents)
        for (const scene of convertFoundryScene(doc)) scenes.push({ pack: pack.name, adventure: null, scene })
    if (pack.type === 'Adventure')
      for (const doc of pack.documents) {
        const adventure = readAdventure(doc)
        adventures.push({ pack: pack.name, adventure })
        for (const sceneDoc of adventure.scenes)
          for (const scene of convertFoundryScene(sceneDoc)) scenes.push({ pack: pack.name, adventure, scene })
        for (const playlistDoc of adventure.playlists)
          playlists.push({ pack: pack.name, adventure, playlist: convertFoundryPlaylist(playlistDoc) })
      }
  }
  if (scenes.length === 0 && adventures.length === 0 && playlists.length === 0)
    throw new InvalidRequestError('FOUNDRY_INVALID', 'No trae escenas, aventuras ni listas de sonido')
  return {
    manifest: read.manifest,
    actorPacks: read.manifest.packs.filter((p) => p.type === 'Actor').map((p) => p.name),
    scenes,
    adventures,
    playlists
  }
}

type ReadZip = Awaited<ReturnType<typeof readScenes>>

/** De dónde sale un audio del zip (las rutas del paquete van dentro del zip) */
const sourceIn = (manifest: ReadZip['manifest']) => (path: string) =>
  audioSourceOf(path, { id: manifest.id, kind: manifest.kind, root: '' })

/** La lista que enlaza una escena: la de su aventura o, si no, la de un paquete de listas */
function linkedPlaylist(read: ReadZip, item: ZipScene): ZipPlaylist | null {
  const id = item.scene.playlist?.playlistId
  if (!id) return null
  return (
    read.playlists.find((p) => p.playlist.id === id && p.adventure === item.adventure) ??
    read.playlists.find((p) => p.playlist.id === id && !p.adventure) ??
    null
  )
}

/** Los audios del zip (sus rutas), con quién los usa: sus listas, sus escenas y sus aventuras («paquete/id») */
function audioUse(read: ReadZip): Map<string, Set<string>> {
  const source = sourceIn(read.manifest)
  const out = new Map<string, Set<string>>()
  const use = (path: string, keys: readonly string[]) => {
    if (source(path).kind !== 'zip') return
    const set = out.get(path) ?? new Set<string>()
    for (const key of keys) set.add(key)
    out.set(path, set)
  }
  const adventureKey = (pack: string, adventure: FoundryAdventure | null) =>
    adventure ? [`${pack}/${adventure.id}`] : []
  for (const item of read.playlists) {
    const linking = read.scenes.filter((s) => linkedPlaylist(read, s) === item).map((s) => `${s.pack}/${s.scene.id}`)
    for (const track of item.playlist.tracks)
      use(track.path, [`${item.pack}/${item.playlist.id}`, ...adventureKey(item.pack, item.adventure), ...linking])
  }
  for (const item of read.scenes)
    for (const sound of item.scene.sounds)
      use(sound.path, [`${item.pack}/${item.scene.id}`, ...adventureKey(item.pack, item.adventure)])
  return out
}

/** Los audios ya subidos a un mundo de un zip, por su ruta (si siguen fuera de la papelera) */
async function uploadedAudio(ctx: ActionContext, worldId: string, moduleId: string, paths: readonly string[]) {
  const out = new Map<string, string>()
  for (const row of await foundryRepo.findOrigins(ctx.db, worldId, 'audio', moduleId, paths)) {
    const file = row.fileId ? await filesRepo.findFile(ctx.db, row.fileId) : null
    if (file && file.worldId === worldId) out.set(row.documentId, file.id)
  }
  return out
}

/** Las listas ya traídas, por «paquete/id»: su lista (si sigue) */
async function existingPlaylists(ctx: ActionContext, worldId: string, moduleId: string, items: readonly ZipPlaylist[]) {
  const out = new Map<string, soundRepo.PlaylistWithTracks>()
  for (const [pack, list] of Map.groupBy(items, (p) => p.pack)) {
    const rows = await foundryRepo.findOrigins(
      ctx.db,
      worldId,
      'playlist',
      packageOf(moduleId, pack),
      list.map((p) => p.playlist.id)
    )
    for (const row of rows) {
      const playlist = row.playlistId ? await soundRepo.findPlaylist(ctx.db, row.playlistId) : null
      if (playlist && playlist.worldId === worldId) out.set(`${pack}/${row.documentId}`, playlist)
    }
  }
  return out
}

function playlistSummary(
  item: ZipPlaylist,
  existing: soundRepo.PlaylistWithTracks | undefined
): FoundryPlaylistSummary {
  return {
    pack: item.pack,
    id: item.playlist.id,
    name: item.playlist.name,
    adventure: item.adventure?.id ?? null,
    kind: item.playlist.kind,
    mode: item.playlist.mode,
    tracks: item.playlist.tracks.length,
    existing: existing ? { playlistId: existing.id, name: existing.name } : null
  }
}

/** El paquete de un origen: el del módulo y el suyo */
const packageOf = (moduleId: string, pack: string) => `${moduleId}/${pack}`

/** Lo ya traído de unas escenas, por su id de Foundry: su escena y su página (si siguen fuera de la papelera) */
async function existingScenes(ctx: ActionContext, worldId: string, moduleId: string, scenes: readonly ZipScene[]) {
  const out = new Map<string, scenesRepo.SceneWithPage>()
  const byPack = Map.groupBy(scenes, (s) => s.pack)
  for (const [pack, list] of byPack) {
    const rows = await foundryRepo.findOrigins(
      ctx.db,
      worldId,
      'scene',
      packageOf(moduleId, pack),
      list.map((s) => s.scene.id)
    )
    for (const row of rows) {
      const scene = row.sceneId ? await scenesRepo.findScene(ctx.db, row.sceneId) : null
      if (scene && scene.worldId === worldId) out.set(`${pack}/${row.documentId}`, scene)
    }
  }
  return out
}

/** Lo ya traído de unas aventuras o diarios: su página, si sigue fuera de la papelera */
async function existingPages(
  ctx: ActionContext,
  worldId: string,
  kind: 'adventure' | 'journal',
  pkg: string,
  ids: readonly string[]
) {
  const out = new Map<string, { id: string; title: string }>()
  for (const row of await foundryRepo.findOrigins(ctx.db, worldId, kind, pkg, ids)) {
    const page = row.pageId ? await pagesRepo.findPage(ctx.db, row.pageId) : null
    if (page && page.worldId === worldId) out.set(row.documentId, { id: page.id, title: page.title })
  }
  return out
}

/** Llama a otra acción con su entrada ya validada (sus valores por defecto) */
async function run<A extends ActionDefinition>(
  ctx: ActionContext,
  action: A,
  input: z.input<A['input']>
): Promise<z.output<A['output']>> {
  const impl = ctx.actions.get(action.name)
  if (!impl) throw new Error(`falta la acción ${action.name}`)
  return (await impl.handler(ctx, action.input.parse(input))) as z.output<A['output']>
}

/** El texto de un diario en Markdown: sus páginas de texto, con su título si hay varias */
function journalMarkdown(doc: FoundryDocument, nameOf: (id: string) => string | undefined) {
  const md = (html: string) => htmlToMarkdown(html, { nameOf, self: doc.name ?? '' })
  if (typeof doc.content === 'string') return md(doc.content)
  const pages = (Array.isArray(doc.pages) ? doc.pages : [])
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0))
  const texts = pages.flatMap((p) => {
    const content = (p.text as { content?: unknown; markdown?: unknown } | undefined)?.content
    const markdown = (p.text as { markdown?: unknown } | undefined)?.markdown
    const text =
      typeof content === 'string' && content.trim() ? md(content) : typeof markdown === 'string' ? markdown.trim() : ''
    return text ? [{ name: typeof p.name === 'string' ? p.name : '', text }] : []
  })
  if (texts.length === 1) return texts[0]?.text ?? ''
  return texts.map((t) => (t.name ? `## ${t.name}\n\n${t.text}` : t.text)).join('\n\n')
}

/** Los nombres de una entrada del compendio (en sus idiomas), en minúsculas y sin tildes */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
const namesOf = (name: unknown): string[] =>
  typeof name === 'string'
    ? [name]
    : name && typeof name === 'object'
      ? Object.values(name).filter((v): v is string => typeof v === 'string')
      : []

/** Las criaturas (entradas de tipo actor) de los compendios donde se buscan: por su clave y por su nombre */
async function creatureFinder(
  ctx: ActionContext,
  wiki: { worldId: string; organizationId: string },
  systemId: string | undefined
) {
  const { worldId } = wiki
  // El que se diga primero, y luego los de las campañas del mundo
  const ids = [...new Set([...(systemId ? [systemId] : []), ...(await foundryRepo.worldSystems(ctx.db, worldId))])]
  const catalogs: Array<{ systemId: string; entries: Array<{ key: string; names: string[] }> }> = []
  for (const id of ids.filter((i) => UUID.test(i))) {
    const row = await systemsRepo.findSystem(ctx.db, id)
    if (!row || row.deletedAt || row.organizationId !== wiki.organizationId) continue
    const document = row.document as unknown as System
    const index = await layers.contentIndex(ctx, row.id, { worldId, systemId: row.id })
    catalogs.push({
      systemId: row.id,
      entries: index
        .filter((e) => document.types?.[e.type]?.document === 'actor')
        .map((e) => ({ key: e.key, names: namesOf(e.name).map(plain) }))
    })
  }
  return (origins: readonly string[], names: readonly string[]) => {
    // Por su origen: la clave del módulo 4 acaba con un resumen de «paquete/id»
    const suffixes = origins.map((o) => `-${contentKeyOf('x', o).split('-').at(-1)}`)
    for (const catalog of catalogs) {
      const found = catalog.entries.find((e) => suffixes.some((s) => e.key.endsWith(s)))
      if (found) return { systemId: catalog.systemId, key: found.key }
    }
    const wanted = names.map(plain).filter(Boolean)
    for (const catalog of catalogs) {
      const found = catalog.entries.find((e) => e.names.some((n) => wanted.includes(n)))
      if (found) return { systemId: catalog.systemId, key: found.key }
    }
    return null
  }
}

/** Lo que se cuenta de una escena del zip */
function summaryOf(item: ZipScene, existing: scenesRepo.SceneWithPage | undefined): FoundrySceneSummary {
  const { scene } = item
  return {
    pack: item.pack,
    id: scene.id,
    name: scene.name,
    adventure: item.adventure?.id ?? null,
    thumb: scene.thumb,
    background: scene.background,
    width: scene.width,
    height: scene.height,
    grid: scene.grid.type,
    walls: scene.walls.filter((w) => !w.door).length,
    doors: scene.walls.filter((w) => w.door).length,
    lights: scene.lights.length,
    tokens: scene.tokens.length,
    notes: scene.notes.length,
    // Lo traído de Foundry vive siempre en una página (su pestaña «Escena»): si ya no la tiene, como si no estuviera
    existing:
      existing?.pageId && existing.pageTitle !== null
        ? { sceneId: existing.id, pageId: existing.pageId, pageTitle: existing.pageTitle }
        : null
  }
}

/** «2 regiones, 1 tile y 3 sonidos»: lo que no se trae de unas escenas */
function skippedNotes(scenes: readonly ConvertedScene[]): string[] {
  const seen = new Set<string>()
  const total = { regions: 0, tiles: 0, drawings: 0, sounds: 0, templates: 0 }
  for (const scene of scenes) {
    // Las plantas de una escena cuentan una vez
    if (seen.has(scene.sourceId)) continue
    seen.add(scene.sourceId)
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += scene.skipped[key]
  }
  const words: Record<keyof typeof total, [string, string]> = {
    regions: ['región', 'regiones'],
    tiles: ['tile', 'tiles'],
    drawings: ['dibujo', 'dibujos'],
    sounds: ['sonido apagado', 'sonidos apagados'],
    templates: ['plantilla', 'plantillas']
  }
  const parts = (Object.keys(total) as (keyof typeof total)[])
    .filter((k) => total[k] > 0)
    .map((k) => `${total[k]} ${words[k][total[k] === 1 ? 0 : 1]}`)
  if (parts.length === 0) return []
  const list = new Intl.ListFormat('es', { type: 'conjunction' }).format(parts)
  return [`No se traen ${list} de las escenas`]
}

export const foundrySceneActions = [
  implement(inspectFoundryScenes, async (ctx, { worldId, zip }) => {
    await authorizedWiki(ctx, 'page.write', worldId)
    const read = await readScenes(zip)
    const { manifest, scenes, adventures } = read
    const existing = await existingScenes(ctx, worldId, manifest.id, scenes)
    const playlists = await existingPlaylists(ctx, worldId, manifest.id, read.playlists)
    const use = audioUse(read)
    const uploaded = await uploadedAudio(ctx, worldId, manifest.id, [...use.keys()])
    const adventurePages = new Map<string, Map<string, { id: string; title: string }>>()
    for (const [pack, list] of Map.groupBy(adventures, (a) => a.pack))
      adventurePages.set(
        pack,
        await existingPages(
          ctx,
          worldId,
          'adventure',
          packageOf(manifest.id, pack),
          list.map((a) => a.adventure.id)
        )
      )
    return {
      module: { id: manifest.id, title: manifest.title, version: manifest.version },
      scenes: scenes.map((item) => summaryOf(item, existing.get(`${item.pack}/${item.scene.id}`))),
      adventures: adventures.map(({ pack, adventure }): FoundryAdventureSummary => {
        const page = adventurePages.get(pack)?.get(adventure.id)
        return {
          pack,
          id: adventure.id,
          name: adventure.name,
          img: adventure.img,
          scenes: adventure.scenes.length,
          journals: adventure.journal.length,
          actors: adventure.actors.length,
          existing: page ? { sceneId: null, pageId: page.id, pageTitle: page.title } : null
        }
      }),
      playlists: read.playlists.map((item) => playlistSummary(item, playlists.get(`${item.pack}/${item.playlist.id}`))),
      audio: [...use].map(([path, keys]) => ({ path, usedBy: [...keys].sort(), fileId: uploaded.get(path) ?? null }))
    }
  }),

  implement(importFoundryScenes, async (ctx, input) => {
    const { worldId, zip, parentId } = input
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    if (parentId) {
      const parent = await pagesRepo.findPage(ctx.db, parentId)
      if (!parent || parent.worldId !== worldId) throw new InvalidRequestError('BAD_PARENT')
    }
    const read = await readScenes(zip)
    const moduleId = read.manifest.id
    const wantedScenes = new Set(input.scenes.map((s) => `${s.pack}/${s.id}`))
    const wantedAdventures = new Set(input.adventures.map((a) => `${a.pack}/${a.id}`))
    const wantedPlaylists = new Set(input.playlists.map((p) => `${p.pack}/${p.id}`))
    for (const key of wantedPlaylists)
      if (!read.playlists.some((p) => !p.adventure && `${p.pack}/${p.playlist.id}` === key))
        throw new InvalidRequestError('FOUNDRY_INVALID', `No trae la lista ${key}`)
    // Los audios ya subidos (del mundo o comunes de su cuenta, y de audio), por su ruta; y lo que dura cada uno
    const audio = new Map<string, { fileId?: string; duration?: number }>()
    for (const given of input.audio) {
      if (given.fileId) {
        const file = await filesRepo.findFile(ctx.db, given.fileId)
        const mine =
          file && (file.worldId === worldId || (file.worldId === null && file.organizationId === wiki.organizationId))
        if (!file || !mine) throw new NotFoundError('file')
        if (!file.mime.startsWith('audio/'))
          throw new InvalidRequestError('NOT_AUDIO', `«${file.name}» no es un archivo de audio`)
        await foundryRepo.saveOrigin(ctx.db, {
          worldId,
          kind: 'audio',
          package: moduleId,
          documentId: given.path,
          fileId: file.id
        })
      }
      audio.set(given.path, {
        ...(given.fileId ? { fileId: given.fileId } : {}),
        ...(given.duration ? { duration: given.duration } : {})
      })
    }
    const source = sourceIn(read.manifest)
    const missingAudio: z.output<typeof importFoundryScenes.output>['missingAudio'] = []
    for (const key of wantedScenes)
      if (!read.scenes.some((s) => !s.adventure && `${s.pack}/${s.scene.id}` === key))
        throw new InvalidRequestError('FOUNDRY_INVALID', `No trae la escena ${key}`)
    for (const key of wantedAdventures)
      if (!read.adventures.some((a) => `${a.pack}/${a.adventure.id}` === key))
        throw new InvalidRequestError('FOUNDRY_INVALID', `No trae la aventura ${key}`)

    const pages: Array<{ pageId: string; title: string; kind: 'adventure' | 'journal'; updated: boolean }> = []
    // Dónde va cada escena: la página de su aventura o la elegida
    const parentOf = new Map<string, string | null>()
    // Los diarios traídos (en esta vez o antes), por su id de Foundry: para los pines de las notas
    const journalPages = new Map<string, string>()

    /** Una página nueva (o la que ya había, con su texto cambiado) */
    const putPage = async (
      found: { id: string; title: string } | undefined,
      title: string,
      markdown: string,
      parent: string | null
    ) => {
      if (found) {
        if (markdown) await run(ctx, editPage, { pageId: found.id, body: { mode: 'replace', markdown } })
        return { id: found.id, title: found.title, updated: true }
      }
      const created = await run(ctx, createPages, {
        worldId,
        parentId: parent,
        pages: [{ key: 'p', title: title.slice(0, 200), ...(markdown ? { markdown } : {}) }]
      })
      const page = created.pages[0]
      if (!page) throw new Error('createPages: sin página')
      return { id: page.id, title: page.title, updated: false }
    }

    for (const { pack, adventure } of read.adventures) {
      if (!wantedAdventures.has(`${pack}/${adventure.id}`)) continue
      const pkg = packageOf(moduleId, pack)
      const nameOf = (id: string) =>
        [...adventure.journal, ...adventure.actors, ...adventure.scenes].find((d) => d._id === id)?.name
      const intro = [adventure.caption, adventure.description]
        .filter((html) => html.trim())
        .map((html) => htmlToMarkdown(html, { nameOf }))
        .join('\n\n')
      const known = await existingPages(ctx, worldId, 'adventure', pkg, [adventure.id])
      const page = await putPage(known.get(adventure.id), adventure.name, intro, parentId)
      await foundryRepo.saveOrigin(ctx.db, {
        worldId,
        kind: 'adventure',
        package: pkg,
        documentId: adventure.id,
        pageId: page.id
      })
      pages.push({ pageId: page.id, title: page.title, kind: 'adventure', updated: page.updated })
      // Sus diarios, como subpáginas
      const journals = await existingPages(
        ctx,
        worldId,
        'journal',
        pkg,
        adventure.journal.map((j) => j._id)
      )
      for (const journal of adventure.journal) {
        const markdown = journalMarkdown(journal, nameOf)
        const child = await putPage(journals.get(journal._id), journal.name ?? journal._id, markdown, page.id)
        await foundryRepo.saveOrigin(ctx.db, {
          worldId,
          kind: 'journal',
          package: pkg,
          documentId: journal._id,
          pageId: child.id
        })
        journalPages.set(journal._id, child.id)
        pages.push({ pageId: child.id, title: child.title, kind: 'journal', updated: child.updated })
      }
      for (const s of read.scenes) if (s.adventure === adventure) parentOf.set(`${pack}/${s.scene.id}`, page.id)
    }
    for (const key of wantedScenes) parentOf.set(key, parentId)

    const chosen = read.scenes.filter((s) => parentOf.has(`${s.pack}/${s.scene.id}`))
    const existing = await existingScenes(ctx, worldId, moduleId, chosen)
    const find = await creatureFinder(ctx, wiki, input.systemId)
    // Los diarios ya traídos de antes a los que apuntan las notas (de cualquier paquete de este módulo)
    const noteEntries = [...new Set(chosen.flatMap((s) => s.scene.notes.flatMap((n) => n.entryId ?? [])))]
    for (const id of noteEntries.filter((i) => !journalPages.has(i)))
      for (const pack of read.manifest.packs) {
        const found = await existingPages(ctx, worldId, 'journal', packageOf(moduleId, pack.name), [id])
        const page = found.get(id)
        if (page) journalPages.set(id, page.id)
      }

    // Las listas: las elegidas, las de las aventuras elegidas y las que enlazan las escenas que se traen
    const chosenPlaylists = read.playlists.filter(
      (p) =>
        wantedPlaylists.has(`${p.pack}/${p.playlist.id}`) ||
        (p.adventure && wantedAdventures.has(`${p.pack}/${p.adventure.id}`)) ||
        chosen.some((s) => linkedPlaylist(read, s) === p)
    )
    const knownPlaylists = await existingPlaylists(ctx, worldId, moduleId, chosenPlaylists)
    const playlistsOut: z.output<typeof importFoundryScenes.output>['playlists'] = []
    for (const item of chosenPlaylists) {
      const { playlist } = item
      const tracks: soundRepo.TrackInput[] = []
      for (const track of playlist.tracks) {
        const from = source(track.path)
        const name = `${playlist.name} · ${track.name}`
        const base = { name: track.name, volume: track.volume, loop: track.loop }
        const duration = audio.get(from.kind === 'zip' ? from.path : track.path)?.duration ?? UNKNOWN_DURATION
        if (from.kind === 'missing') missingAudio.push({ name, path: track.path, reason: from.reason })
        else if (from.kind === 'youtube')
          tracks.push({ ...base, duration, fileId: null, youtubeId: from.videoId, url: null })
        else if (from.kind === 'url') tracks.push({ ...base, duration, fileId: null, youtubeId: null, url: from.url })
        else {
          const fileId = audio.get(from.path)?.fileId
          if (fileId) tracks.push({ ...base, duration, fileId, youtubeId: null, url: null })
          else missingAudio.push({ name, path: track.path, reason: 'not-in-zip' })
        }
      }
      const values = { name: playlist.name, kind: playlist.kind, mode: playlist.mode, fade: playlist.fade }
      const before = knownPlaylists.get(`${item.pack}/${playlist.id}`)
      const context = historyContext(ctx, 'importFoundryPlaylist', { name: playlist.name }, wiki)
      const saved = before
        ? await soundRepo.updatePlaylist(ctx.db, context, before, { ...values, tracks })
        : await soundRepo.createPlaylist(ctx.db, context, { ...values, worldId, tracks })
      await foundryRepo.saveOrigin(ctx.db, {
        worldId,
        kind: 'playlist',
        package: packageOf(moduleId, item.pack),
        documentId: playlist.id,
        playlistId: saved.id
      })
      playlistsOut.push({ playlistId: saved.id, name: saved.name, tracks: tracks.length, updated: Boolean(before) })
    }

    const out: z.output<typeof importFoundryScenes.output>['scenes'] = []
    for (const item of chosen) {
      const { scene } = item
      const key = `${item.pack}/${scene.id}`
      let target = existing.get(key) ?? null
      const updated = target !== null
      if (!target) {
        const page = await putPage(undefined, scene.name, '', parentOf.get(key) ?? null)
        const tab = await run(ctx, createPageTab, { pageId: page.id, kind: 'scene', name: 'Escena' })
        target = await scenesRepo.sceneOfTab(ctx.db, tab.id)
        if (!target) throw new Error('createPageTab: sin escena')
      }
      // Sus fichas: las que tienen su criatura en el compendio quedan preparadas; las demás, se dice
      const prepared: scenesRepo.SceneRow['prepared'] = []
      const missing: Array<{ name: string; reason: 'not-found' | 'no-actor' | 'character' }> = []
      for (const token of scene.tokens) {
        const actor = token.actorId ? (item.adventure?.actors.find((a) => a._id === token.actorId) ?? null) : null
        const name = token.name || actor?.name || ''
        if (!token.actorId) {
          missing.push({ name, reason: 'no-actor' })
          continue
        }
        if (actor?.type === 'character') {
          missing.push({ name, reason: 'character' })
          continue
        }
        const creature = find(actorOrigins(actor, token.actorId, read.actorPacks), [
          ...(actor?.name ? [actor.name] : []),
          token.name
        ])
        if (!creature) {
          missing.push({ name, reason: 'not-found' })
          continue
        }
        prepared.push({
          ...creature,
          name,
          x: token.x,
          y: token.y,
          size: token.size,
          hidden: token.hidden,
          faction: token.faction,
          unique: token.unique
        })
      }
      // Sus sonidos: los audios del zip (ya subidos) y las direcciones; los demás, al informe
      const sounds: visionRepo.SceneSoundValues[] = []
      for (const sound of scene.sounds) {
        const from = source(sound.path)
        const name = `${scene.name} · ${sound.path.split('/').at(-1) || sound.id}`
        const base = {
          x: sound.x,
          y: sound.y,
          radius: Math.max(0.5, sound.radius),
          volume: sound.volume,
          easing: sound.easing,
          walls: sound.walls,
          darkOnly: sound.darkOnly
        }
        if (from.kind === 'missing') missingAudio.push({ name, path: sound.path, reason: from.reason })
        else if (from.kind === 'youtube') missingAudio.push({ name, path: sound.path, reason: 'youtube' })
        else if (from.kind === 'url') sounds.push({ ...base, url: from.url })
        else {
          const fileId = audio.get(from.path)?.fileId
          if (fileId) sounds.push({ ...base, fileId })
          else missingAudio.push({ name, path: sound.path, reason: 'not-in-zip' })
        }
      }
      const pins = scene.notes.flatMap((note) => {
        const pageId = note.entryId ? journalPages.get(note.entryId) : undefined
        return pageId ? [{ x: note.x, y: note.y, label: note.label, pageId }] : []
      })
      await foundryRepo.importScene(
        ctx.db,
        historyContext(ctx, 'importFoundryScene', { name: target.name, title: target.pageTitle }, wiki),
        target.id,
        {
          scene: {
            grid: { ...scene.grid, diagonals: target.grid.diagonals },
            initialView: scene.initialView,
            darkness: scene.darkness,
            automaticVision: scene.automaticVision,
            prepared,
            pins
          },
          walls: scene.walls.map(({ a, b, ...wall }) => ({ ax: a.x, ay: a.y, bx: b.x, by: b.y, ...wall })),
          lights: scene.lights,
          sounds
        }
      )
      await foundryRepo.saveOrigin(ctx.db, {
        worldId,
        kind: 'scene',
        package: packageOf(moduleId, item.pack),
        documentId: scene.id,
        sceneId: target.id
      })
      ctx.table?.sceneChanged(target.id)
      out.push({
        id: scene.id,
        sceneId: target.id,
        // Lo traído de Foundry va siempre en una página (su pestaña «Escena»)
        tabId: target.tabId ?? '',
        pageId: target.pageId ?? '',
        name: scene.name,
        background: scene.background,
        width: scene.width,
        height: scene.height,
        updated,
        prepared: prepared.length,
        missing
      })
    }
    ctx.realtime.publish(pagesChanged(wiki))
    if (playlistsOut.length > 0) await refreshWorld(ctx, worldId)
    const unmeasured = chosenPlaylists.some((p) =>
      p.playlist.tracks.some((t) => {
        const from = source(t.path)
        const known = audio.get(from.kind === 'zip' ? from.path : t.path)?.duration
        return from.kind !== 'missing' && known === undefined
      })
    )
    return {
      scenes: out,
      pages,
      playlists: playlistsOut,
      missingAudio,
      notes: [
        ...skippedNotes(chosen.map((s) => s.scene)),
        ...(unmeasured ? ['Algunas pistas no se pudieron medir: duran 5 minutos hasta que se cambien'] : [])
      ]
    }
  })
]

/**
 * La primera vez que una campaña abre una escena: sus criaturas preparadas, en juego y en el mapa (las que la campaña
 * tiene en su compendio; las demás se saltan), y sus pines, como marcas del máster
 */
export async function placePrepared(
  ctx: ActionContext,
  campaign: { id: string; name: string; worldId: string; organizationId?: string },
  sceneId: string
) {
  const scene = await scenesRepo.findScene(ctx.db, sceneId)
  if (!scene || (scene.prepared.length === 0 && scene.pins.length === 0)) return
  // Las criaturas entran en juego con sus fichas, en una operación (deshacerla lo quita todo)
  const newcomers = new Newcomers(ctx, campaign.id)
  const joining: Array<{ creature: Joining; prepared: (typeof scene.prepared)[number] }> = []
  for (const p of scene.prepared) {
    try {
      // La única que ya está en juego no se pone otra vez
      for (const creature of await newcomers.add(p.key, 1, p.unique, p.hidden, false))
        joining.push({ creature, prepared: p })
    } catch (error) {
      // Lo que la campaña no tiene (otro sistema…) se salta
      if (error instanceof InvalidRequestError || error instanceof NotFoundError) continue
      throw error
    }
  }
  if (joining.length > 0) {
    await tokensRepo.placeTokens(
      ctx.db,
      historyContext(ctx, 'placeTokens', { campaign: campaign.name, count: joining.length }, campaign),
      {
        creatures: newcomers.values,
        tokens: (created) =>
          joining.map(({ creature, prepared: p }) => ({
            worldId: campaign.worldId,
            campaignId: campaign.id,
            sceneId,
            creatureId: (creature.fresh !== undefined ? created[creature.fresh]?.id : creature.creatureId) ?? null,
            x: p.x,
            y: p.y,
            size: p.size,
            label: shortLabel(creature.name, creature.number),
            faction: p.faction,
            hidden: p.hidden
          }))
      }
    )
    ctx.realtime.publish(creaturesChanged({ campaignId: campaign.id, worldId: campaign.worldId }))
  }
  const place = { worldId: campaign.worldId, campaignId: campaign.id, sceneId }
  if (scene.pins.length > 0)
    await foundryRepo.insertPinMarks(
      ctx.db,
      historyContext(ctx, 'placeScenePins', { campaign: campaign.name, count: scene.pins.length }, campaign),
      place,
      scene.pins
    )
  ctx.table?.changed(campaign.id)
}
