/**
 * Los fondos de las pantallas de cuenta (Entrar, unirse, el arranque), que van pasando como en LegendKeeper. Origen y
 * licencia de cada uno en docs/terceros.md: arte digital de Pixabay (licencia de Pixabay: uso libre, sin citar; algunos
 * hechos con IA por su autor) y cuadros de dominio público (Wikimedia Commons). tint: su color medio, para teñir el
 * degradado de encima. Los archivos, en public/fondos/
 */
export interface Backdrop {
  file: string
  title: string
  author: string
  year?: string
  source: string
  license: 'pixabay' | 'dominio-publico'
  tint: string
}

export const BACKDROPS: readonly Backdrop[] = [
  {
    file: 'jinete-de-dragon',
    title: 'Jinete de dragón',
    author: 'GBTaylor',
    source: 'https://pixabay.com/illustrations/dragon-dragon-rider-ai-generated-8029890/',
    license: 'pixabay',
    tint: '#1d1b1c'
  },
  {
    file: 'dragon-ciudad-en-llamas',
    title: 'Dragón sobre la ciudad en llamas',
    author: 'MythologyArt',
    source: 'https://pixabay.com/illustrations/dragon-fire-pagan-epic-fantasy-8780168/',
    license: 'pixabay',
    tint: '#22120a'
  },
  {
    file: 'arbol-de-luz',
    title: 'El árbol de la luz',
    author: 'Alan_Frijns',
    source: 'https://pixabay.com/illustrations/ai-generated-tree-magical-mystical-8167332/',
    license: 'pixabay',
    tint: '#12100b'
  },
  {
    file: 'reino-dorado',
    title: 'El reino dorado',
    author: 'artandmusic909',
    source: 'https://pixabay.com/illustrations/golden-kingdom-elven-kingdom-fantasy-8164867/',
    license: 'pixabay',
    tint: '#18140d'
  },
  {
    file: 'castillo-nubes-doradas',
    title: 'Castillo entre nubes doradas',
    author: 'TheDigitalArtist',
    source: 'https://pixabay.com/illustrations/dragon-castle-fantasy-magic-4767447/',
    license: 'pixabay',
    tint: '#2c2212'
  },
  {
    file: 'dragon-en-el-bosque',
    title: 'Dragón en el bosque',
    author: 'Artie_Navarre',
    source: 'https://pixabay.com/illustrations/painting-the-framework-dragon-3564055/',
    license: 'pixabay',
    tint: '#1e2119'
  },
  {
    file: 'rios-de-fuego',
    title: 'Ríos de fuego entre montañas',
    author: 'NickyPe',
    source: 'https://pixabay.com/illustrations/ai-generated-mountains-night-8699087/',
    license: 'pixabay',
    tint: '#080a0d'
  },
  {
    file: 'ciudad-purpura',
    title: 'Ciudad púrpura bajo la luna',
    author: 'Eynoxart',
    source: 'https://pixabay.com/illustrations/dark-academia-city-fantasy-art-7471412/',
    license: 'pixabay',
    tint: '#281722'
  },
  {
    file: 'dragon-negro',
    title: 'Dragón negro',
    author: 'MythologyArt',
    source: 'https://pixabay.com/illustrations/black-dragon-dragon-fantasy-art-8808267/',
    license: 'pixabay',
    tint: '#1c1812'
  },
  {
    file: 'ciudad-de-torres',
    title: 'Ciudad de torres entre nubes',
    author: 'bojanboyss',
    source: 'https://pixabay.com/illustrations/ai-generated-towers-skyscrapers-8907200/',
    license: 'pixabay',
    tint: '#1e2122'
  },
  {
    file: 'arbol-antiguo',
    title: 'El árbol antiguo en la niebla',
    author: 'JuliusH',
    source: 'https://pixabay.com/illustrations/ai-generated-tree-fog-forest-8487767/',
    license: 'pixabay',
    tint: '#161a16'
  },
  {
    file: 'vasnetsov-encrucijada',
    title: 'El caballero en la encrucijada',
    author: 'Víktor Vasnetsov',
    year: '1882',
    source:
      'https://commons.wikimedia.org/wiki/File:Victor_Vasnetsov_-_Knight_at_the_Crossroads_-_Google_Art_Project.jpg',
    license: 'dominio-publico',
    tint: '#231c1a'
  },
  {
    file: 'vasnetsov-bogatyres',
    title: 'Los bogatyres',
    author: 'Víktor Vasnetsov',
    year: '1898',
    source:
      'https://commons.wikimedia.org/wiki/File:Viktor_Vasnetsov_-_%D0%91%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D0%B8_-_Google_Art_Project.jpg',
    license: 'dominio-publico',
    tint: '#211d0f'
  },
  {
    file: 'arbo-caceria-salvaje',
    title: 'La cacería salvaje de Odín',
    author: 'Peter Nicolai Arbo',
    year: '1872',
    source:
      'https://commons.wikimedia.org/wiki/File:Peter_Nicolai_Arbo_-_The_wild_Hunt_of_Odin_-_NG.M.00258_-_National_Museum_of_Art,_Architecture_and_Design.jpg',
    license: 'dominio-publico',
    tint: '#100f0c'
  },
  {
    file: 'aivazovski-novena-ola',
    title: 'La novena ola',
    author: 'Iván Aivazovski',
    year: '1850',
    source: 'https://commons.wikimedia.org/wiki/File:Aivazovsky,_Ivan_-_The_Ninth_Wave.jpg',
    license: 'dominio-publico',
    tint: '#2d1d0e'
  },
  {
    file: 'bierstadt-sierra-nevada',
    title: 'Entre las montañas de Sierra Nevada',
    author: 'Albert Bierstadt',
    year: '1868',
    source: 'https://commons.wikimedia.org/wiki/File:Bierstadt_-_Among_the_Sierra_Nevada_Mountains_-_1868.jpg',
    license: 'dominio-publico',
    tint: '#1f1e1b'
  },
  {
    file: 'bocklin-isla-de-los-muertos',
    title: 'La isla de los muertos',
    author: 'Arnold Böcklin',
    year: '1880',
    source: 'https://commons.wikimedia.org/wiki/File:Arnold_B%C3%B6cklin_-_Die_Toteninsel_I_(Basel,_Kunstmuseum).jpg',
    license: 'dominio-publico',
    tint: '#10100e'
  },
  {
    file: 'church-cotopaxi',
    title: 'Cotopaxi',
    author: 'Frederic Edwin Church',
    year: '1862',
    source: 'https://commons.wikimedia.org/wiki/File:Cotopaxi_church.jpg',
    license: 'dominio-publico',
    tint: '#34241c'
  },
  {
    file: 'cole-viaje-de-la-vida',
    title: 'El viaje de la vida: la infancia',
    author: 'Thomas Cole',
    year: '1842',
    source:
      'https://commons.wikimedia.org/wiki/File:Thomas_Cole_-_The_Voyage_of_Life_Childhood,_1842_(National_Gallery_of_Art).jpg',
    license: 'dominio-publico',
    tint: '#231b13'
  },
  {
    file: 'friedrich-mar-de-hielo',
    title: 'El mar de hielo',
    author: 'Caspar David Friedrich',
    year: '1823',
    source:
      'https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Das_Eismeer_-_Hamburger_Kunsthalle_-_02.jpg',
    license: 'dominio-publico',
    tint: '#2c2a29'
  },
  {
    file: 'martin-el-bardo',
    title: 'El bardo',
    author: 'John Martin',
    year: '1817',
    source: 'https://commons.wikimedia.org/wiki/File:JohnMartin_The_Bard_RTNX.jpg',
    license: 'dominio-publico',
    tint: '#202220'
  },
  {
    file: 'martin-gran-dia-de-su-ira',
    title: 'El gran día de su ira',
    author: 'John Martin',
    year: '1853',
    source: 'https://commons.wikimedia.org/wiki/File:John_Martin_-_The_Great_Day_of_His_Wrath_-_Google_Art_Project.jpg',
    license: 'dominio-publico',
    tint: '#171a19'
  },
  {
    file: 'martin-pandemonium',
    title: 'Pandemónium',
    author: 'John Martin',
    year: '1841',
    source: 'https://commons.wikimedia.org/wiki/File:John_Martin_Le_Pandemonium_Louvre.JPG',
    license: 'dominio-publico',
    tint: '#150a04'
  },
  {
    file: 'turner-anibal-alpes',
    title: 'Tormenta de nieve: Aníbal cruzando los Alpes',
    author: 'J. M. W. Turner',
    year: '1812',
    source: 'https://commons.wikimedia.org/wiki/File:Turner,_Snow_Storm,_50508403226_b272cf84c3_o.jpg',
    license: 'dominio-publico',
    tint: '#22201e'
  }
]
