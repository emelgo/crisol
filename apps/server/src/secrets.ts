import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'

/** Secreto aleatorio de 256 bits para enlaces (arranque, invitaciones) */
export function newSecret(): string {
  return randomBytes(32).toString('base64url')
}

/** Por lo que se busca un secreto en la base de datos */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** Clave para cifrar los secretos que hay que poder volver a enseñar (enlaces de invitación) */
export function deriveSealKey(serverSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', serverSecret, 'crisol', 'enlaces de invitación', 32))
}

const VERSION = 'v1'

/** Cifra un secreto (AES-256-GCM): v1.<iv>.<etiqueta>.<cifrado>, en base64url */
export function sealSecret(secret: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [VERSION, iv, cipher.getAuthTag(), encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.')
}

/** Descifra lo que dio sealSecret; si la clave no es la misma o se alteró, falla */
export function openSecret(sealed: string, key: Buffer): string {
  const [version, iv, tag, encrypted] = sealed.split('.')
  if (version !== VERSION || !iv || !tag || !encrypted) throw new Error('Formato de secreto cifrado desconocido')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}

/** Algo que puede llevar secretos (lo que devolvió una acción: un enlace de invitación), cifrado para guardarlo */
export function sealJson(value: unknown, key: Buffer): { sealed: string } {
  return { sealed: sealSecret(JSON.stringify(value), key) }
}

/** Lo guardado con sealJson; lo que no lo está (o no se puede abrir con esta clave) no se devuelve */
export function openJson(stored: unknown, key: Buffer): Record<string, unknown> {
  const sealed = (stored as { sealed?: unknown } | null)?.sealed
  if (typeof sealed !== 'string') return {}
  try {
    return JSON.parse(openSecret(sealed, key)) as Record<string, unknown>
  } catch {
    return {}
  }
}
