import { focusManager, MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'
import type { AccountClient } from './account/client.ts'
import { AccountsProvider } from './account/context.tsx'
import { AccountScope } from './account/scope.tsx'
import { type ApiClient, ApiError } from './api/client.ts'
import { ApiProvider } from './api/context.tsx'
import { shouldRetry } from './api/errors.ts'
import { Announcer } from './components/announcer.tsx'
import { HeadingFocusProvider } from './components/page-title.tsx'
import type { RealtimeClient } from './realtime/client.ts'
import { RealtimeProvider } from './realtime/context.tsx'
import type { createAppRouter } from './router.tsx'
import './i18n.ts'
import './styles/tokens.css'
import './styles/base.css'

// Al volver a la pestaña o a la ventana se vuelve a pedir lo que se ve. TanStack Query solo mira si la pestaña pasa a
// estar visible, y pasar de una ventana a otra que ya se veía (máster y jugador lado a lado) no cuenta
focusManager.setEventListener((onFocus) => {
  const listener = () => onFocus()
  window.addEventListener('visibilitychange', listener)
  window.addEventListener('focus', listener)
  return () => {
    window.removeEventListener('visibilitychange', listener)
    window.removeEventListener('focus', listener)
  }
})

/** Sin canal en tiempo real (las pruebas que no lo usan) */
const NO_REALTIME: RealtimeClient = { connect: () => () => {} }

export function App({
  router,
  accounts,
  api,
  realtime = NO_REALTIME
}: {
  router: ReturnType<typeof createAppRouter>
  accounts: AccountClient
  api: ApiClient
  realtime?: RealtimeClient
}) {
  const [queryClient] = useState(() => {
    // La API dice que no hay sesión (caducó con la pestaña abierta): se vuelve a pedir y, sin ella, se va a entrar
    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) accounts.refreshSession()
    }
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: { retry: shouldRetry } }
    })
  })
  return (
    <QueryClientProvider client={queryClient}>
      <AccountsProvider client={accounts}>
        <ApiProvider client={api}>
          <HeadingFocusProvider>
            <AccountScope>
              <Announcer>
                <RealtimeProvider client={realtime}>
                  <RouterProvider router={router} />
                </RealtimeProvider>
              </Announcer>
            </AccountScope>
          </HeadingFocusProvider>
        </ApiProvider>
      </AccountsProvider>
    </QueryClientProvider>
  )
}
