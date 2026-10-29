import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'
import { createAppRouter } from './router.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Falta el elemento #root')
createRoot(root).render(
  <StrictMode>
    <App router={createAppRouter()} />
  </StrictMode>
)
