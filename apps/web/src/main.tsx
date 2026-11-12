import { createRoot } from 'react-dom/client'
import { createAccountClient } from './account/client.ts'
import { createApiClient } from './api/client.ts'
import { App } from './app.tsx'
import { applyPlain } from './components/plain.ts'
import { createRealtimeClient } from './realtime/client.ts'
import { createAppRouter } from './router.tsx'
import { createCollabClient } from './wiki/collab.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Falta el elemento #root')
// «Sin desenfoque», si se eligió en este aparato: antes de pintar nada
applyPlain()
// Sin StrictMode: en desarrollo monta el editor dos veces y, con la edición en vivo (Yjs), el editor de más dejaba una
// línea vacía en el documento compartido cada vez que se abría una página (en producción no monta dos veces)
createRoot(root).render(
  <App
    router={createAppRouter()}
    accounts={createAccountClient()}
    api={createApiClient()}
    realtime={createRealtimeClient()}
    collab={createCollabClient()}
  />
)
