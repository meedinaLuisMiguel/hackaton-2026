export interface Coordenadas {
  lat: number
  lon: number
}

export interface Ruta {
  id: string
  nombre: string
  sector: string
  altitud_rango: string
  altitud_min_m: number
  altitud_max_m: number
  distancia_km: number
  dificultad: string
  coordenadas: Coordenadas
  estaciones: string[]
  reglas: string
}

export interface PisoTermico {
  piso: string
  min_m: number
  max_m: number
  temp: string
  descripcion: string
  especies_clave: string[]
}

export interface Especie {
  id: string
  nombre_comun: string
  nombre_cientifico: string
  tipo: 'Flora' | 'Fauna'
  estado: string
  pisos: string[]
  rol_ecologico: string
  alerta_conservacion: string
}

export type RiesgoSoroche = 'Bajo' | 'Moderado' | 'Alto' | 'Muy Alto'

export interface RadarResponse {
  altitud_m: number
  piso_termico: PisoTermico
  especies_probables: Especie[]
  riesgo_soroche: RiesgoSoroche
  recomendacion_seguridad: string
}

export interface HealthResponse {
  agent_name: string
  status: 'ok' | 'degraded'
  ollama_connected: boolean
  ollama_url: string
  configured_model: string
  configured_vision_model: string
  model_available: boolean
  active_models: string[]
  species_count: number
  offline_ready: boolean
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export type AgentSuggestedAction = 'none' | 'open_safety' | 'open_rutas' | 'open_vision'

export interface ChatResponse {
  agent_name: string
  reply: string
  sources: string[]
  tools_used: string[]
  suggested_action: AgentSuggestedAction
  out_of_domain: boolean
  model: string
  fallback_used: boolean
  safety_alert: boolean
}

export interface UiChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  toolsUsed?: string[]
  suggestedAction?: AgentSuggestedAction
  outOfDomain?: boolean
  model?: string
  fallbackUsed?: boolean
  safetyAlert?: boolean
}

export interface VisionResponse {
  en_pnnn: boolean
  nombre_comun: string
  nombre_cientifico: string
  tipo: 'Flora' | 'Fauna' | 'Entorno' | 'Objeto' | 'Fuera de Ecosistema' | 'Sin Confirmación'
  estado: string
  rol_ecologico: string
  alerta_conservacion: string
  confianza: string
  descripcion_ia: string
  enfoque_notice?: string | null
  model: string
  fallback_used: boolean
}

export interface ProtocoloVida {
  titulo: string
  sintomas: string[]
  accion_inmediata: string
}

export interface EmergenciaContacto {
  id: string
  entidad: string
  descripcion: string
  canal: string
  telefono_display: string
  telefono_uri: string
}

export type BitacoraCategoria = 'Fauna' | 'Flora' | 'Clima'

export interface BitacoraEntry {
  id: string
  categoria: BitacoraCategoria
  titulo: string
  nota: string
  altitud_m: number
  fecha_label: string
}

export type AppTab = 'rutas' | 'vision' | 'chat'
