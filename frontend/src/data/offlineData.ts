import type {
  BitacoraEntry,
  ChatResponse,
  EmergenciaContacto,
  Especie,
  PisoTermico,
  ProtocoloVida,
  RadarResponse,
  RiesgoSoroche,
  Ruta,
  VisionResponse,
} from '../types/paramo'

export const OFFLINE_RUTAS: Ruta[] = [
  {
    id: 'brisas-valle-tumbas',
    nombre: 'Corredor Brisas – Valle de las Tumbas',
    sector: 'Norte (Villamaría / Manizales, Caldas)',
    altitud_rango: '4.100 - 4.450 m s.n.m.',
    altitud_min_m: 4100,
    altitud_max_m: 4450,
    distancia_km: 4.5,
    dificultad: 'Media-Alta (Exigencia por altitud)',
    coordenadas: { lat: 4.9362, lon: -75.3586 },
    estaciones: [
      'Aguacerales (4.180 m): Transición a superpáramo y afloramientos hídricos.',
      'Arenales (4.230 m): Dunas de arena volcánica moldeadas por el viento.',
      'Valle Lunar (4.300 m): Paisaje volcánico de baja vegetación.',
      'Valle de las Tumbas (4.450 m): Punto máximo autorizado por seguridad volcánica frente al Volcán Nevado del Ruiz (Kumanday).',
    ],
    reglas: 'Ingreso de 8:00 a.m. a 2:00 p.m. Obligatorio guía avalado. Prohibido menores de 6 años.',
  },
  {
    id: 'cisne-laguna-verde',
    nombre: 'Travesía Cisne – Laguna Verde (Poleka Kasue)',
    sector: 'Caldas / Tolima',
    altitud_rango: '3.900 - 4.650 m s.n.m.',
    altitud_min_m: 3900,
    altitud_max_m: 4650,
    distancia_km: 6.2,
    dificultad: 'Alta',
    coordenadas: { lat: 4.8414, lon: -75.3492 },
    estaciones: [
      'Humedales de altura: Colchones de agua y turberas.',
      'Laguna Verde: Cuerpo de agua glaciar con tonalidad esmeralda por minerales.',
      'Borde Paramillo del Cisne: Vista al Nevado Santa Isabel.',
    ],
    reglas: 'Requiere reserva con 3 días hábiles de anticipación. Prohibido salirse del sendero.',
  },
  {
    id: 'potosi-laguna-otun',
    nombre: 'Sendero Potosí – Laguna del Otún',
    sector: 'Occidental (Caldas / Risaralda)',
    altitud_rango: '3.950 - 4.150 m s.n.m.',
    altitud_min_m: 3950,
    altitud_max_m: 4150,
    distancia_km: 5.0,
    dificultad: 'Media',
    coordenadas: { lat: 4.7825, lon: -75.4197 },
    estaciones: [
      'Bosque de Frailejones: Densidad alta de Espeletia hartwegiana.',
      'Mirador Laguna del Otún: Complejo lagunar Ramsar, fábrica de agua del Eje Cafetero.',
    ],
    reglas: 'Prohibida la pesca, fogatas y drones.',
  },
]

export const OFFLINE_PISOS: PisoTermico[] = [
  {
    piso: 'Bosque Altoandino',
    min_m: 2300,
    max_m: 3200,
    temp: '10°C - 14°C',
    descripcion: 'Selva de niebla con árboles retorcidos, musgos y transición hacia la palma de cera.',
    especies_clave: ['Oso de anteojos', 'Loro orejiamarillo', 'Palma de cera'],
  },
  {
    piso: 'Subpáramo',
    min_m: 3201,
    max_m: 3500,
    temp: '7°C - 10°C',
    descripcion: 'Arbustos bajos, romeros de páramo y mortiños; zona de alta actividad de polinizadores.',
    especies_clave: ['Romero de páramo', 'Chivito de páramo', 'Danta de montaña'],
  },
  {
    piso: 'Páramo Propiamente Dicho',
    min_m: 3501,
    max_m: 4100,
    temp: '4°C - 7°C',
    descripcion: 'Fábrica de agua dominada por frailejonales, pajonales y turberas esponjosas.',
    especies_clave: ['Frailejón del Ruiz', 'Chivito de páramo', 'Pato andino'],
  },
  {
    piso: 'Superpáramo',
    min_m: 4101,
    max_m: 4800,
    temp: '0°C - 3°C',
    descripcion: 'Tundra alpina de arenas volcánicas, líquenes y plantas almohadilla antes del glaciar.',
    especies_clave: ['Cacho de venado', 'Cóndor de los Andes', 'Líquenes crustáceos'],
  },
]

