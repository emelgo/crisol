import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
