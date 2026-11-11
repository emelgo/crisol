import { createHash, randomBytes } from 'node:crypto'
import { crc32, deflateSync } from 'node:zlib'
import { connect } from '@crisol/db'
import { resetDatabase } from '@crisol/db/testing'
import { issueBootstrap } from '@crisol/server/bootstrap'
import { exampleFile } from '@crisol/systems/examples'
import { type Browser, expect, type Locator, type Page } from '@playwright/test'
import { e2eDatabaseUrl } from '../servidor.ts'

export const owner = { name: 'Enrique', email: 'enrique@crisol.test', password: 'una-clave-larga' }

/** Base de datos vacía y el propietario con su cuenta recién creada y la sesión abierta en `page` */
/** La campaña va sola, sin la barra de la izquierda (como en Foundry): para lo de la barra, a Mis mundos */
async function leaveCampaign(page: Page) {
  if (/\/campanas\/[^/]+/.test(new URL(page.url()).pathname)) await page.goto('/mundos')
}

/** El menú de la cuenta: se abre con el nombre, en la barra */
async function openAccountMenu(page: Page) {
  await leaveCampaign(page)
  const account = page.getByRole('navigation', { name: 'Cuenta' })
  await account.locator('button[aria-expanded="false"]').click()
  return account
}

/** Cierra la sesión desde el menú de la cuenta */
export async function signOut(page: Page) {
  const account = await openAccountMenu(page)
  await account.getByRole('button', { name: 'Cerrar sesión' }).click()
}

/** Abre una ventana del menú de la cuenta (Perfil o Ajustes); devuelve la ventana */
export async function openAccountWindow(page: Page, name: 'Perfil' | 'Ajustes') {
  const account = await openAccountMenu(page)
  await account.getByRole('button', { name, exact: true }).click()
  const window = page.getByRole('dialog', { name, exact: true })
  await expect(window).toBeVisible()
  return window
}

/** Abre el perfil desde el menú de la cuenta; devuelve su ventana */
export function openProfile(page: Page) {
  return openAccountWindow(page, 'Perfil')
}

/** La barra de la izquierda */
export function sections(page: Page) {
  return page.getByRole('navigation', { name: 'Secciones' })
}

/** Abre Historial o Papelera, desde abajo en la barra (del mundo en el que se esté); devuelve la ventana */
export async function openWindow(page: Page, name: 'Historial' | 'Papelera') {
  await leaveCampaign(page)
  await page.getByRole('button', { name, exact: true }).click()
  const window = page.getByRole('dialog', { name, exact: true })
  await expect(window).toBeVisible()
  return window
}

/**
 * Cierra una ventana con su X y espera a que se haya ido del todo: si se vuelve a abrir la misma mientras se va (su
 * animación de salida), no se abre
 */
export async function closeWindow(window: Locator) {
  await window.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(window).toHaveCount(0)
}

/** Entra en un mundo desde Mis mundos, por el nombre de su tarjeta */
export async function openWorld(page: Page, name: string) {
  await page.getByRole('list', { name: 'Mundos' }).getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
}

/**
 * Desde Mis mundos, entra en un mundo: se abre su portada (una página que se crea sola, con el nombre del mundo) con el
 * árbol al lado. El máster trabaja en el PC (docs/diseno.md): no hay versión del móvil
 */
export async function openWiki(page: Page, name: string) {
  await openWorld(page, name)
  await expect(page.getByRole('tree', { name: 'Páginas' }).getByRole('treeitem', { name, exact: true })).toBeVisible()
}

/** Los archivos del mundo abierto, en su pantalla: «Archivos» en la barra */
export async function openWorldFiles(page: Page) {
  // El del mundo (mientras la barra cambia, aún puede estar saliendo el de los archivos comunes)
  await sections(page).getByRole('link', { name: 'Archivos' }).and(page.locator('[href*="/mundos/"]')).click()
}

