import {
  OFFLINE_DIRECTORIO,
  OFFLINE_PROTOCOLOS,
  OFFLINE_RUTAS,
  buildOfflineChatReply,
  buildOfflineVisionFallback,
  calculateOfflineRadar,
} from '../data/offlineData'
import type {
  ChatResponse,
  ChatTurn,
  EmergenciaContacto,
  HealthResponse,
  ProtocoloVida,
  RadarResponse,
  Ruta,
  VisionResponse,
} from '../types/paramo'

const API_BASE = '/api'

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timer)
  }
}

export async function getHealth(): Promise<HealthResponse> {
  try {
    return await fetchJson<HealthResponse>(`${API_BASE}/health`, undefined, 3500)
  } catch {
    return {
      status: 'degraded',
      ollama_connected: false,
      ollama_url: 'http://localhost:11434',
      configured_model: 'gemma3:4b',
      configured_vision_model: 'gemma3:4b',
      active_models: [],
      offline_ready: true,
    }
  }
}

export async function getRutas(): Promise<Ruta[]> {
  try {
    return await fetchJson<Ruta[]>(`${API_BASE}/rutas`, undefined, 3500)
  } catch {
    return OFFLINE_RUTAS
  }
}

export async function getRadar(altitud: number): Promise<RadarResponse> {
  try {
    return await fetchJson<RadarResponse>(`${API_BASE}/radar?altitud=${altitud}`, undefined, 2500)
  } catch {
    return calculateOfflineRadar(altitud)
  }
}

export async function getProtocolos(): Promise<{
  protocolos_vida: Record<string, ProtocoloVida>
  directorio_emergencias: EmergenciaContacto[]
}> {
  try {
    return await fetchJson<{
      protocolos_vida: Record<string, ProtocoloVida>
      directorio_emergencias: EmergenciaContacto[]
    }>(`${API_BASE}/protocolos`, undefined, 3500)
  } catch {
    return {
      protocolos_vida: OFFLINE_PROTOCOLOS,
      directorio_emergencias: OFFLINE_DIRECTORIO,
    }
  }
}

export async function postChat(payload: {
  message: string
  altitud_m: number
  ruta_id?: string
  history?: ChatTurn[]
}): Promise<ChatResponse> {
  try {
    return await fetchJson<ChatResponse>(
      `${API_BASE}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      45000,
    )
  } catch {
    return buildOfflineChatReply(payload.message, payload.altitud_m)
  }
}

export async function postVision(payload: {
  image_base64: string
  altitud_m: number
  hint?: string
}): Promise<VisionResponse> {
  try {
    return await fetchJson<VisionResponse>(
      `${API_BASE}/vision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      45000,
    )
  } catch {
    return buildOfflineVisionFallback(payload.hint, payload.altitud_m)
  }
}
