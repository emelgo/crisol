import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { AiSettings } from './routes/ai-settings.tsx'
import { Bootstrap } from './routes/bootstrap.tsx'
import { CampaignPage } from './routes/campaign.tsx'
import { Consent } from './routes/consent.tsx'
import { OrganizationHistory, WorldHistory } from './routes/history.tsx'
import { Home } from './routes/home.tsx'
import { Join } from './routes/join.tsx'
import { Profile } from './routes/profile.tsx'
import { NotFound, RootLayout } from './routes/root.tsx'
import { SignIn } from './routes/sign-in.tsx'
import { OrganizationTrash, WorldTrash } from './routes/trash.tsx'
import { WorldPage } from './routes/world.tsx'
import { Worlds } from './routes/worlds.tsx'
import { WikiFiles } from './wiki/files.tsx'
import { WikiTags } from './wiki/tags.tsx'
import { WikiHome, WikiPage } from './wiki/wiki.tsx'

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })

// Las direcciones que ve la gente van en español
const signInRoute = createRoute({ getParentRoute: () => rootRoute, path: '/entrar', component: SignIn })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', component: Profile })
const worldsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mundos', component: Worlds })
const worldRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mundos/$worldId', component: WorldPage })
const campaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId',
  component: CampaignPage
})
const wikiRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mundos/$worldId/wiki', component: WikiHome })
const wikiPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/wiki/$pageId',
  component: WikiPage,
  // ?nuevo=true: la página se acaba de crear y se abre con su título por poner
  validateSearch: (search: Record<string, unknown>): { nuevo?: true } =>
    search.nuevo === true || search.nuevo === 'true' ? { nuevo: true } : {}
})
const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/etiquetas',
  component: WikiTags
})
const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/archivos',
  component: WikiFiles
})
const worldHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/historial',
  component: WorldHistory
})
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/historial',
  component: OrganizationHistory
})
const worldTrashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/papelera',
  component: WorldTrash
})
const aiRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ia', component: AiSettings })
const trashRoute = createRoute({ getParentRoute: () => rootRoute, path: '/papelera', component: OrganizationTrash })
const consentRoute = createRoute({ getParentRoute: () => rootRoute, path: '/oauth/consentimiento', component: Consent })
const joinRoute = createRoute({ getParentRoute: () => rootRoute, path: '/unirse/$secret', component: Join })
const bootstrapRoute = createRoute({ getParentRoute: () => rootRoute, path: '/arranque/$secret', component: Bootstrap })

const routeTree = rootRoute.addChildren([
  homeRoute,
  signInRoute,
  profileRoute,
  worldsRoute,
  worldRoute,
  campaignRoute,
  wikiRoute,
  wikiPageRoute,
  tagsRoute,
  filesRoute,
  worldHistoryRoute,
  historyRoute,
  worldTrashRoute,
  trashRoute,
  aiRoute,
  consentRoute,
  bootstrapRoute,
  joinRoute
])

/** Sin historia, usa la del navegador */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
