/**
 * Mover una etiqueta en la lista ya cargada, para verla en su sitio al soltarla sin esperar al servidor (que luego da
 * la de verdad): con sus hijas, renombradas si cambia de madre, delante o detrás de una hermana o al final de su madre
 */
import type { TagView } from '@crisol/contracts'
import { isTagOrChild, tagKey } from '@crisol/domain'
import type { Move } from '../components/tree/moves.ts'

const leafOf = (name: string) => name.split('/').at(-1) ?? name
const depthOf = (name: string) => name.split('/').length - 1

export function moveInTagList(tags: readonly TagView[], name: string, to: Move): TagView[] {
  const branch = tags.filter((tag) => isTagOrChild(tag.name, name))
  if (branch.length === 0) return [...tags]
  const base = to.parentId ? `${to.parentId}/${leafOf(name)}` : leafOf(name)
  const shift = depthOf(base) - depthOf(name)
  const moved = branch.map((tag) => ({
    ...tag,
    name: `${base}${tag.name.trim().slice(name.trim().length)}`,
    depth: tag.depth + shift
  }))
  const rest = tags.filter((tag) => !isTagOrChild(tag.name, name))
  // Detrás de una (o al final de una madre): tras lo último de su rama
  const endOf = (of: string) => {
    let last = rest.findIndex((tag) => tagKey(tag.name) === tagKey(of))
    if (last < 0) return rest.length
    while (last + 1 < rest.length && isTagOrChild(rest[last + 1]?.name ?? '', of)) last++
    return last + 1
  }
  const at = to.before
    ? Math.max(
        0,
        rest.findIndex((tag) => tagKey(tag.name) === tagKey(to.before ?? ''))
      )
    : to.after
      ? endOf(to.after)
      : to.parentId
        ? endOf(to.parentId)
        : rest.length
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)]
}
