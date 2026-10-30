/**
 * El PDF de una hoja, sacado en el servidor con Chromium (permiso de Enrique, 2026-10-30): abre la ruta de impresión
 * de la web en el propio servidor, con la sesión de quien lo pide, espera a que la hoja esté paginada y la imprime con
 * su papel. De uno en uno: Chromium pesa y la app tiene la memoria justa
 */
import { type Browser, chromium } from 'playwright-core'

export interface PdfRenderer {
  /** El PDF de la ruta (relativa a la web) con la cookie de la sesión */
  render(path: string, cookie: string): Promise<Buffer>
  close(): Promise<void>
}

/** La cola está llena: ya hay bastantes PDF esperando */
export class PdfBusyError extends Error {
  constructor() {
    super('Hay demasiados PDF en cola')
    this.name = 'PdfBusyError'
  }
}

/** Cuántos pueden esperar a la vez (más, se contesta que ahora no) y lo más que tarda uno en total */
const MAX_WAITING = 2
const TIMEOUT_MS = 60_000

export function pdfRenderer(options: {
  /** Donde escucha el servidor por dentro (http://127.0.0.1:PUERTO) */
  baseUrl: string
  /** El Chromium del sistema (en la imagen); sin él, el que instala Playwright */
  executablePath?: string | undefined
}): PdfRenderer {
  let browser: Promise<Browser> | null = null
  let queue: Promise<unknown> = Promise.resolve()
  let waiting = 0
  const origin = new URL(options.baseUrl).origin
  const launch = () => {
    browser ??= chromium
      .launch({
        ...(options.executablePath
          ? // En el contenedor no hay espacios de nombres para su sandbox: lo que abre es la propia web
            { executablePath: options.executablePath, chromiumSandbox: false }
          : {}),
        // Sin los secretos del servidor (AUTH_SECRET, DATABASE_URL…): solo lo que necesita para arrancar
        env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '/tmp' },
        args: ['--disable-dev-shm-usage']
      })
      .then((launched) => {
        // Si se cae, la próxima vez se lanza otro
        launched.on('disconnected', () => {
          browser = null
        })
        return launched
      })
    // Si no arranca, tampoco se queda la promesa fallida
    browser.catch(() => {
      browser = null
    })
    return browser
  }
  const render = async (path: string, cookie: string) => {
    const context = await (await launch()).newContext({ extraHTTPHeaders: { cookie } })
    // La cookie de quien lo pide no sale nunca del propio servidor: lo de otro origen ni se pide
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    )
    const timer = setTimeout(() => void context.close(), TIMEOUT_MS)
    try {
      const page = await context.newPage()
      await page.goto(new URL(path, options.baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForSelector('body[data-sheet-ready="true"], body[data-sheet-error="true"]', { timeout: 30_000 })
      if (await page.$('body[data-sheet-error="true"]')) throw new Error('La hoja no se pudo cargar')
      await page.emulateMedia({ media: 'print' })
      return await page.pdf({ preferCSSPageSize: true, printBackground: true })
    } finally {
      clearTimeout(timer)
      await context.close().catch(() => undefined)
    }
  }
  return {
    render(path, cookie) {
      if (waiting >= MAX_WAITING) return Promise.reject(new PdfBusyError())
      waiting++
      const next = queue
        .then(() => render(path, cookie))
        .finally(() => {
          waiting--
        })
      // Lo que falle no para la cola
      queue = next.catch(() => undefined)
      return next
    },
    async close() {
      const open = browser
      browser = null
      if (open) await (await open).close().catch(() => undefined)
    }
  }
}
