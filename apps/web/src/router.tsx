import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { CompendiumScreen } from './campaign/compendium.tsx'
import { WorldPagesHome, WorldPageView } from './campaign/world-pages.tsx'
import { CharacterScreen } from './characters/character.tsx'
import { CharactersScreen } from './characters/characters.tsx'
import { InPlayScreen } from './creatures/in-play.tsx'
import { LibraryScreen } from './library/library.tsx'
import { PartyScreen } from './party/route.tsx'
import { Bootstrap } from './routes/bootstrap.tsx'
import { CampaignPage, ToMesaIfMaster } from './routes/campaign.tsx'
import { CampaignsPage } from './routes/campaigns.tsx'
import { Consent } from './routes/consent.tsx'
import { OrganizationHistory, WorldHistory } from './routes/history.tsx'
import { Home } from './routes/home.tsx'
import { Join } from './routes/join.tsx'
import { Profile } from './routes/profile.tsx'
import { NotFound, RootLayout } from './routes/root.tsx'
import { Settings } from './routes/settings.tsx'
import { SignIn } from './routes/sign-in.tsx'
import { OrganizationTrash, WorldTrash } from './routes/trash.tsx'
import { WorldPage } from './routes/world.tsx'
import { Worlds } from './routes/worlds.tsx'
import { SystemsScreen } from './systems/screen.tsx'
import { MesaScreen } from './tabletop/mesa.tsx'
import { ScreenRoute } from './tabletop/screen.tsx'
import { TemplateView } from './templates/editor.tsx'
import { TemplatesScreen } from './templates/screen.tsx'
import { CommonFiles, WikiFiles } from './wiki/files.tsx'
import { searchParams, WikiSearch } from './wiki/search.tsx'
import { PrintPage, printParams } from './wiki/sheet/print.tsx'
import { AccountTags, WorldTagsRedirect } from './wiki/tags.tsx'
import { WikiHome, WikiPage } from './wiki/wiki.tsx'

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })

