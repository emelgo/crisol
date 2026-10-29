import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { Bootstrap } from './routes/bootstrap.tsx'
import { CampaignPage } from './routes/campaign.tsx'
import { Consent } from './routes/consent.tsx'
import { OrganizationHistory, WorldHistory } from './routes/history.tsx'
import { Home } from './routes/home.tsx'
import { Join } from './routes/join.tsx'
import { Profile } from './routes/profile.tsx'
import { NotFound, RootLayout } from './routes/root.tsx'
import { SignIn } from './routes/sign-in.tsx'
import { WorldPage } from './routes/world.tsx'
import { Worlds } from './routes/worlds.tsx'

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
  worldHistoryRoute,
  historyRoute,
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
