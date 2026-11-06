/**
 * Un PDF de prueba con texto de verdad en cada página (Helvetica, una línea por párrafo), hecho a mano: para probar
 * que se saca su texto y se busca sin depender de archivos de fuera
 */
export function textPdf(pages: readonly string[]): Uint8Array {
  const literal = (text: string) => text.replace(/[\\()]/g, (c) => `\\${c}`)
  // En WinAnsi: las letras con tilde del español caben en un byte
  const latin1 = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)
  const objects: string[] = []
  const add = (body: string) => objects.push(body) // su número, su posición + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // las páginas, al final
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const kids: number[] = []
  for (const text of pages) {
    const lines = text.split('\n')
    const stream = `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${literal(l)}) '`).join(' ')} ET`
    add(`<< /Length ${latin1(stream).length} >>\nstream\n${stream}\nendstream`)
    const content = objects.length
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`
    )
    kids.push(objects.length)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(latin1(out).length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = latin1(out).length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return latin1(out)
}
