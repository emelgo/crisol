import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { mcp } from '@better-auth/mcp'
import {
  aiRepo,
  authSchema,
  campaignsRepo,
  type Database,
  isOwner,
  loadMemberships,
  mayUseAi,
  usersRepo
} from '@crisol/db'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { jwt } from 'better-auth/plugins'
import { z } from 'zod'
import { campaignOfResource, mcpResource } from '../mcp/scope.ts'
import { signupAllowed } from './signup-gate.ts'

export interface AuthOptions {
  db: Database
  secret: string
  /** URL pública del sitio: de ella salen las cookies seguras y el origen en el que se confía */
  baseURL: string
  /** Otros orígenes desde los que se aceptan peticiones (Vite en desarrollo) */
  trustedOrigins?: string[]
  /** Peticiones por minuto a lo demás de las cuentas (100); entrar y registrarse, siempre 5 */
  rateLimitMax?: number
}

const DAY = 60 * 60 * 24

/** El parámetro resource de OAuth, que puede venir repetido */
const resourcesOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter((r): r is string => typeof r === 'string')

/**
 * Da de alta el recurso del conector de una campaña que existe (Better Auth solo emite tokens para recursos dados de
 * alta, y los de las campañas no se conocen al arrancar). Devuelve la campaña, o null si no lo es o no existe
 */
export async function ensureCampaignResource(db: Database, baseURL: string, resource: string) {
  const campaignId = campaignOfResource(baseURL, resource)
  if (!campaignId) return null
  const campaign = await campaignsRepo.findCampaign(db, campaignId)
  if (!campaign) return null
  await aiRepo.ensureOAuthResource(db, resource, `Crisol · ${campaign.name}`)
  return campaign
}

const signupClosed = () => new APIError('FORBIDDEN', { message: 'El registro está cerrado', code: 'SIGNUP_CLOSED' })

const displayName = z.string().trim().min(1).max(80)

const personName = z.string().trim().max(80)

/**
 * El perfil que se guarda: nombre de usuario (el visible) de 1 a 80 caracteres, nombre y apellido(s) hasta 80 cada
 * uno, y sin imagen (no hay en el módulo 0)
 */
function checkedProfile(user: {
  name?: unknown
  firstName?: unknown
  lastName?: unknown
  image?: unknown
  diceColor?: unknown
}): {
  name?: string
  firstName?: string
  lastName?: string
} {
  if (user.image !== undefined && user.image !== null) {
    throw new APIError('BAD_REQUEST', { message: 'Sin imagen de perfil', code: 'INVALID_PROFILE' })
  }
  const invalid = () => new APIError('BAD_REQUEST', { message: 'Nombre no válido', code: 'INVALID_PROFILE' })
  const checked: { name?: string; firstName?: string; lastName?: string } = {}
  if (user.name !== undefined) {
    const name = displayName.safeParse(user.name)
    if (!name.success) throw invalid()
    checked.name = name.data
  }
  // El color de los dados: un #rrggbb o ninguno (va a un estilo en la web)
  if (user.diceColor !== undefined && user.diceColor !== null && !/^#[0-9a-f]{6}$/i.test(String(user.diceColor))) {
    throw new APIError('BAD_REQUEST', { message: 'Color no válido', code: 'INVALID_PROFILE' })
  }
  for (const key of ['firstName', 'lastName'] as const) {
    if (user[key] === undefined || user[key] === null) continue
    const part = personName.safeParse(user[key])
    if (!part.success) throw invalid()
    checked[key] = part.data
  }
  return checked
}

/** El nombre de usuario es único (sin distinguir mayúsculas): si otra cuenta ya lo tiene, no se guarda */
async function freeName(db: Database, name: string, except?: string) {
  if (await usersRepo.isNameTaken(db, name, except)) {
    throw new APIError('BAD_REQUEST', {
      message: 'Ese nombre de usuario ya lo tiene otra cuenta',
      code: 'USERNAME_TAKEN'
    })
  }
}

/** Los dominios de los clientes que se registran solos por CIMD (claude.ai) */
export const CIMD_HOSTS: ReadonlySet<string> = new Set(['claude.ai', 'claude.com'])

