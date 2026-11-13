/**
 * Un archivo abierto en el centro del mundo a pantalla completa (ADR-0027, /mundos/$w/archivo/$fileId), como una
 * pestaña abierta más: una imagen, un PDF, un audio, un vídeo o un texto, con su vista previa y sus ajustes en el panel
 * de la derecha. Lo demás, para descargarlo
 */
import type { FolderView } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Download, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { PageTitle } from '../../components/page-title.tsx'
import { FileSettings } from '../file-dialogs.tsx'
import { FileDetail, typeOf } from '../file-parts.tsx'
import type { WorldFile } from '../links-context.ts'
import navStyles from '../navigation.module.css'
import { PdfViewer } from '../pdf-viewer.tsx'
import { ShellPanel, WikiLayout } from '../wiki.tsx'
import { closeFileTab, openFileTab, useFileTabs } from './file-tabs.ts'
import styles from './world-shell.module.css'

const route = getRouteApi('/mundos/$worldId/archivo/$fileId')

/** Los archivos del mundo (con los comunes), de la misma caché que su lista */
function useWorldFiles(worldId: string) {
  const api = useApi()
  return useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
}

export function WorldFileView() {
  const { worldId, fileId } = route.useParams()
  return (
    <WikiLayout worldId={worldId}>
      {(world) => <OpenFile worldId={worldId} worldName={world.name} fileId={fileId} />}
    </WikiLayout>
  )
}

function OpenFile({ worldId, worldName, fileId }: { worldId: string; worldName: string; fileId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const files = useWorldFiles(worldId)
  const file = files.data?.files.find((each) => each.id === fileId)
  // Abierto, entra en las pestañas (como una página)
  useEffect(() => {
    if (file) openFileTab(worldId, file.id)
  }, [worldId, file])
  useEffect(() => {
    if (file) document.title = t('app.pageTitle', { page: file.name })
  }, [file, t])
  // Las carpetas de su ámbito, para llevarlo a otra desde su ventana
  const folders = useMemo<FolderView[]>(
    () => (files.data?.folders ?? []).filter((folder) => folder.worldId === (file?.worldId ?? null)),
    [files.data, file?.worldId]
  )
  if (!files.data) return null
  if (!file) {
    return (
      <section className={styles.fileMissing}>
        <PageTitle>{t('worldShell.fileNotFound')}</PageTitle>
        <Link to="/mundos/$worldId" params={{ worldId }}>
          {worldName}
        </Link>
      </section>
    )
  }
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['files'] }),
      queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
    ])
  const where = (() => {
    const path: FolderView[] = []
    for (let at = folders.find((f) => f.id === file.folderId); at; at = folders.find((f) => f.id === at?.parentId)) {
      path.unshift(at)
    }
    return path
  })()
  return (
    <div className={styles.entry} data-entry="">
      <div className={styles.scroll}>
        <div className={styles.file}>
          <div className={styles.fileHead}>
            <PageTitle>{file.name}</PageTitle>
            <a href={file.url} download={file.name} className={styles.iconButton} title={t('worldShell.download')}>
              <Download aria-hidden="true" size={16} />
              <span className={styles.hidden}>{t('worldShell.download')}</span>
            </a>
          </div>
          <FileContent file={file} />
        </div>
      </div>
      <ShellPanel label={t('worldShell.filePanel')}>
        <div className={styles.fileSettings}>
          <FileSettings
            file={file}
            folders={folders}
            onMove={async (dest) => {
              await api.call('moveFile', { fileId: file.id, folderId: dest })
              await refresh()
            }}
            onChanged={refresh}
          />
        </div>
        <FileDetail file={file} where={where} />
      </ShellPanel>
    </div>
  )
}

/** Lo de dentro del archivo, según su tipo */
function FileContent({ file }: { file: WorldFile }) {
  const { t } = useTranslation()
  const type = typeOf(file)
  if (type === 'image') return <img className={styles.fileImage} src={file.url} alt={file.name} />
  if (type === 'pdf') return <PdfViewer url={file.url} name={file.name} size={file.size} page={null} />
  if (type === 'audio') {
    // biome-ignore lint/a11y/useMediaCaption: un audio que sube el máster, sin subtítulos
    return <audio className={styles.fileMedia} src={file.url} controls aria-label={file.name} />
  }
  if (type === 'video') {
    // biome-ignore lint/a11y/useMediaCaption: un vídeo que sube el máster, sin subtítulos
    return <video className={styles.fileMedia} src={file.url} controls aria-label={file.name} />
  }
  if (type === 'text') return <FileText url={file.url} />
  return (
    <a href={file.url} download={file.name}>
      {t('worldShell.download')}
    </a>
  )
}

/** Un texto, tal cual */
function FileText({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void fetch(url, { credentials: 'include' })
      .then((response) => (response.ok ? response.text() : ''))
      .then((body) => {
        if (live) setText(body)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [url])
  if (text === null) return null
  return <pre className={styles.fileText}>{text}</pre>
}

/** Las pestañas de los archivos abiertos, en la cabecera tras las de las páginas */
export function FileTabs({ worldId, currentFileId }: { worldId: string; currentFileId: string | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ids = useFileTabs(worldId)
  const files = useWorldFiles(worldId)
  const byId = new Map((files.data?.files ?? []).map((file) => [file.id, file]))
  // Los que ya no están (borrados), fuera
  const shown = files.data ? ids.filter((id) => byId.has(id)) : []
  if (shown.length === 0) return null
  const close = (fileId: string) => {
    const rest = closeFileTab(worldId, fileId).filter((id) => byId.has(id))
    if (fileId !== currentFileId) return
    const next = rest.at(-1)
    void navigate(
      next
        ? { to: '/mundos/$worldId/archivo/$fileId', params: { worldId, fileId: next } }
        : { to: '/mundos/$worldId', params: { worldId } }
    )
  }
  return (
    <nav aria-label={t('worldShell.openFiles')} className={`${navStyles.tabs} ${navStyles.headerTabs}`}>
      <ul>
        {shown.map((id) => {
          const file = byId.get(id) as WorldFile
          return (
            <li key={id} data-current={id === currentFileId || undefined}>
              <Link
                to="/mundos/$worldId/archivo/$fileId"
                params={{ worldId, fileId: id }}
                aria-current={id === currentFileId ? 'page' : undefined}
              >
                {file.name}
              </Link>
              <button
                type="button"
                className={navStyles.tabButton}
                aria-label={t('worldShell.closeFile', { name: file.name })}
                onClick={() => close(id)}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
