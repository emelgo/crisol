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
import { useTemplates } from './data.ts'

type Listed = ActionOutput<'listTemplates'>

/** Para comparar nombres como el servidor: sin mayúsculas, tildes ni espacios de más */
const nameKey = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim()

/**
 * «Plantilla nueva»: crea «Plantilla sin título» (con un número si ya hay una así) y la abre con el título listo para
 * escribir, como una página nueva. Con una plantilla, la duplica
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
    mutationFn: ({ copyOf, folderId }: { copyOf?: PageTemplate; folderId?: string | null }) => {
      const base = copyOf ? t('templates.copyName', { name: copyOf.name.slice(0, 50) }) : t('templates.untitled')
      const taken = new Set(templates.map((each) => nameKey(each.name)))
      let name = base
      for (let n = 2; taken.has(nameKey(name)); n++) name = `${base} ${n}`
      return api.call('createTemplate', {
        name,
        ...(copyOf ? { copyOf: copyOf.id } : {}),
        ...(folderId !== undefined ? { folderId } : {})
      })
    },
    onSuccess: async (created) => {
      // Ya en la lista, para que su página la encuentre al abrirse (la lista de verdad llega después)
      queryClient.setQueryData<Listed>(['templates'], (old) =>
        old ? { ...old, templates: [...old.templates.filter((each) => each.id !== created.id), created] } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      await navigate({ to: '/plantillas/$templateId', params: { templateId: created.id }, search: { nuevo: true } })
    }
  })
  return {
    mutate: (options: { copyOf?: PageTemplate; folderId?: string | null } = {}) => create.mutate(options),
    isPending: create.isPending,
    errorText: create.error ? errorText(create.error) : null
  }
}
