export type Language = 'es' | 'en'

export function tx(language: Language, spanish: string, english: string): string {
  return language === 'en' ? english : spanish
}

type SpeciesField = 'name' | 'status' | 'ecology' | 'conservation'

const ENGLISH_SPECIES: Record<string, Record<SpeciesField, string>> = {
  frailejon: {
    name: 'Ruiz frailejón',
    status: 'Key species • Protected',
    ecology: 'Its fuzzy leaves capture mist droplets and regulate water that supplies Caldas and the Coffee Region. It provides shelter for up to 150 species.',
    conservation: 'Do not touch or remove its dry leaves; they insulate it against freezing temperatures at night.',
  },
  chivito: {
    name: 'Buffy helmetcrest',
    status: 'Endemic to Los Nevados • Vulnerable',
    ecology: 'A hummingbird found only in the páramos of Nevado del Ruiz. It rests on frailejón flowers to conserve energy and uses plant down to build its nest.',
    conservation: 'Observe quietly from a distance. Flash photography is prohibited.',
  },
  condor: {
    name: 'Andean condor',
    status: 'Endangered',
    ecology: 'A top scavenger that helps keep the high-mountain ecosystem clean and glides on volcanic thermal currents.',
    conservation: 'Do not leave organic waste or litter in the mountains.',
  },
  oso: {
    name: 'Spectacled bear',
    status: 'Vulnerable',
    ecology: 'South America’s only bear; it disperses seeds and opens clearings in Andean forest and páramo vegetation.',
    conservation: 'Keep a safe distance (at least 50 m), do not feed it, and report sightings to park rangers when descending.',
  },
  danta: {
    name: 'Mountain tapir',
    status: 'Endangered • Umbrella species',
    ecology: 'The páramo’s largest herbivorous mammal; it creates natural trails and disperses palm and Andean shrub seeds.',
    conservation: 'Do not block trails near streams or make excessive noise in foggy areas.',
  },
  loro: {
    name: 'Yellow-eared parrot',
    status: 'Vulnerable • Dependent on wax palms',
    ecology: 'Lives in flocks in cloud forests and nests exclusively in hollow wax-palm trunks.',
    conservation: 'Protect wax-palm forests and avoid drones or loud noise near nesting areas.',
  },
  palma: {
    name: 'Quindío wax palm',
    status: 'National tree • Endangered',
    ecology: 'The world’s tallest palm (up to 60 m); it supports food webs for birds such as the yellow-eared parrot in Andean forest.',
    conservation: 'Do not cut its growing tips or damage its waxy bark.',
  },
  pato: {
    name: 'Andean duck',
    status: 'High-Andean resident • Wetland indicator',
    ecology: 'Lives in glacial lakes such as Otún and Laguna Verde; it helps regulate aquatic insects and peatland plants.',
    conservation: 'Keep away from Ramsar lake shores and do not contaminate the water with sunscreen or waste.',
  },
  romero: {
    name: 'Páramo rosemary',
    status: 'Native to the subpáramo',
    ecology: 'An aromatic shrub with leathery leaves that stabilizes volcanic soils and provides nectar for bumblebees and hummingbirds.',
    conservation: 'Do not remove branches for fires or herbal infusions inside the park.',
  },
  cacho: {
    name: 'Deer-horn plant',
    status: 'Superpáramo specialist',
    ecology: 'A low-growing shrub with flattened stems that withstands night frost and stabilizes wind-exposed volcanic sands.',
    conservation: 'Stay on marked trails; this plant grows extremely slowly.',
  },
  zorro: {
    name: 'Páramo fox',
    status: 'Native high-Andean canid',
    ecology: 'A medium-sized predator that controls rodent and páramo rabbit populations, helping maintain grassland balance.',
    conservation: 'Never feed it or approach for photos; do not habituate it to people.',
  },
  musgo: {
    name: 'Peat moss (water cushion)',
    status: 'Key water-regulating species',
    ecology: 'Can absorb up to 20 times its weight in rain and mist, forming peatlands that feed rivers in the Coffee Region.',
    conservation: 'Do not walk on peatlands or wetlands; one footprint can compact the soil for decades.',
  },
}

export function speciesText(
  language: Language,
  id: string,
  field: SpeciesField,
  fallback: string,
): string {
  return language === 'en' ? ENGLISH_SPECIES[id]?.[field] ?? fallback : fallback
}

export function localizedSpeciesName(language: Language, spanishName: string | null): string | null {
  if (!spanishName || language === 'es') return spanishName
  const speciesId = Object.entries({
    frailejon: ['Frailejón del Ruiz'],
    chivito: ['Chivito de Páramo (Barbudito Canelo)', 'Chivito de Páramo'],
    condor: ['Cóndor de los Andes'],
    oso: ['Oso de Anteojos'],
    danta: ['Danta de Montaña (Tapir Andino)', 'Danta de Montaña'],
    loro: ['Loro Orejiamarillo'],
    palma: ['Palma de Cera del Quindío'],
    pato: ['Pato Andino (Pato Paramuno)', 'Pato Andino'],
    romero: ['Romero de Páramo'],
    cacho: ['Cacho de Venado'],
    zorro: ['Zorro de Páramo (Lobo Colorado)', 'Zorro de Páramo'],
    musgo: ['Musgo Turbero (Colchón de Agua)', 'Musgo Turbero'],
  }).find(([, names]) => names.includes(spanishName))?.[0]
  return speciesId ? speciesText(language, speciesId, 'name', spanishName) : spanishName
}

export function translateElevationZone(language: Language, spanish: string): string {
  if (language === 'es') return spanish
  return ({
    'Bosque Altoandino': 'High-Andean forest',
    Subpáramo: 'Subpáramo',
    'Páramo Propiamente Dicho': 'Páramo',
    Superpáramo: 'Superpáramo',
  }[spanish] ?? spanish)
}
