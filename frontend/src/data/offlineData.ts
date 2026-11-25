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
    especies_clave: [
      'Oso de Anteojos',
      'Loro Orejiamarillo',
      'Palma de Cera del Quindío',
      'Danta de Montaña',
    ],
  },
  {
    piso: 'Subpáramo',
    min_m: 3201,
    max_m: 3500,
    temp: '7°C - 10°C',
    descripcion: 'Arbustos bajos, romeros de páramo y mortiños; zona de alta actividad de polinizadores.',
    especies_clave: ['Romero de Páramo', 'Chivito de Páramo', 'Danta de Montaña', 'Oso de Anteojos'],
  },
  {
    piso: 'Páramo Propiamente Dicho',
    min_m: 3501,
    max_m: 4100,
    temp: '4°C - 7°C',
    descripcion: 'Fábrica de agua dominada por frailejonales, pajonales y turberas esponjosas.',
    especies_clave: [
      'Frailejón del Ruiz',
      'Chivito de Páramo',
      'Pato Andino',
      'Zorro de Páramo',
      'Musgo Turbero',
    ],
  },
  {
    piso: 'Superpáramo',
    min_m: 4101,
    max_m: 4800,
    temp: '0°C - 3°C',
    descripcion: 'Tundra alpina de arenas volcánicas, líquenes y plantas almohadilla antes del glaciar.',
    especies_clave: ['Cacho de Venado', 'Cóndor de los Andes', 'Zorro de Páramo', 'Frailejón del Ruiz'],
  },
]