export const OFFLINE_ESPECIES: Especie[] = [
  {
    id: 'frailejon',
    nombre_comun: 'Frailejón del Ruiz',
    nombre_cientifico: 'Espeletia hartwegiana',
    tipo: 'Flora',
    estado: 'Especie Clave • Protegida',
    rol_ecologico:
      'Sus hojas vellosas atrapan gotas de la neblina y regulan el agua que abastece a Caldas y el Eje Cafetero. Refugia hasta 150 especies.',
    alerta_conservacion:
      'No tocar ni arrancar sus hojas secas; son su abrigo térmico contra el congelamiento nocturno.',
  },
  {
    id: 'chivito',
    nombre_comun: 'Chivito de Páramo (Barbudito Canelo)',
    nombre_cientifico: 'Oxypogon stubelii',
    tipo: 'Fauna',
    estado: 'Endémico PNN Los Nevados • Vulnerable',
    rol_ecologico:
      'Colibrí exclusivo de los páramos del Nevado del Ruiz. Se posa en las flores de frailejón para ahorrar energía y usa su lana para hacer nidos.',
    alerta_conservacion: 'Observar en silencio a distancia. Prohibido el uso de flash.',
  },
  {
    id: 'condor',
    nombre_comun: 'Cóndor de los Andes',
    nombre_cientifico: 'Vultur gryphus',
    tipo: 'Fauna',
    estado: 'En Peligro',
    rol_ecologico: 'Carroñero supremo que mantiene limpio el ecosistema de alta montaña.',
    alerta_conservacion: 'No dejar ningún residuo orgánico ni basura en la montaña.',
  },
  {
    id: 'oso',
    nombre_comun: 'Oso de Anteojos',
    nombre_cientifico: 'Tremarctos ornatus',
    tipo: 'Fauna',
    estado: 'Vulnerable',
    rol_ecologico:
      'Jardinero del bosque altoandino y páramo; dispersa semillas y abre claros en la vegetación.',
    alerta_conservacion:
      'Mantener distancia segura y reportar avistamientos a guardaparques al descender.',
  },
]

export const OFFLINE_PROTOCOLOS: Record<string, ProtocoloVida> = {
  soroche: {
    titulo: 'Protocolo Mal Agudo de Montaña (Soroche)',
    sintomas: [
      'Dolor de cabeza pulsátil',
      'Náuseas o vómito',
      'Mareo intenso',
      'Fatiga extrema o falta de aire en reposo',
    ],
    accion_inmediata:
      '1. DETENER el ascenso inmediatamente. 2. Hidratarse con pequeños sorbos de agua. 3. DESCENDER al menos 500 metros de altitud acompañado. 4. Notificar al guía o puesto de control Brisas/Potosí.',
  },
  hipotermia: {
    titulo: 'Protocolo Prevención de Hipotermia',
    sintomas: [
      'Temblores incontrolables',
      'Torpeza en manos',
      'Habla arrastrada o confusión',
    ],
    accion_inmediata:
      '1. Refugiar del viento. 2. Cambiar ropa húmeda por prendas secas (sistema 3 capas). 3. Dar bebidas tibias azucaradas si está consciente. 4. Descender de inmediato.',
  },
  volcanico: {
    titulo: 'Protocolo de Seguridad Volcánica (Kumanday / Ruiz)',
    sintomas: [
      'Olor fuerte a azufre o irritación ocular',
      'Caída repentina de ceniza volcánica',
      'Sismo sentido o instrucción de guardaparques',
    ],
    accion_inmediata:
      '1. Cubrir nariz y boca con pañuelo húmedo o mascarilla. 2. Alejarse de quebradas y cauces de ríos por riesgo de flujos. 3. Evacuar hacia puntos altos laterales siguiendo únicamente al guía avalado y los carteles de evacuación.',
  },
}

export const OFFLINE_DIRECTORIO: EmergenciaContacto[] = [
  {
    id: 'pnnn-brisas',
    entidad: 'PNN Los Nevados — Sector Brisas',
    descripcion: 'Guardaparques y control de alta montaña',
    canal: 'VHF 154.325',
    telefono_display: '+57 (606) 887 2201',
    telefono_uri: 'tel:+576068872201',
  },
  {
    id: 'cruz-roja-caldas',
    entidad: 'Cruz Roja Seccional Caldas',
    descripcion: 'Rescate en montaña y atención prehospitalaria',
    canal: 'Línea 132',
    telefono_display: '+57 (606) 880 0200',
    telefono_uri: 'tel:132',
  },
  {
    id: 'defensa-civil-villamaria',
    entidad: 'Defensa Civil — Villamaría',
    descripcion: 'Búsqueda y evacuación en páramo',
    canal: 'Línea 144',
    telefono_display: '+57 (606) 884 1919',
    telefono_uri: 'tel:144',
  },
]

