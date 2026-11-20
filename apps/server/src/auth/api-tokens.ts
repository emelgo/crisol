/**
 * Los tokens de acceso personales (ADR-0033): `Authorization: Bearer crisol_pat_…` en `/api/actions` y en las subidas
 * de archivos. Valen como la cuenta que los creó, con sus permisos de ahora; lo que se hace con ellos queda en el
 * historial como hecho por la IA con ese token. Se guardan solo por su huella
 */
import { createHash, randomBytes } from 'node:crypto'
import { apiTokensRepo, type Database } from '@crisol/db'
import type { FastifyRequest } from 'fastify'
import { toHeaders } from '../http.ts'
import type { Auth } from './auth.ts'

export const TOKEN_PREFIX = 'crisol_pat_'

export const hashToken = (secret: string) => createHash('sha256').update(secret).digest('hex')

/** Un token nuevo: 32 bytes al azar, con su principio para reconocerlo en la lista */
export function newApiToken() {
  const secret = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  return { secret, hash: hashToken(secret), prefix: secret.slice(0, TOKEN_PREFIX.length + 4) }
}

/** El token que trae la petición en su cabecera, si es uno de los nuestros */
export function bearerToken(request: Pick<FastifyRequest, 'headers'>): string | null {
  const header = request.headers.authorization
  if (typeof header !== 'string') return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1]?.startsWith(TOKEN_PREFIX) ? match[1] : null
}

/** Quién pide: con un token, su cuenta y el token; si no, la sesión de la web. null si no hay ni lo uno ni lo otro */
export type Requester = { userId: string; token: { id: string; name: string } | null }

export async function requesterOf(
  request: Pick<FastifyRequest, 'headers'>,
  auth: Auth,
  db: Database
): Promise<Requester | null> {
  const secret = bearerToken(request)
  if (secret) {
    // Un token que no vale no cae en la sesión: el guion tiene que enterarse
    const token = await apiTokensRepo.useApiToken(db, hashToken(secret), new Date())
    return token ? { userId: token.userId, token: { id: token.id, name: token.name } } : null
  }
  const session = await auth.api.getSession({ headers: toHeaders(request.headers) })
  return session ? { userId: session.user.id, token: null } : null
}

/** Con qué se ejecuta lo que pide: la web o, con un token, la IA con el nombre del token como herramienta */
export const viaOf = (requester: Requester) =>
  requester.token ? { via: 'ai' as const, tool: `token «${requester.token.name}»` } : { via: 'ui' as const }
