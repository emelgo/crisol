import { createHash, randomBytes } from 'node:crypto'

/** Secreto aleatorio de 256 bits para enlaces (arranque, invitaciones) */
export function newSecret(): string {
  return randomBytes(32).toString('base64url')
}

/** Lo único que se guarda de un secreto */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}
