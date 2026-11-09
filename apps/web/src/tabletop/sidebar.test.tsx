import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../i18n.ts'
import { visiblePages } from './pages-tab.tsx'
import {
  type SidebarItem,
  type SidebarTab,
  TableSidebar,
  tabOfSlug,
  useSidebarFolded,
  useSidebarTab
} from './sidebar.tsx'

const ALL: readonly SidebarTab[] = ['combat', 'scenes', 'characters', 'compendium', 'pages', 'settings']

function Harness({ asked = null, allowed = ALL }: { asked?: SidebarTab | null; allowed?: readonly SidebarTab[] }) {
  const [tab, setTab] = useSidebarTab(allowed, asked)
  const [folded, setFolded] = useSidebarFolded()
  const items: SidebarItem[] = allowed.map((key) => ({
    key,
    content: () => <p>Panel de {key}</p>,
    dot: key === 'combat'
  }))
  return <TableSidebar items={items} tab={tab} onTab={setTab} folded={folded} onFold={setFolded} />
}

describe('la barra de la Mesa', () => {
  it('la primera vez abre Escenas; cada pestaña, su panel; al volver, la última', async () => {
    const user = userEvent.setup()
    const view = render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Escenas' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel de scenes')
    expect(screen.getByRole('heading', { name: 'Escenas' })).toBeDefined()
    await user.click(screen.getByRole('tab', { name: 'Compendio' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel de compendium')
    view.unmount()
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Compendio' }).getAttribute('aria-selected')).toBe('true')
  })

  it('la dirección manda sobre la última; la que no puede ver quien mira, no', () => {
    localStorage.setItem('crisol.mesa.pestana', 'settings')
    const view = render(<Harness asked="combat" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel de combat')
    view.unmount()
    render(<Harness allowed={['combat', 'pages']} />)
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel de combat')
  })

  it('con las flechas, Inicio y Fin se cambia de pestaña, y el foco va con ella', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'Escenas' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Personajes' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel de characters')
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Campaña' }))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /^Combate/ }))
    await user.keyboard('{ArrowLeft}{Home}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /^Combate/ }))
    // Solo la pestaña abierta está en el orden del tabulador
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
  })

  it('plegada queda una columna de iconos; uno de ellos la despliega en su pestaña, y se recuerda', async () => {
    const user = userEvent.setup()
    const view = render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Plegar la barra' }))
    expect(screen.queryByRole('tabpanel')).toBeNull()
    view.unmount()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /^Combate/ }))
    expect(screen.getByRole('tab', { name: /^Combate/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel de combat')
  })

  it('cada pestaña tiene su nombre en la dirección', () => {
    expect(tabOfSlug('campana')).toBe('settings')
    // El nombre de antes, para los enlaces guardados
    expect(tabOfSlug('ajustes')).toBe('settings')
    expect(tabOfSlug('paginas')).toBe('pages')
    expect(tabOfSlug('otra')).toBeNull()
    expect(tabOfSlug(undefined)).toBeNull()
  })
})

describe('el árbol de la pestaña Páginas', () => {
  const page = (id: string, parentId: string | null, title: string, level: number, hasChildren = false) => ({
    id,
    parentId,
    title,
    icon: null,
    level,
    hasChildren
  })
  const pages = [
    page('a', null, 'Lugares', 0, true),
    page('b', 'a', 'Puerto Gris', 1, true),
    page('c', 'b', 'Los muelles', 2),
    page('d', null, 'Personajes', 0, true),
    page('e', 'd', 'Aldric Varn', 1)
  ]

  it('sin buscar, las de primer nivel y las de las ramas abiertas', () => {
    expect(visiblePages(pages, new Set(), '').map((p) => p.title)).toEqual(['Lugares', 'Personajes'])
    expect(visiblePages(pages, new Set(['a']), '').map((p) => p.title)).toEqual([
      'Lugares',
      'Puerto Gris',
      'Personajes'
    ])
    // Una rama abierta dentro de una cerrada no se ve
    expect(visiblePages(pages, new Set(['b']), '').map((p) => p.title)).toEqual(['Lugares', 'Personajes'])
  })

  it('buscando, las que coinciden, sin tildes ni mayúsculas', () => {
    expect(visiblePages(pages, new Set(), 'ALDRIC').map((p) => p.title)).toEqual(['Aldric Varn'])
    expect(visiblePages(pages, new Set(), 'muelles').map((p) => p.title)).toEqual(['Los muelles'])
    expect(visiblePages([page('x', null, 'Él', 0)], new Set(), 'el').map((p) => p.title)).toEqual(['Él'])
  })
})
