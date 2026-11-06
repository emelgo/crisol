/**
 * El texto de cada página de un PDF (docs/specs/biblioteca.md), con pdf.js en el servidor: las líneas de cada página
 * juntas, sin los saltos de guion al final de línea. Un escaneado (sin texto) da páginas vacías
 */
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

/**
 * pdf.js, al usarlo por primera vez: al cargarse avisa de que falta el lienzo de Node (`@napi-rs/canvas`), que solo
 * sirve para dibujar; ese aviso se calla
 */
let loaded: Promise<PdfJs> | null = null
function pdfjs(): Promise<PdfJs> {
  loaded ??= (async () => {
    const warn = console.warn
    console.warn = (...args: unknown[]) => {
      if (!String(args[0]).includes('@napi-rs/canvas') && !String(args[0]).includes('polyfill')) warn(...args)
    }
    try {
      return await import('pdfjs-dist/legacy/build/pdf.mjs')
    } finally {
      console.warn = warn
    }
  })()
  return loaded
}

/** Lo que pesa el texto de una página, como mucho (un libro raro no llena la base) */
const PAGE_CHARS = 20_000

export async function pdfPages(
  bytes: Uint8Array,
  onPage?: (done: number, total: number) => void | Promise<void>
): Promise<string[]> {
  const { getDocument } = await pdfjs()
  // Una copia: pdf.js se queda con el búfer que recibe
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 })
  try {
    const document = await task.promise
    const pages: string[] = []
    for (let n = 1; n <= document.numPages; n++) {
      const page = await document.getPage(n)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str
        if (item.hasEOL) text += '\n'
        else if (item.str && !item.str.endsWith(' ')) text += ' '
      }
      pages.push(
        text
          .replace(/(\p{L})-\n(\p{L})/gu, '$1$2')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
          .slice(0, PAGE_CHARS)
      )
      page.cleanup()
      await onPage?.(n, document.numPages)
    }
    return pages
  } finally {
    await task.destroy()
  }
}