export function createAuth({ db, secret, baseURL, trustedOrigins = [], rateLimitMax = 100 }: AuthOptions) {
  return betterAuth({
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128, autoSignIn: true },
    // name es el nombre de usuario (el apodo que se ve en la app); firstName y lastName, nombre y apellido(s)
    user: {
      additionalFields: {
        firstName: { type: 'string', required: false, defaultValue: '', input: true },
        lastName: { type: 'string', required: false, defaultValue: '', input: true },
        // Los dados (docs/specs/dados.md): su color y si ver caer los de los demás
        diceColor: { type: 'string', required: false, input: true },
        diceOthers: { type: 'boolean', required: false, defaultValue: true, input: true }
      }
    },
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    // En la base de datos: sobrevive a reinicios y vale con varias instancias
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: rateLimitMax,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        // Los tokens y la autorización de la IA: las de claude.ai llegan todas desde las mismas IP de Anthropic, así que el
        // 20 por minuto del plugin se queda corto con varios jugadores; el mismo límite general
        '/oauth2/token': { window: 60, max: rateLimitMax },
        '/oauth2/authorize': { window: 60, max: rateLimitMax },
        // Mirar la sesión no se limita: un 429 aquí el navegador lo toma por «sin sesión» y saca a «Entrar» (una
        // mesa con el máster, las jugadoras y la tele en la misma red pasaba de 100 por minuto)
        '/get-session': false
      }
    },
    advanced: { useSecureCookies: baseURL.startsWith('https://') },
    // Conector MCP (ADR-0002): OAuth 2.1 con registro de clientes por CIMD, como prefiere claude.ai
    plugins: [
      // Sin la cabecera set-auth-jwt en cada lectura de la sesión (nadie la usa): firmar un JWT en cada petición costaba
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        loginPage: '/entrar',
        consentPage: '/oauth/consentimiento',
        resource: mcpResource(baseURL),
        // Los recursos son todos conectores de este servidor (Mundos y el de cada campaña, ADR-0030): cualquier cliente
        // registrado pide el que quiera. claude.ai es un solo cliente para todos sus conectores, y al registrarse solo
        // quedaba unido a /mcp
        enforcePerClientResources: false,
        // Los clientes externos (claude.ai) se registran solos por CIMD; gestionar clientes a mano, solo el propietario
        clientPrivileges: async ({ user }) => (user ? isOwner(db, user.id) : false)
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
        // Módulo 0: solo se conecta Claude. Un cliente de otro dominio no se registra solo ni se hace pasar por él
        // (su nombre lo escribe quien publica sus metadatos), y el servidor no va a buscar documentos a cualquier sitio
        isMetadataDocumentUrlAllowed: (url) => CIMD_HOSTS.has(new URL(url).hostname)
      })
    ],
    hooks: {
      // El propietario autoriza el conector, y también quien juega en una campaña (ADR-0017: su IA solo lee lo que
      // sabe su campaña); /mcp lo vuelve a mirar en cada petición
      before: createAuthMiddleware(async (ctx) => {
        // Registro cerrado antes de buscar el email: si no, la respuesta diría qué emails tienen cuenta
        if (ctx.path === '/sign-up/email' && !signupAllowed()) throw signupClosed()
        // El conector de una campaña: su recurso se da de alta al pedir la autorización (ADR-0030)
        if (ctx.path === '/oauth2/authorize') {
          for (const resource of resourcesOf(ctx.query?.resource)) await ensureCampaignResource(db, baseURL, resource)
          return
        }
        if (ctx.path !== '/oauth2/consent' || ctx.body?.accept !== true) return
        const session = await getSessionFromCtx(ctx)
        if (!session || !(await mayUseAi(db, session.user.id))) {
          throw new APIError('FORBIDDEN', { message: 'Esta cuenta no puede conectar una IA', code: 'OWNER_ONLY' })
        }
        // Y el de una campaña, solo quien juega o dirige en ella
        const asked = new URLSearchParams(String(ctx.body?.oauth_query ?? '')).getAll('resource')
        const campaigns = asked.map((r) => campaignOfResource(baseURL, r)).filter((id): id is string => id !== null)
        if (campaigns.length === 0) return
        const { campaigns: mine, worlds } = await loadMemberships(db, session.user.id)
        for (const campaignId of campaigns) {
          const campaign = await campaignsRepo.findCampaign(db, campaignId)
          const member =
            mine.some((m) => m.campaignId === campaignId) ||
            worlds.some((w) => w.worldId === campaign?.worldId && w.role === 'master')
          if (!campaign || !member)
            throw new APIError('FORBIDDEN', { message: 'No estás en esta campaña', code: 'NOT_IN_CAMPAIGN' })
        }
      })
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!signupAllowed()) throw signupClosed()
            const checked = checkedProfile(user)
            if (checked.name !== undefined) await freeName(db, checked.name)
            return { data: { ...user, ...checked } }
          }
        },
        // El nombre lo ven sus compañeros, el máster y la IA: el mismo límite que al crear la cuenta, y que no lo tenga otro
        update: {
          before: async (user, ctx) => {
            const checked = checkedProfile(user)
            if (checked.name !== undefined) {
              const session = ctx ? await getSessionFromCtx(ctx) : null
              await freeName(db, checked.name, session?.user.id)
            }
            return { data: { ...user, ...checked } }
          }
        }
      }
    }
  })
}

export type Auth = ReturnType<typeof createAuth>