export const INITIAL_BITACORA: BitacoraEntry[] = [
  {
    id: 'seed-1',
    categoria: 'Fauna',
    titulo: 'Avistamiento de Chivito de Páramo',
    nota: 'Macho alimentándose en flor de frailejón cerca al desvío de Arenales.',
    altitud_m: 4090,
    fecha_label: 'Hoy 07:45',
  },
  {
    id: 'seed-2',
    categoria: 'Clima',
    titulo: 'Banco de neblina densa en cresta',
    nota: 'Visibilidad menor a 25 m en Valle de las Tumbas; viento frío del sureste.',
    altitud_m: 4150,
    fecha_label: 'Hoy 06:20',
  },
]

export interface SamplePhoto {
  id: 'frailejon' | 'chivito' | 'condor' | 'oso'
  label: string
  src: string
  subtitle: string
}

export const SAMPLE_SPECIES_PHOTOS: SamplePhoto[] = [
  {
    id: 'frailejon',
    label: 'Frailejón',
    src: '/samples/frailejon.jpg',
    subtitle: 'Espeletia hartwegiana',
  },
  {
    id: 'chivito',
    label: 'Chivito de Páramo',
    src: '/samples/chivito.jpg',
    subtitle: 'Oxypogon stubelii',
  },
  {
    id: 'condor',
    label: 'Cóndor Andino',
    src: '/samples/condor.jpg',
    subtitle: 'Vultur gryphus',
  },
  {
    id: 'oso',
    label: 'Oso de Anteojos',
    src: '/samples/oso.jpg',
    subtitle: 'Tremarctos ornatus',
  },
]

export function calculateOfflineRadar(altitud_m: number): RadarResponse {
  let piso = OFFLINE_PISOS.find((b) => altitud_m >= b.min_m && altitud_m <= b.max_m)
  if (!piso) {
    if (altitud_m < 2300) {
      piso = {
        piso: 'Zona Subandina de Aproximación',
        min_m: 1500,
        max_m: 2299,
        temp: '15°C - 20°C',
        descripcion:
          'Franja de transición cafetera y andina previa al ingreso al Bosque Altoandino del PNN Los Nevados.',
        especies_clave: ['Palma de cera', 'Oso de anteojos'],
      }
    } else {
      piso = {
        piso: 'Zona Nival / Glaciar (Acceso Restringido)',
        min_m: 4801,
        max_m: 5321,
        temp: '-4°C - 0°C',
        descripcion:
          'Casquete glaciar y nieves perpetuas. Acceso turístico restringido por riesgo volcánico e hipotermia.',
        especies_clave: ['Líquenes crustáceos', 'Cóndor de los Andes'],
      }
    }
  }

  const terms = piso.especies_clave.map((item) => item.toLowerCase())
  const matched = OFFLINE_ESPECIES.filter((sp) => {
    const name = sp.nombre_comun.toLowerCase()
    return terms.some((term) => name.includes(term) || term.includes(name))
  })
  if (piso.piso.toLowerCase().includes('páramo') && !matched.some((s) => s.id === 'frailejon')) {
    matched.unshift(OFFLINE_ESPECIES[0])
  }

  let riesgo_soroche: RiesgoSoroche = 'Bajo'
  let recomendacion_seguridad =
    'Altitud confortable para aclimatación. Hidrátate regularmente antes de ascender.'
  if (altitud_m >= 3000 && altitud_m <= 3500) {
    riesgo_soroche = 'Moderado'
    recomendacion_seguridad =
      'Inicio de disminución de oxígeno. Camina a ritmo constante y evita esfuerzos bruscos.'
  } else if (altitud_m > 3500 && altitud_m <= 4100) {
    riesgo_soroche = 'Alto'
    recomendacion_seguridad =
      'Presión de oxígeno reducida (~35-40%). Toma agua en sorbos cortos y vigila dolor de cabeza o mareo.'
  } else if (altitud_m > 4100) {
    riesgo_soroche = 'Muy Alto'
    recomendacion_seguridad =
      'Alta exigencia hipóxica y frío extremo. Si presentas dolor de cabeza pulsátil o náuseas, detén el ascenso y desciende 500 m.'
  }

  return {
    altitud_m,
    piso_termico: piso,
    especies_probables: matched.length > 0 ? matched : OFFLINE_ESPECIES.slice(0, 2),
    riesgo_soroche,
    recomendacion_seguridad,
  }
}