export const OFFLINE_ESPECIES: Especie[] = [
  {
    id: 'frailejon',
    nombre_comun: 'Frailejón del Ruiz',
    nombre_cientifico: 'Espeletia hartwegiana',
    tipo: 'Flora',
    estado: 'Especie Clave • Protegida',
    pisos: ['Páramo Propiamente Dicho', 'Superpáramo'],
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
    pisos: ['Subpáramo', 'Páramo Propiamente Dicho', 'Superpáramo'],
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
    pisos: ['Páramo Propiamente Dicho', 'Superpáramo'],
    rol_ecologico:
      'Carroñero supremo que mantiene limpio el ecosistema de alta montaña y planea sobre corrientes térmicas volcánicas.',
    alerta_conservacion: 'No dejar ningún residuo orgánico ni basura en la montaña.',
  },
  {
    id: 'oso',
    nombre_comun: 'Oso de Anteojos',
    nombre_cientifico: 'Tremarctos ornatus',
    tipo: 'Fauna',
    estado: 'Vulnerable',
    pisos: ['Bosque Altoandino', 'Subpáramo'],
    rol_ecologico:
      'Único úrsido de Sudamérica; jardinero del bosque altoandino y páramo que dispersa semillas y abre claros en la vegetación.',
    alerta_conservacion:
      'Mantener distancia segura (mínimo 50 m), no alimentar y reportar avistamientos a guardaparques al descender.',
  },
  {
    id: 'danta',
    nombre_comun: 'Danta de Montaña (Tapir Andino)',
    nombre_cientifico: 'Tapirus pinchaque',
    tipo: 'Fauna',
    estado: 'En Peligro • Especie Paraguas',
    pisos: ['Bosque Altoandino', 'Subpáramo'],
    rol_ecologico:
      'Mamífero herbívoro más grande del páramo; abre trochas naturales y dispersa semillas de palma y arbustos andinos.',
    alerta_conservacion:
      'No bloquear sus senderos cercanos a quebradas ni hacer ruido excesivo en zonas de niebla.',
  },
  {
    id: 'loro',
    nombre_comun: 'Loro Orejiamarillo',
    nombre_cientifico: 'Ognorhynchus icterotis',
    tipo: 'Fauna',
    estado: 'Vulnerable • Dependiente de Palma de Cera',
    pisos: ['Bosque Altoandino'],
    rol_ecologico:
      'Habita bandadas en bosques de niebla y anida exclusivamente en troncos huecos de palma de cera.',
    alerta_conservacion:
      'Proteger los bosques de palma de cera y evitar drones o ruido cerca de zonas de anidación.',
  },
  {
    id: 'palma',
    nombre_comun: 'Palma de Cera del Quindío',
    nombre_cientifico: 'Ceroxylon quindiuense',
    tipo: 'Flora',
    estado: 'Árbol Nacional • En Peligro',
    pisos: ['Bosque Altoandino'],
    rol_ecologico:
      'Palma más alta del mundo (hasta 60 m); sostiene cadenas tróficas de aves como el loro orejiamarillo en el bosque altoandino.',
    alerta_conservacion: 'Prohibido cortar sus cogollos o dañar su corteza cerosa.',
  },
  {
    id: 'pato',
    nombre_comun: 'Pato Andino (Pato Paramuno)',
    nombre_cientifico: 'Anas andium',
    tipo: 'Fauna',
    estado: 'Residente Altoandino • Indicador de Humedales',
    pisos: ['Páramo Propiamente Dicho'],
    rol_ecologico:
      'Habita lagunas glaciares como Otún y Laguna Verde; regula insectos acuáticos y macrófitas de turberas.',
    alerta_conservacion:
      'No acercarse a las orillas de lagunas Ramsar ni contaminar el agua con bloqueadores o residuos.',
  },
  {
    id: 'romero',
    nombre_comun: 'Romero de Páramo',
    nombre_cientifico: 'Diplostephium rosmarinifolium',
    tipo: 'Flora',
    estado: 'Nativa de Subpáramo',
    pisos: ['Subpáramo', 'Páramo Propiamente Dicho'],
    rol_ecologico:
      'Arbusto aromático de hojas coriáceas que estabiliza suelos volcánicos y ofrece néctar a abejorros y colibríes.',
    alerta_conservacion: 'No arrancar ramas para fogatas ni infusiones dentro del parque.',
  },
  {
    id: 'cacho',
    nombre_comun: 'Cacho de Venado',
    nombre_cientifico: 'Loricaria complanata',
    tipo: 'Flora',
    estado: 'Especialista de Superpáramo',
    pisos: ['Superpáramo'],
    rol_ecologico:
      'Arbusto rastrero de tallos planos que resiste heladas nocturnas y fija arenales volcánicos expuestos al viento.',
    alerta_conservacion:
      'Caminar exclusivamente sobre el sendero marcado; su crecimiento es extremadamente lento.',
  },
  {
    id: 'zorro',
    nombre_comun: 'Zorro de Páramo (Lobo Colorado)',
    nombre_cientifico: 'Lycalopex culpaeus',
    tipo: 'Fauna',
    estado: 'Cánido Nativo Altoandino',
    pisos: ['Páramo Propiamente Dicho', 'Superpáramo'],
    rol_ecologico:
      'Depredador mediano que controla poblaciones de roedores y conejos de páramo, manteniendo el equilibrio del pajonal.',
    alerta_conservacion:
      'Nunca ofrecerle comida ni acercarse para fotografiarlo; evita habituarlo a humanos.',
  },
  {
    id: 'musgo',
    nombre_comun: 'Musgo Turbero (Colchón de Agua)',
    nombre_cientifico: 'Sphagnum magellanicum',
    tipo: 'Flora',
    estado: 'Especie Clave Hídrica',
    pisos: ['Subpáramo', 'Páramo Propiamente Dicho'],
    rol_ecologico:
      'Absorbe hasta 20 veces su peso en agua de lluvia y neblina, formando las turberas que alimentan los ríos del Eje Cafetero.',
    alerta_conservacion:
      'Prohibido pisar turberas y humedales; una pisada compacta el suelo durante décadas.',
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
    sintomas: ['Temblores incontrolables', 'Torpeza en manos', 'Habla arrastrada o confusión'],
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
        especies_clave: ['Palma de Cera del Quindío', 'Oso de Anteojos'],
      }
    } else {
      piso = {
        piso: 'Zona Nival / Glaciar (Acceso Restringido)',
        min_m: 4801,
        max_m: 5321,
        temp: '-4°C - 0°C',
        descripcion:
          'Casquete glaciar y nieves perpetuas. Acceso turístico restringido por riesgo volcánico e hipotermia.',
        especies_clave: ['Cóndor de los Andes', 'Cacho de Venado'],
      }
    }
  }

  const matchedByPiso = OFFLINE_ESPECIES.filter((sp) => sp.pisos.includes(piso.piso))
  const terms = piso.especies_clave.map((item) => item.toLowerCase())
  const matched =
    matchedByPiso.length > 0
      ? matchedByPiso
      : OFFLINE_ESPECIES.filter((sp) =>
          terms.some(
            (term) =>
              sp.nombre_comun.toLowerCase().includes(term) ||
              term.includes(sp.nombre_comun.toLowerCase()),
          ),
        )

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
    especies_probables: matched.length > 0 ? matched : OFFLINE_ESPECIES.slice(0, 3),
    riesgo_soroche,
    recomendacion_seguridad,
  }
}

