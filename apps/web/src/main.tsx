import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAccountClient } from './account/client.ts'
import { createApiClient } from './api/client.ts'
import { App } from './app.tsx'
import { createRealtimeClient } from './realtime/client.ts'
import { createAppRouter } from './router.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Falta el elemento #root')
createRoot(root).render(
  <StrictMode>
    <App
      router={createAppRouter()}
      accounts={createAccountClient()}
      api={createApiClient()}
      realtime={createRealtimeClient()}
    />
  </StrictMode>
)
