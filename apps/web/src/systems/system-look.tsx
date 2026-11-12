/**
 * El aspecto de un sistema (revisión, tanda 6): su icono (un emoji o uno de rol; sin él, el pergamino) y su portada, de
 * los archivos comunes de la cuenta. La portada se elige con el mismo cuadro que la de un mundo; una imagen subida desde
 * él va a los archivos comunes
 */
import type { PageCover as Cover, SystemSummary } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { useApi } from '../api/context.tsx'
import { Icon } from '../components/icon.tsx'
import { LOCAL_FILE, type LocalImage } from '../routes/world-cover.tsx'

/** Su icono: el elegido o, sin él, el pergamino de los sistemas */
export function SystemIcon({ icon, size = 22 }: { icon: string | null; size?: number }) {
  if (icon) return <Icon value={icon} size={size} />
  return <ScrollText size={size} strokeWidth={1.5} aria-hidden="true" />
}

/** La dirección de su portada, si tiene */
export const systemCoverUrl = (system: Pick<SystemSummary, 'cover'>) =>
  system.cover ? `/api/files/${system.cover.fileId}` : null

/**
 * Guardar su aspecto: el icono y la portada van en su documento (las rutas icon y cover de updateSystem); una imagen
 * recién subida en el cuadro, antes, a los archivos comunes
 */
export function useSaveSystemLook(system: Pick<SystemSummary, 'id' | 'version'>) {
  const api = useApi()
  const queryClient = useQueryClient()
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.call('listOrganizations', {}) })
  const owned = organizations.data?.organizations.find((o) => o.role === 'owner')
  return async (look: { icon?: string | null; cover?: { cover: Cover | null; local: LocalImage | null } }) => {
    let cover = look.cover?.cover ?? null
    if (look.cover?.local && cover?.fileId === LOCAL_FILE && owned) {
      const stored = await api.uploadFile(
        { organizationId: owned.id, name: look.cover.local.file.name },
        look.cover.local.file
      )
      cover = { ...cover, fileId: stored.id }
      await queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
    }
    const changes = [
      ...(look.icon !== undefined
        ? [look.icon ? { path: 'icon', value: look.icon } : { path: 'icon', remove: true }]
        : []),
      ...(look.cover !== undefined ? [cover ? { path: 'cover', value: cover } : { path: 'cover', remove: true }] : [])
    ]
    if (changes.length === 0) return
    await api.call('updateSystem', { systemId: system.id, version: system.version, changes })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['systems'] }),
      queryClient.invalidateQueries({ queryKey: ['systemBooks', system.id] })
    ])
  }
}
