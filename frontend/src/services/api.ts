import {
  OFFLINE_DIRECTORIO,
  OFFLINE_ESPECIES,
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
  Especie,
  HealthResponse,
  ProtocoloVida,
  RadarResponse,
  Ruta,
  VisionResponse,
} from '../types/paramo'

const API_BASE = '/api'

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 4500,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      let detail = `HTTP ${response.status}`
      try {
        const errBody = (await response.json()) as { detail?: string }
        if (errBody.detail) detail = errBody.detail
      } catch {
        // Ignore parse error on non-JSON error responses
      }
      throw new ApiError(detail, response.status)
    }
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function getHealth(): Promise<HealthResponse> {
  try {
    return await fetchJson<HealthResponse>(`${API_BASE}/health`, undefined, 3500)
  } catch {
    return {
      agent_name: 'Kumanday',
      status: 'degraded',
      ollama_connected: false,
      ollama_url: 'http://localhost:11434',
      configured_model: 'gemma3:4b',
      configured_vision_model: 'gemma3:4b',
      active_models: [],
      species_count: OFFLINE_ESPECIES.length,
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

export async function getEspecies(): Promise<Especie[]> {
  try {
    return await fetchJson<Especie[]>(`${API_BASE}/especies`, undefined, 3500)
  } catch {
    return OFFLINE_ESPECIES
  }
}

export async function getRadar(altitud: number, signal?: AbortSignal): Promise<RadarResponse> {
  try {
    return await fetchJson<RadarResponse>(
      `${API_BASE}/radar?altitud=${altitud}`,
      undefined,
      2500,
      signal,
    )
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
  last_species?: string
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
  } catch (err) {
    // Propagate client validation errors (HTTP 422) so user sees exact format error
    if (err instanceof ApiError && err.status === 422) {
      throw err
    }
    return buildOfflineVisionFallback(payload.hint)
  }
}
