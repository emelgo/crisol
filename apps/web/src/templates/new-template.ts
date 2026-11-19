/**
 * Crear una plantilla y abrirla (ADR-0024): «Plantilla sin título», o la copia de otra, como «{nombre} (copia)»; en la
 * carpeta que se diga (la copia, sin decirlo, en la de la original). Se abre con el título listo para escribir
 */
import type { PageTemplate } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { type TabKind, tabRequest } from '../wiki/tabs/kinds.tsx'
import { useTemplates } from './data.ts'

type Listed = ActionOutput<'listTemplates'>

/** Para comparar nombres como el servidor: sin mayúsculas, tildes ni espacios de más */
const nameKey = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim()

type Options = {
  /** Duplicar esa (su página entera, con los mismos campos y su linaje) */
  copyOf?: PageTemplate
  folderId?: string | null
  /** Su nombre; sin él, «Plantilla sin título» (o «{nombre} (copia)»), con un número si ya hay una así */
  name?: string
  /** Su página nace con esa pestaña (un mapa, una pizarra…), como una página nueva (el cuadro de «Plantilla nueva») */
  kind?: TabKind
}

/**
 * Crear una plantilla: sin nombre, «Plantilla sin título» (con un número si ya hay una así), que se abre con el título
 * listo para escribir, como una página nueva. Con una plantilla, la duplica
 */
export function useNewTemplate() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const templates = useTemplates().data?.templates ?? []
  const create = useMutation({
    // copyOf: duplicar esa (su página entera, con los mismos campos y su linaje), como «{nombre} (copia)»
    mutationFn: async ({ copyOf, folderId, name: wanted, kind }: Options) => {
      const named = wanted?.trim() ?? ''
      let name = named
      if (!named) {
        const base = copyOf ? t('templates.copyName', { name: copyOf.name.slice(0, 50) }) : t('templates.untitled')
        const taken = new Set(templates.map((each) => nameKey(each.name)))
        name = base
        for (let n = 2; taken.has(nameKey(name)); n++) name = `${base} ${n}`
      }
      const created = await api.call('createTemplate', {
        name,
        ...(copyOf ? { copyOf: copyOf.id } : {}),
        ...(folderId !== undefined ? { folderId } : {})
      })
      // Si la pestaña falla, la plantilla ya está: se abre igual (sin ella)
      const tab =
        kind && kind !== 'text' && created.pageId
          ? await api.call('createPageTab', { pageId: created.pageId, ...tabRequest(kind) }).catch(() => null)
          : null
      return { created, tab, named: Boolean(named) }
    },
    onSuccess: async ({ created, tab, named }) => {
      // Ya en la lista, para que su página la encuentre al abrirse (la lista de verdad llega después)
      queryClient.setQueryData<Listed>(['templates'], (old) =>
        old ? { ...old, templates: [...old.templates.filter((each) => each.id !== created.id), created] } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      await navigate({
        to: '/plantillas/$templateId',
        params: { templateId: created.id },
        // Sin nombre, se abre para escribirlo; con un mapa, en su pestaña
        search: { ...(named ? {} : { nuevo: true as const }), ...(tab ? { pestana: tab.id } : {}) }
      })
    }
  })
  return {
    mutate: (options: Options = {}, then?: { onSuccess?: () => void }) => create.mutate(options, then),
    isPending: create.isPending,
    errorText: create.error ? errorText(create.error) : null
  }
}