/** Abre los ajustes de un mundo o una campaña (su engranaje); devuelve su ventana */
export async function openSettings(page: Page, name: string) {
  await page.getByRole('button', { name: `Ajustes de ${name}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: `Ajustes de ${name}`, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

type Kind = 'mundo' | 'campaña'
const nameField = (kind: Kind) => (kind === 'mundo' ? 'Nombre del mundo' : 'Nombre de la campaña')

/** Renombra un mundo o una campaña desde sus ajustes y cierra la ventana */
export async function rename(page: Page, kind: Kind, name: string, to: string) {
  const dialog = await openSettings(page, name)
  await dialog.getByLabel(nameField(kind)).fill(to)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  // Guardado, la ventana lleva el nombre nuevo
  const renamed = page.getByRole('dialog', { name: `Ajustes de ${to}`, exact: true })
  await expect(renamed).toBeVisible()
  await renamed.getByRole('button', { name: 'Cerrar' }).click()
  await expect(renamed).toBeHidden()
}

/** Borra un mundo o una campaña desde sus ajustes, escribiendo su nombre en la confirmación */
export async function remove(page: Page, kind: Kind, name: string) {
  const dialog = await openSettings(page, name)
  const action = kind === 'mundo' ? 'Borrar el mundo' : 'Borrar la campaña'
  await dialog.getByRole('button', { name: action }).click()
  const confirm = page.getByRole('dialog', { name: `¿Borrar «${name}»?` })
  await confirm.getByLabel(nameField(kind)).fill(name)
  await confirm.getByRole('button', { name: action }).click()
  await expect(confirm).toBeHidden()
}

/** Los tutoriales guiados de cada vista, ya hechos para esa cuenta: salen la primera vez y taparían lo que se prueba */
export async function skipTours(page: Page, email: string) {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        seen: [
          'mundos',
          'mundo',
          'campanas',
          'campana',
          'personajes',
          'personaje',
          'compendio',
          'en-juego',
          'grupo',
          'biblioteca',
          'tabla',
          'archivos',
          'etiquetas',
          'plantillas',
          'plantilla',
          'dados',
          'sistemas',
          'paginas-jugador',
          'escena',
          'mesa',
          'mesa-jugador',
          'libros',
          'sistema',
          'revisar'
        ]
      })
    )
  }, `crisol.recorridos.${email}`)
}

/** Rellena el alta de una cuenta: nombre de usuario, nombre, email y la contraseña dos veces */
export async function fillNewAccount(page: Page, person: { name: string; email: string; password: string }) {
  await page.getByLabel('Nombre', { exact: true }).fill(person.name)
  await page.getByLabel('Apellido(s)').fill('Pruebas')
  await page.getByLabel('Nombre de usuario').fill(person.name)
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(person.password)
  await page.getByLabel('Repite la contraseña').fill(person.password)
}

/** Crea un mundo desde Mis mundos: el recuadro «Nuevo mundo» (o el botón grande si no hay ninguno) abre su cuadro */
export async function createWorld(page: Page, name: string) {
  // Si ya está en Mis mundos, sin recargar (no corta el canal en tiempo real)
  if (new URL(page.url()).pathname !== '/mundos') await page.goto('/mundos')
  await page.getByRole('button', { name: /Nuevo mundo|Crear tu primer mundo/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo mundo' })
  await dialog.getByLabel('Nombre del mundo').fill(name)
  await dialog.getByRole('button', { name: 'Crear el mundo' }).click()
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
}

/** A Mis mundos con la llama, sin recargar (no corta el canal en tiempo real) */
export async function toWorlds(page: Page) {
  await leaveCampaign(page)
  if (new URL(page.url()).pathname !== '/mundos') await sections(page).getByRole('link', { name: 'Crisol' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
}

/** Crea una campaña desde Mis mundos: «Nueva campaña» pide su mundo (sin decirlo, el primero) */
export async function createCampaign(page: Page, name: string, world?: string) {
  await toWorlds(page)
  await page.getByRole('button', { name: 'Nueva campaña' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nueva campaña' })
  await dialog.getByLabel('Nombre de la campaña').fill(name)
  if (world) await dialog.getByLabel('Mundo').selectOption({ label: world })
  await dialog.getByRole('button', { name: 'Crear la campaña' }).click()
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
}

export async function freshOwner(page: Page) {
  const conn = connect(e2eDatabaseUrl(), { max: 1 })
  try {
    await resetDatabase(conn.sql)
    const { secret } = await issueBootstrap(conn.db, { organizationName: 'Fateforge' })
    await skipTours(page, owner.email)
    await page.goto(`/arranque/${secret}`)
    await fillNewAccount(page, owner)
    await page.getByRole('button', { name: 'Crear la cuenta' }).click()
    // Con sesión, la portada lleva directa a Mis mundos
    await expect(page.getByRole('heading', { level: 1, name: 'Mis mundos' })).toBeVisible()
  } finally {
    await conn.close()
  }
}

/** El 5e de ejemplo, importado en la cuenta de quien tiene la sesión en `page` (no viene de serie, ADR-0015): su id */
export async function import5e(page: Page): Promise<string> {
  const response = await page.request.post('/api/actions/importSystem', { data: { file: exampleFile('5e') } })
  expect(response.status()).toBe(200)
  return (await response.json()).system.id
}

/**
 * Entra en la Mesa de una campaña desde su tarjeta (ADR-0021: la campaña abre en su Inicio y la Mesa, en otra pestaña;
 * aquí, en la misma, con su dirección). panel: la pestaña de la Mesa que se quiere abierta (ajustes, compendio…)
 */
export async function openCampaign(page: Page, name: string, panel?: string) {
  const href = await page.getByRole('link', { name, exact: true }).first().getAttribute('href')
  expect(href).toBeTruthy()
  // Los ajustes de la campaña ya no son una pestaña de la Mesa: se abren encima, en su Inicio
  if (panel === 'ajustes' || panel === 'campana') return void (await page.goto(`${href}?panel=ajustes`))
  await page.goto(`${href}/mesa${panel ? `?panel=${panel}` : ''}`)
}

/** La dirección de la campaña abierta en `page` (sin ?panel=…) */
export const campaignPath = (page: Page) => new URL(page.url()).pathname.replace(/\/(mesa|compendio|paginas.*)$/, '')

/** De la campaña abierta en `page` (en su Inicio o en otra vista suya) a su Mesa */
export async function toMesa(page: Page) {
  await page.goto(`${campaignPath(page)}/mesa`)
}

/** Una pestaña de la barra de la Mesa */
export async function mesaTab(page: Page, name: string) {
  const panel = page.getByRole('complementary', { name: 'Panel de la mesa' })
  await panel.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
  return panel
}

/** El compendio entero del máster (con sus ajustes y «Nueva entrada»), en su ventana sobre la Mesa */
export async function openCompendiumWindow(page: Page, path = campaignPath(page)) {
  await page.goto(`${path}?panel=compendio`)
  await page
    .getByRole('complementary', { name: 'Panel de la mesa' })
    .getByRole('button', { name: 'Abrir el compendio' })
    .click()
  const window = page.getByRole('dialog', { name: 'Compendio' })
  await expect(window).toBeVisible()
  return window
}

/** El propietario crea Eana y La Marca; devuelve el enlace de invitación (con `page` en los ajustes de la campaña, abiertos sobre su Inicio) */
export async function campaignLink(page: Page) {
  await freshOwner(page)
  await createWorld(page, 'Eana')
  await createCampaign(page, 'La Marca')
  await openCampaign(page, 'La Marca', 'ajustes')
  return page.getByLabel('Enlace de invitación').inputValue()
}

/**
 * Una jugadora nueva entra con el enlace creando su cuenta; queda en la campaña, en su propia página. onPage recibe la
 * página antes de abrir nada (para escuchar lo que le llega)
 */
export async function newPlayer(browser: Browser, link: string, name = 'Jugadora', onPage?: (page: Page) => void) {
  // En su propio contexto (axe no mide una página abierta con browser.newPage)
  const context = await browser.newContext()
  const player = await context.newPage()
  onPage?.(player)
  const email = `${name.toLowerCase()}@crisol.test`
  await skipTours(player, email)
  await player.goto(link)
  await fillNewAccount(player, { name, email, password: 'una-clave-larga' })
  await player.getByRole('button', { name: 'Crear la cuenta y entrar' }).click()
  await expect(player.getByRole('heading', { level: 1, name: 'La Marca', exact: true })).toBeVisible()
  return player
}

/**
 * Abre `path` y espera a que el canal en tiempo real de la página esté conectado (llega su saludo): lo que pase
 * después (lo que pide Claude, un cambio de otra pestaña) se ve sin recargar
 */
export async function gotoLive(page: Page, path: string) {
  const hello = page.waitForEvent('websocket').then((socket) => socket.waitForEvent('framereceived'))
  await page.goto(path)
  await hello
}

const REDIRECT = 'https://cliente.example/callback'

/** Lo que contesta una herramienta MCP */
export interface ToolResult {
  content: Array<{ type: string; text?: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/**
 * Conecta «Claude» con la cuenta de la sesión de `page`, como claude.ai: un cliente OAuth público (registrado a mano;
 * claude.ai usa CIMD), el permiso en la web y el código canjeado con PKCE. Devuelve con qué llamar a las herramientas.
 * Deja `page` en la vuelta del permiso: hay que volver a abrir lo que se quiera ver
 */
export async function connectClaude(page: Page) {
  const base = new URL(page.url()).origin
  const created = await page.request.post('/api/auth/oauth2/create-client', {
    headers: { origin: base },
    data: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', client_name: 'Claude de pruebas' }
  })
  const { client_id } = (await created.json()) as { client_id: string }

  let callback: URL | undefined
  await page.route('https://cliente.example/**', (route) => {
    callback = new URL(route.request().url())
    return route.fulfill({ status: 200, body: 'ok' })
  })
  const verifier = randomBytes(32).toString('base64url')
  const authorize = new URL('/api/auth/oauth2/authorize', base)
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id,
    redirect_uri: REDIRECT,
    scope: 'openid profile offline_access',
    state: 'estado',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${base}/mcp`
  }).toString()
  await page.goto(authorize.toString())
  await page.getByRole('button', { name: 'Permitir', exact: true }).click()
  await expect.poll(() => callback?.searchParams.get('code')).toBeTruthy()

  // Como claude.ai, desde su servidor: sin la sesión del navegador. Con fetch y no con un contexto de Playwright, que
  // habría que soltar y, soltado al cerrarse la página, chocaba con la prueba siguiente (que vuelve a trazarlos todos)
  const token = await fetch(`${base}/api/auth/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: callback?.searchParams.get('code') ?? '',
      redirect_uri: REDIRECT,
      client_id,
      code_verifier: verifier,
      resource: `${base}/mcp`
    })
  })
  const { access_token } = (await token.json()) as { access_token: string }

  /** Una herramienta por el protocolo de 2025, como claude.ai. La respuesta viene en JSON o en un flujo SSE */
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult & { text: string }> => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${access_token}`,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-06-18'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      signal: AbortSignal.timeout(30_000)
    })
    const body = await response.text()
    const json = body.startsWith('{') ? body : (body.split('\n').find((l) => l.startsWith('data:')) ?? '').slice(5)
    const { result, error } = JSON.parse(json) as { result?: ToolResult; error?: unknown }
    if (!result) throw new Error(`${name}: ${response.status} ${JSON.stringify(error ?? body)}`)
    return { ...result, text: result.content.map((c) => c.text ?? '').join('\n') }
  }
  return { call }
}