export function buildOfflineChatReply(message: string, altitud_m: number): ChatResponse {
  const q = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const inDomain = [
    'paramo', 'nevado', 'ruiz', 'kumanday', 'santa isabel', 'tolima', 'caldas', 'risaralda',
    'otun', 'brisas', 'tumbas', 'cisne', 'laguna', 'ruta', 'sendero', 'caminata', 'altitud',
    'altura', 'msnm', 'piso', 'clima', 'frio', 'agua', 'turbera', 'frailejon', 'espeletia',
    'chivito', 'colibri', 'condor', 'oso', 'anteojos', 'danta', 'tapir', 'loro', 'palma',
    'pato', 'romero', 'cacho', 'zorro', 'musgo', 'sphagnum', 'ave', 'flora', 'fauna',
    'especie', 'animal', 'planta', 'parque', 'guia', 'guardaparque', 'regla', 'reserva',
    'horario', 'ropa', 'capa', 'hidratacion', 'dolor de cabeza', 'soroche', 'mareo', 'nausea',
    'vomito', 'hipotermia', 'temblor', 'falta de aire', 'emergencia', 'auxilio', 'sos',
    'volcan', 'ceniza', 'azufre', 'rescate', 'evacuacion', 'hola', 'buenas', 'ayuda', 'gracias',
  ].some((term) => q.includes(term))

  const isSafety = [
    'dolor de cabeza',
    'soroche',
    'mareo',
    'nausea',
    'vomito',
    'hipotermia',
    'temblor',
    'frio extremo',
    'falta de aire',
    'volcan',
    'ceniza',
  ].some((k) => q.includes(k))

  if (isSafety) {
    const proto =
      q.includes('hipotermia') || q.includes('temblor')
        ? OFFLINE_PROTOCOLOS.hipotermia
        : q.includes('volcan') || q.includes('ceniza')
          ? OFFLINE_PROTOCOLOS.volcanico
          : OFFLINE_PROTOCOLOS.soroche

    return {
      agent_name: 'Kumanday',
      reply: `Alerta prioritaria a ${altitud_m.toLocaleString('es-CO')} m s.n.m. — ${proto.titulo}:\n${proto.accion_inmediata}`,
      sources: ['Protocolo de Vida Offline'],
      tools_used: ['activar_protocolo_vida'],
      suggested_action: 'open_safety',
      out_of_domain: false,
      model: 'offline-respuesta-local-sin-servidor',
      fallback_used: true,
      safety_alert: true,
    }
  }

  if (!inDomain) {
    return {
      agent_name: 'Kumanday',
      reply: 'No tengo el motor local disponible para responder eso ahora. Mi especialidad es el Parque Nacional Natural Los Nevados; puedo ayudarte con sus especies, rutas, altitud y seguridad.',
      sources: ['Asistencia general local no disponible'],
      tools_used: ['consulta_general'],
      suggested_action: 'none',
      out_of_domain: true,
      model: 'offline-respuesta-local-sin-servidor',
      fallback_used: true,
      safety_alert: false,
    }
  }

  const matchedSpecies = OFFLINE_ESPECIES.find((sp) => {
    const common = sp.nombre_comun
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return q.includes(sp.id) || common.split(' ').some((w) => w.length > 4 && q.includes(w))
  })

  if (matchedSpecies || q.includes('agua')) {
    const sp = matchedSpecies ?? OFFLINE_ESPECIES[0]
    return {
      agent_name: 'Kumanday',
      reply: `${sp.nombre_comun} (${sp.nombre_cientifico}): ${sp.rol_ecologico}\n\n• Conservación: ${sp.alerta_conservacion}`,
      sources: [sp.nombre_comun],
      tools_used: ['consultar_especie'],
      suggested_action: 'none',
      out_of_domain: false,
      model: 'offline-respuesta-local-sin-servidor',
      fallback_used: true,
      safety_alert: false,
    }
  }

  if (q.includes('ave') || q.includes('colibri')) {
    return {
      agent_name: 'Kumanday',
      reply:
        'En el PNN Los Nevados habitan el Chivito de Páramo (Oxypogon stubelii), el Cóndor de los Andes (Vultur gryphus), el Pato Andino y el Loro Orejiamarillo en bosque altoandino.\n\n• Obsérvalos en silencio, sin flash y sin dejar residuos.',
      sources: ['Catálogo de Aves PNNN'],
      tools_used: ['consultar_especie'],
      suggested_action: 'none',
      out_of_domain: false,
      model: 'offline-respuesta-local-sin-servidor',
      fallback_used: true,
      safety_alert: false,
    }
  }

  if (q.includes('regla') || q.includes('tumbas') || q.includes('brisas') || q.includes('ruta')) {
    const r =
      OFFLINE_RUTAS.find((item) => q.includes('otun') && item.id.includes('otun')) ??
      OFFLINE_RUTAS.find((item) => q.includes('cisne') && item.id.includes('cisne')) ??
      OFFLINE_RUTAS[0]
    return {
      agent_name: 'Kumanday',
      reply: `${r.nombre} (${r.altitud_rango}, ${r.distancia_km} km):\n• Reglas: ${r.reglas}\n• Primera estación: ${r.estaciones[0]}`,
      sources: [r.nombre],
      tools_used: ['consultar_ruta'],
      suggested_action: 'open_rutas',
      out_of_domain: false,
      model: 'offline-respuesta-local-sin-servidor',
      fallback_used: true,
      safety_alert: false,
    }
  }

  const radar = calculateOfflineRadar(altitud_m)
  return {
    agent_name: 'Kumanday',
    reply: `A ${altitud_m.toLocaleString('es-CO')} m s.n.m. estás en ${radar.piso_termico.piso} (${radar.piso_termico.temp}): ${radar.piso_termico.descripcion}\n\n• Especies clave: ${radar.especies_probables
      .slice(0, 4)
      .map((s) => s.nombre_comun)
      .join(', ')}.\n• Seguridad: ${radar.recomendacion_seguridad}`,
    sources: [`Radar (${radar.piso_termico.piso})`],
    tools_used: ['consultar_radar_altitud'],
    suggested_action: 'none',
    out_of_domain: false,
    model: 'offline-respuesta-local-sin-servidor',
    fallback_used: true,
    safety_alert: false,
  }
}

