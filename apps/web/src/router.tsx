import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import type { BookSearch } from './books/book-tabs.tsx'
import { CampaignBookScreen } from './books/campaign-book.tsx'
import { CalendarEditorScreen } from './calendars/editor.tsx'
import { CalendarsScreen } from './calendars/screen.tsx'
import { CompendiumScreen } from './campaign/compendium.tsx'
import { WorldPagesHome, WorldPageView } from './campaign/world-pages.tsx'
import { CharacterScreen } from './characters/character.tsx'
import { CharactersScreen } from './characters/characters.tsx'
import { PlayerChronologies, PlayerChronology } from './chronologies/player.tsx'
import { ChronologyScreen } from './chronologies/screen.tsx'
import { InPlayScreen } from './creatures/in-play.tsx'
import { LibraryScreen } from './library/library.tsx'
import { NotesScreen } from './notes/screen.tsx'
import { PartyScreen } from './party/route.tsx'
import { Bootstrap } from './routes/bootstrap.tsx'
import { AdventuresScreen, CampaignBooksScreen, CampaignPage, ToMesaIfMaster } from './routes/campaign.tsx'
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
import { ReviewScreen } from './systems/review.tsx'
import { SystemsScreen } from './systems/screen.tsx'
import { SystemRules, SystemScreen } from './systems/system.tsx'
import { SystemBook, SystemCompendium } from './systems/system-compendium.tsx'
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
// Lo que se abre en la Mesa (ADR-0021): ?panel=<pestaña> de su barra (tiradas, combate, escenas…), ?pagina=<id> (una
// página del mundo en su ventana) y ?entrada=<clave> (una entrada del compendio, en la suya)
const mesaSearch = (search: Record<string, unknown>): { panel?: string; pagina?: string; entrada?: string } => ({
  ...(typeof search.panel === 'string' && search.panel ? { panel: search.panel } : {}),
  ...(typeof search.pagina === 'string' && search.pagina ? { pagina: search.pagina } : {}),
  ...(typeof search.entrada === 'string' && search.entrada ? { entrada: search.entrada } : {})
})
// La campaña abre en su Inicio; con lo de la Mesa en la dirección (los enlaces de antes), lleva a la Mesa
const campaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId',
  component: CampaignPage,
  validateSearch: mesaSearch
})
const booksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/libros',
  component: CampaignBooksScreen
})
// Un libro de la campaña, para leer sus capítulos (ADR-0025): también quien juega
const campaignBookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/libros/$bookKey',
  component: CampaignBookScreen,
  validateSearch: (search: Record<string, unknown>): { capitulo?: string } =>
    typeof search.capitulo === 'string' && search.capitulo ? { capitulo: search.capitulo } : {}
})
const adventuresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/aventuras',
  component: AdventuresScreen
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
  component: CompendiumScreen,
  // ?ver=<clave>: lo abierto, para enlazarlo y que «atrás» vuelva a la lista; ?libro=<clave>&tipo=<tipo>: el compendio
  // de un libro (y de un tipo), desde su ficha
  validateSearch: (search: Record<string, unknown>): { ver?: string; libro?: string; tipo?: string } => ({
    ...(typeof search.ver === 'string' && search.ver ? { ver: search.ver } : {}),
    ...(typeof search.libro === 'string' && search.libro ? { libro: search.libro } : {}),
    ...(typeof search.tipo === 'string' && search.tipo ? { tipo: search.tipo } : {})
  })
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
// Las notas del jugador (docs/specs/notas-jugador.md): ?nota=<id>, la abierta; ?de=<cuenta>, el máster leyendo las de un
// jugador
const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/notas',
  component: NotesScreen,
  validateSearch: (search: Record<string, unknown>): { nota?: string; de?: string } => ({
    ...(typeof search.nota === 'string' && search.nota ? { nota: search.nota } : {}),
    ...(typeof search.de === 'string' && search.de ? { de: search.de } : {})
  })
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
  component: MesaScreen,
  validateSearch: mesaSearch
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
  // El máster ve las páginas en su Mesa (ADR-0021: la campaña no tiene Páginas); quien juega, aquí
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
// ?nuevo=true: la página se acaba de crear y se abre con su título por poner; ?pestana=<id>: una pestaña que no es el
// texto (un mapa)
const pageSearch = (search: Record<string, unknown>): { nuevo?: true; pestana?: string } => ({
  ...(search.nuevo === true || search.nuevo === 'true' ? { nuevo: true as const } : {}),
  ...(typeof search.pestana === 'string' && search.pestana ? { pestana: search.pestana } : {})
})
const wikiPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/wiki/$pageId',
  component: WikiPage,
  validateSearch: pageSearch
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
// Los calendarios del mundo (módulo 8) y el editor de uno, a pantalla entera
const calendarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/calendarios',
  component: CalendarsScreen
})
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/calendarios/$calendarId',
  component: CalendarEditorScreen
})
// Una cronología del mundo (módulo 8), a pantalla entera dentro de Calendarios
const chronologyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/calendarios/cronologias/$chronologyId',
  component: ChronologyScreen
})
// Las cronologías que conoce la campaña de quien juega (ADR-0017), y una de ellas
const playerChronologiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/cronologias',
  component: PlayerChronologies
})
const playerChronologyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mundos/$worldId/campanas/$campaignId/cronologias/$chronologyId',
  component: PlayerChronology
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
// Un sistema por dentro: sus libros (ADR-0021); y la revisión de lo que la IA propuso para uno
const systemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sistemas/$systemId',
  component: SystemScreen
})
// Su compendio (todos sus libros) y un libro por dentro: lo abierto, en ?ver
const verSearch = (search: Record<string, unknown>): { ver?: string } =>
  typeof search.ver === 'string' && search.ver ? { ver: search.ver } : {}
const systemCompendiumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sistemas/$systemId/compendio',
  component: SystemCompendium,
  validateSearch: verSearch
})
// Un libro por dentro: sus capítulos (?capitulo, el abierto) o su índice de entradas (?vista=entradas); ADR-0025
const bookSearch = (search: Record<string, unknown>): BookSearch => ({
  ...verSearch(search),
  ...(typeof search.capitulo === 'string' && search.capitulo ? { capitulo: search.capitulo } : {}),
  ...(search.vista === 'capitulos' || search.vista === 'entradas' ? { vista: search.vista } : {})
})
const systemBookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sistemas/$systemId/libros/$bookKey',
  component: SystemBook,
  validateSearch: bookSearch
})
// Sus reglas: el editor a mano llega en la tanda 8
const systemRulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sistemas/$systemId/reglas',
  component: SystemRules
})
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sistemas/$systemId/libros/$bookKey/revisar',
  component: ReviewScreen
})
// Una plantilla abierta, como una página (ADR-0024): ?nuevo y ?pestana, como en la wiki
const templateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plantillas/$templateId',
  component: TemplateView,
  validateSearch: pageSearch
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
  booksRoute,
  campaignBookRoute,
  adventuresRoute,
  compendiumRoute,
  inPlayRoute,
  partyRoute,
  notesRoute,
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
  calendarsRoute,
  calendarRoute,
  chronologyRoute,
  playerChronologiesRoute,
  playerChronologyRoute,
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
  systemRoute,
  systemRulesRoute,
  systemCompendiumRoute,
  systemBookRoute,
  reviewRoute,
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