/** En el texto de una página, un bloque con «/»: escribe la orden y la elige (en una línea vacía o tras un espacio) */
export async function slash(page: Page, name: string) {
  // La orden: su primera palabra (un espacio cierra el menú)
  await page.keyboard.type(`/${name.split(' ')[0]?.toLocaleLowerCase('es')}`)
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const option = page.getByRole('listbox', { name: 'Bloques' }).getByRole('option', { name: new RegExp(`^${escaped}`) })
  await option.first().click()
}

/** Lo elegido en el texto, a un secreto: desde la barrita que sale al elegir */
export async function selectionToSecret(page: Page) {
  await page.getByRole('toolbar', { name: 'Formato' }).getByRole('button', { name: 'Secreto' }).click()
}

/**
 * Espera a que acaben las animaciones y transiciones que están en marcha (una ventana que se abre, una tirada que
 * entra): axe mide el contraste de lo que ve, y a medias de un fundido sale más claro de lo que es
 */
export async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter(
            (a) =>
              a.playState === 'running' &&
              a.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY &&
              // Las que van con el desplazamiento (el pie de la barra) no acaban nunca: no son de tiempo
              a.timeline instanceof DocumentTimeline &&
              // El fondo de las pantallas de cuenta no para nunca (y es de adorno)
              !((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('[data-fondo]')
          ).length
      )
    )
    .toBe(0)
}