export function buildOfflineChatReply(message: string, altitud_m: number): ChatResponse {
  const q = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const isSafety = [
    'dolor de cabeza',
    'soroche',
    'mareo',
    'nausea',
    'vomito',
    'hipotermia',
    'temblor',
    'frio',
    'falta de aire',
    'volcan',
    'ceniza',
  ].some((k) => q.includes(k))

  if (isSafety) {
    const proto = q.includes('hipotermia') || q.includes('temblor') || q.includes('frio')
      ? OFFLINE_PROTOCOLOS.hipotermia
      : q.includes('volcan') || q.includes('ceniza')
        ? OFFLINE_PROTOCOLOS.volcanico
        : OFFLINE_PROTOCOLOS.soroche

    return {
      reply: `Alerta prioritaria a ${altitud_m.toLocaleString('es-CO')} m s.n.m. — ${proto.titulo}:\n\n${proto.accion_inmediata}`,
      sources: ['Protocolo de Vida Offline'],
      model: 'offline-fallback-js',
      fallback_used: true,
      safety_alert: true,
    }
  }

  if (q.includes('frailejon') || q.includes('agua')) {
    const sp = OFFLINE_ESPECIES[0]
    return {
      reply: `${sp.nombre_comun} (${sp.nombre_cientifico}): ${sp.rol_ecologico}\n\nAlerta de conservación: ${sp.alerta_conservacion}`,
      sources: [sp.nombre_comun],
      model: 'offline-fallback-js',
      fallback_used: true,
      safety_alert: false,
    }
  }

  if (q.includes('ave') || q.includes('colibri') || q.includes('chivito') || q.includes('condor')) {
    return {
      reply:
        'En esta alta montaña destacan el Chivito de Páramo (Oxypogon stubelii), colibrí endémico que anida con lana de frailejón, y el Cóndor de los Andes (Vultur gryphus) en vuelos altos.\n\nObsérvalos en silencio a distancia, sin flash y sin dejar residuos orgánicos.',
      sources: ['Chivito de Páramo', 'Cóndor de los Andes'],
      model: 'offline-fallback-js',
      fallback_used: true,
      safety_alert: false,
    }
  }

  if (q.includes('regla') || q.includes('tumbas') || q.includes('brisas') || q.includes('ruta')) {
    const r = OFFLINE_RUTAS[0]
    return {
      reply: `${r.nombre} (${r.altitud_rango}, ${r.distancia_km} km): ${r.reglas}\n\nEstaciones clave: ${r.estaciones.slice(0, 2).join(' ')}`,
      sources: [r.nombre],
      model: 'offline-fallback-js',
      fallback_used: true,
      safety_alert: false,
    }
  }

  const radar = calculateOfflineRadar(altitud_m)
  return {
    reply: `A ${altitud_m.toLocaleString('es-CO')} m s.n.m. estás en ${radar.piso_termico.piso} (${radar.piso_termico.temp}): ${radar.piso_termico.descripcion}\n\nEspecies clave: ${radar.piso_termico.especies_clave.join(', ')}. ${radar.recomendacion_seguridad}`,
    sources: [`Radar (${radar.piso_termico.piso})`],
    model: 'offline-fallback-js',
    fallback_used: true,
    safety_alert: false,
  }
}

export function buildOfflineVisionFallback(
  hint: string | undefined,
  altitud_m: number,
): VisionResponse {
  const sp =
    OFFLINE_ESPECIES.find((item) => hint && item.id === hint) ??
    calculateOfflineRadar(altitud_m).especies_probables[0]

  return {
    nombre_comun: sp.nombre_comun,
    nombre_cientifico: sp.nombre_cientifico,
    tipo: sp.tipo,
    estado: sp.estado,
    rol_ecologico: sp.rol_ecologico,
    alerta_conservacion: sp.alerta_conservacion,
    confianza: hint ? 'Catálogo Offline Verificado' : 'Respaldo por Altitud',
    descripcion_ia: hint
      ? `Ficha científica offline cargada para ${sp.nombre_comun}: ${sp.rol_ecologico}`
      : `Sin conexión al motor visual local. A ${altitud_m.toLocaleString('es-CO')} m s.n.m. es probable encontrar ${sp.nombre_comun}.`,
    model: 'offline-fallback-js',
    fallback_used: true,
  }
}
