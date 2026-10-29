import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'
import type { AccountClient } from './account/client.ts'
import { AccountsProvider } from './account/context.tsx'
import type { ApiClient } from './api/client.ts'
import { ApiProvider } from './api/context.tsx'
import { shouldRetry } from './api/errors.ts'
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
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <AccountsProvider client={accounts}>
        <ApiProvider client={api}>
          <RealtimeProvider client={realtime}>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </ApiProvider>
      </AccountsProvider>
    </QueryClientProvider>
  )
}
