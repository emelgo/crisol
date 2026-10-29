import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'
import type { AccountClient } from './account/client.ts'
import { AccountsProvider } from './account/context.tsx'
import type { ApiClient } from './api/client.ts'
import { ApiProvider } from './api/context.tsx'
import type { createAppRouter } from './router.tsx'
import './i18n.ts'
import './styles/tokens.css'
import './styles/base.css'

export function App({
  router,
  accounts,
  api
}: {
  router: ReturnType<typeof createAppRouter>
  accounts: AccountClient
  api: ApiClient
}) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <AccountsProvider client={accounts}>
        <ApiProvider client={api}>
          <RouterProvider router={router} />
        </ApiProvider>
      </AccountsProvider>
    </QueryClientProvider>
  )
}