export function buildOfflineVisionFallback(hint: string | undefined): VisionResponse {
  const sampleId = hint?.startsWith('sample:') ? hint.slice('sample:'.length) : undefined
  const sp = sampleId ? OFFLINE_ESPECIES.find((item) => item.id === sampleId) : undefined

  if (sp) {
    return {
      en_pnnn: true,
      nombre_comun: sp.nombre_comun,
      nombre_cientifico: sp.nombre_cientifico,
      tipo: sp.tipo,
      estado: sp.estado,
      rol_ecologico: sp.rol_ecologico,
      alerta_conservacion: sp.alerta_conservacion,
      confianza: 'Catálogo Offline Verificado',
      descripcion_ia: `Ficha científica offline cargada para ${sp.nombre_comun}: ${sp.rol_ecologico}`,
      model: 'offline-fallback-js',
      fallback_used: true,
    }
  }

  return {
    en_pnnn: false,
    nombre_comun: 'Motor visual IA no disponible',
    nombre_cientifico: 'Verificación visual en espera',
    tipo: 'Sin Confirmación',
    estado: 'Ollama multimodal offline',
    rol_ecologico:
      'Para evitar identificaciones erróneas sobre fotos personalizadas, Kumanday no asigna especies sin el motor visual activo.',
    alerta_conservacion:
      'Enciende el backend con Ollama (gemma3:4b) para analizar fotos externas o explora el catálogo de 12 especies.',
    confianza: 'Sin confirmación',
    descripcion_ia:
      'La fotografía fue validada localmente, pero no se pudo contactar al modelo visual en este momento.',
    model: 'offline-fallback-js',
    fallback_used: true,
  }
}
