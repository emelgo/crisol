import { type HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type CollabClient, CollabClientProvider, CollabSocket, useCollabDocument } from './collab.tsx'

type Providers = { configuration: { providerMap: Map<string, HocuspocusProvider> } }

/** Un WebSocket que no se conecta, y lo que lleva abierto */
function fakeClient() {
  const sockets: HocuspocusProviderWebsocket[] = []
  const client: CollabClient = {
    connect: () => {
      const socket = new HocuspocusProviderWebsocket({ url: 'ws://127.0.0.1:9/api/collab', autoConnect: false })
      sockets.push(socket)
      return socket
    }
  }
  const attached = () =>
    sockets.flatMap((socket) => [...(socket as unknown as Providers).configuration.providerMap.entries()])
  return { client, attached }
}

const seen: Array<HocuspocusProvider | undefined> = []
function Block({ name, index }: { name: string; index: number }) {
  const { session } = useCollabDocument(name)
  seen[index] = session?.provider
  return null
}

function Blocks({ client, shown }: { client: CollabClient; shown: number[] }) {
  return (
    <CollabClientProvider client={client}>
      <CollabSocket>
        {shown.map((index) => (
          <Block key={index} name="doc:secreto" index={index} />
        ))}
      </CollabSocket>
    </CollabClientProvider>
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('los documentos de la edición en vivo', () => {
  it('dos bloques del mismo documento comparten su proveedor; el nuevo sigue conectado al irse el viejo', () => {
    vi.useFakeTimers()
    const { client, attached } = fakeClient()
    const view = render(<Blocks client={client} shown={[0]} />)
    const first = seen[0]
    expect(first).toBeDefined()
    // El bloque vuelve a pintarse: el nuevo llega antes de irse el viejo
    view.rerender(<Blocks client={client} shown={[0, 1]} />)
    expect(seen[1]).toBe(first)
    view.rerender(<Blocks client={client} shown={[1]} />)
    expect(attached()).toEqual([['doc:secreto', first]])
    // Sin nadie que lo use, se cierra (un poco después)
    view.rerender(<Blocks client={client} shown={[]} />)
    expect(attached()).toEqual([['doc:secreto', first]])
    vi.advanceTimersByTime(2000)
    expect(attached()).toEqual([])
  })

  it('si el bloque se va y vuelve enseguida (al llegar el cuerpo), sigue con el mismo: no cierra y abre el nombre', () => {
    vi.useFakeTimers()
    const { client, attached } = fakeClient()
    const view = render(<Blocks client={client} shown={[0]} />)
    const first = seen[0]
    view.rerender(<Blocks client={client} shown={[]} />)
    vi.advanceTimersByTime(100)
    view.rerender(<Blocks client={client} shown={[1]} />)
    expect(seen[1]).toBe(first)
    vi.advanceTimersByTime(2000)
    expect(attached()).toEqual([['doc:secreto', first]])
    view.unmount()
  })
})
