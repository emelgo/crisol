import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { Home } from './routes/home.tsx'
import { NotFound, RootLayout } from './routes/root.tsx'

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })

const routeTree = rootRoute.addChildren([homeRoute])

/** Sin historia, usa la del navegador */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