// Las direcciones que ve la gente van en español
const signInRoute = createRoute({ getParentRoute: () => rootRoute, path: '/entrar', component: SignIn })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', component: Profile })
const worldsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mundos', component: Worlds })
const worldRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mundos/$worldId', component: WorldPage })
const campaignsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas',
  component: CampaignsPage
})
const campaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId',
  component: CampaignPage,
  // ?panel=<pestaña>: la pestaña abierta de la barra de la Mesa (tiradas, combate, escenas…)
  // ?pagina=<id>: una página del mundo que se abre en su ventana sobre la Mesa (los enlaces de antes a /paginas/$p)
  validateSearch: (search: Record<string, unknown>): { panel?: string; pagina?: string } => ({
    ...(typeof search.panel === 'string' && search.panel ? { panel: search.panel } : {}),
    ...(typeof search.pagina === 'string' && search.pagina ? { pagina: search.pagina } : {})
  })
})
const charactersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/personajes',
  component: CharactersScreen
})
const characterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/personajes/$characterId',
  component: CharacterScreen,
  // ?vista=ficha o ?vista=creador: la vista del personaje, para enlazarla y que no se pierda al recargar
  validateSearch: (search: Record<string, unknown>): { vista?: 'ficha' | 'creador' } =>
    search.vista === 'ficha' || search.vista === 'creador' ? { vista: search.vista } : {}
})
const compendiumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/compendio',
  component: () => (
    <ToMesaIfMaster panel="compendio">
      <CompendiumScreen />
    </ToMesaIfMaster>
  ),
  // ?ver=<clave>: lo abierto, para enlazarlo y que «atrás» vuelva a la lista
  validateSearch: (search: Record<string, unknown>): { ver?: string } =>
    typeof search.ver === 'string' && search.ver ? { ver: search.ver } : {}
})
const inPlayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/en-juego',
  component: () => (
    <ToMesaIfMaster panel="personajes">
      <InPlayScreen />
    </ToMesaIfMaster>
  ),
  // ?ver=<id>: la criatura abierta
  validateSearch: (search: Record<string, unknown>): { ver?: string } =>
    typeof search.ver === 'string' && search.ver ? { ver: search.ver } : {}
})
const partyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/grupo',
  component: PartyScreen
})
// La mesa del máster y la pantalla de la tele (docs/specs/escenas.md)
const tableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/mesa',
  component: MesaScreen
})
const screenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/pantalla',
  component: ScreenRoute
})
const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/biblioteca',
  component: () => (
    <ToMesaIfMaster panel="compendio">
      <LibraryScreen />
    </ToMesaIfMaster>
  ),
  // ?libro=<id>&pagina=<n>&q=<lo buscado>: el libro abierto, en su página, con lo buscado marcado
  validateSearch: (search: Record<string, unknown>): { libro?: string; pagina?: number; q?: string } => {
    const page = Number(search.pagina)
    return {
      ...(typeof search.libro === 'string' && search.libro ? { libro: search.libro } : {}),
      ...(Number.isInteger(page) && page > 0 ? { pagina: page } : {}),
      ...(typeof search.q === 'string' && search.q ? { q: search.q } : {})
    }
  }
})
// Las páginas del mundo desde una campaña, con lo que sabe (ADR-0017); ?como=<personaje>: el máster, como él;
// ?pestana=<id>: una pestaña de la página que no es su texto
const asSearch = (search: Record<string, unknown>): { como?: string; pestana?: string } => ({
  ...(typeof search.como === 'string' && search.como ? { como: search.como } : {}),
  ...(typeof search.pestana === 'string' && search.pestana ? { pestana: search.pestana } : {})
})
const worldPagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/paginas',
  component: () => (
    <ToMesaIfMaster panel="paginas">
      <WorldPagesHome />
    </ToMesaIfMaster>
  ),
  validateSearch: asSearch
})
const worldPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/paginas/$pageId',
  component: () => (
    <ToMesaIfMaster panel="paginas">
      <WorldPageView />
    </ToMesaIfMaster>
  ),
  validateSearch: asSearch
})
const wikiRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mundos/$worldId/wiki', component: WikiHome })
const wikiPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/wiki/$pageId',
  component: WikiPage,
  // ?nuevo=true: la página se acaba de crear y se abre con su título por poner; ?pestana=<id>: una pestaña que no es
  // el texto (un mapa)
  validateSearch: (search: Record<string, unknown>): { nuevo?: true; pestana?: string } => ({
    ...(search.nuevo === true || search.nuevo === 'true' ? { nuevo: true as const } : {}),
    ...(typeof search.pestana === 'string' && search.pestana ? { pestana: search.pestana } : {})
  })
})
const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/etiquetas',
  component: WorldTagsRedirect
})
const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/archivos',
  component: WikiFiles
})
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/buscar',
  component: WikiSearch,
  validateSearch: searchParams
})
const printRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/imprimir/$pageId',
  component: PrintPage,
  validateSearch: printParams
})
const worldHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/historial',
  component: WorldHistory
})
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/historial',
  component: OrganizationHistory
})
const worldTrashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/papelera',
  component: WorldTrash
})
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ajustes', component: Settings })
// Los archivos comunes de la cuenta, fuera de los mundos (ADR-0005)
const commonFilesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/archivos', component: CommonFiles })
// Las etiquetas de la cuenta, en la zona de Mis mundos (ADR-0006)
const accountTagsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/etiquetas', component: AccountTags })
// Los sistemas de reglas de la cuenta, también en la zona de Mis mundos (ADR-0011)
const systemsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sistemas', component: SystemsScreen })
// Las plantillas de página de la cuenta, también en la zona de Mis mundos (ADR-0009)
const templatesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/plantillas', component: TemplatesScreen })
const templateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plantillas/$templateId',
  component: TemplateView
})
const trashRoute = createRoute({ getParentRoute: () => rootRoute, path: '/papelera', component: OrganizationTrash })
const consentRoute = createRoute({ getParentRoute: () => rootRoute, path: '/oauth/consentimiento', component: Consent })
const joinRoute = createRoute({ getParentRoute: () => rootRoute, path: '/unirse/$secret', component: Join })
const bootstrapRoute = createRoute({ getParentRoute: () => rootRoute, path: '/arranque/$secret', component: Bootstrap })

const routeTree = rootRoute.addChildren([
  homeRoute,
  signInRoute,
  profileRoute,
  worldsRoute,
  worldRoute,
  campaignsRoute,
  campaignRoute,
  compendiumRoute,
  inPlayRoute,
  partyRoute,
  tableRoute,
  screenRoute,
  libraryRoute,
  worldPagesRoute,
  worldPageRoute,
  charactersRoute,
  characterRoute,
  wikiRoute,
  wikiPageRoute,
  tagsRoute,
  filesRoute,
  searchRoute,
  printRoute,
  worldHistoryRoute,
  historyRoute,
  worldTrashRoute,
  trashRoute,
  settingsRoute,
  commonFilesRoute,
  accountTagsRoute,
  templatesRoute,
  systemsRoute,
  templateRoute,
  consentRoute,
  bootstrapRoute,
  joinRoute
])

/** Sin historia, usa la del navegador */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