/**
 * Lo que tiene en curso una página: `quiet()` espera a que pase medio segundo sin ninguna petición abierta. Como
 * `networkidle`, pero se mira en cada llamada (no una vez por carga) y, si algo no acaba, falla diciendo qué es
 */
export function watchNetwork(page: Page) {
  const open = new Map<object, string>()
  page.on('request', (r) => {
    open.set(r, `${r.method()} ${r.url()}`)
  })
  page.on('requestfinished', (r) => {
    open.delete(r)
  })
  page.on('requestfailed', (r) => {
    open.delete(r)
  })
  return {
    async quiet(timeout = 60_000) {
      const end = Date.now() + timeout
      let since = Date.now()
      while (Date.now() - since < 500) {
        if (open.size > 0) since = Date.now()
        if (Date.now() > end) throw new Error(`La red no se calma; en curso:\n${[...open.values()].join('\n')}`)
        await page.waitForTimeout(50)
      }
    }
  }
}

/** Un PNG: sus trozos con su longitud y su CRC */
export function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const tail = Buffer.alloc(4)
    tail.writeUInt32BE(crc32(body))
    return Buffer.concat([head, body, tail])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const at = y * (width * 3 + 1)
    for (let x = 0; x < width; x++) rows.set(pixel(x, y), at + 1 + x * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0))
  ])
}
