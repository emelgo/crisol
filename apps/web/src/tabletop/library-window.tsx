/** Los libros del mundo (la biblioteca) en una ventana sobre la Mesa: buscar dentro y leer, sin dejar la Mesa */
import { useEffect, useState } from 'react'
import { Library, type LibrarySearch } from '../library/library.tsx'
import type { WindowSpec } from './windows.tsx'

export function libraryWindow(worldId: string, title: string, search: LibrarySearch = {}): WindowSpec {
  return {
    id: 'library',
    title,
    width: 1000,
    height: 700,
    render: () => <LibraryWindow worldId={worldId} asked={search} />
  }
}

function LibraryWindow({ worldId, asked }: { worldId: string; asked: LibrarySearch }) {
  const [search, setSearch] = useState(asked)
  // Abierta otra vez con otro libro: ese
  useEffect(() => {
    if (asked.libro) setSearch(asked)
  }, [asked])
  return <Library worldId={worldId} search={search} onSearch={setSearch} embedded />
}
