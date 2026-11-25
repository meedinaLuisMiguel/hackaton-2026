import { CloudOff, ShieldAlert, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GpsRadar } from './components/GpsRadar'
import { Navbar } from './components/Navbar'
import { RagChat } from './components/RagChat'
import { SafetyModal } from './components/SafetyModal'
import { TrailCatalog } from './components/TrailCatalog'
import { VisionLens } from './components/VisionLens'
import {
  INITIAL_BITACORA,
  OFFLINE_DIRECTORIO,
  OFFLINE_PROTOCOLOS,
  OFFLINE_RUTAS,
  calculateOfflineRadar,
} from './data/offlineData'
import { getHealth, getProtocolos, getRadar, getRutas } from './services/api'
import type {
  AppTab,
  BitacoraEntry,
  Coordenadas,
  EmergenciaContacto,
  HealthResponse,
  ProtocoloVida,
  RadarResponse,
  Ruta,
} from './types/paramo'

const STORAGE_DOWNLOADS = 'pnnn_downloaded_routes_v1'
const STORAGE_BITACORA = 'pnnn_bitacora_v1'

function loadStoredArray<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('rutas')
  const [altitude, setAltitude] = useState<number>(4150)
  const [coords, setCoords] = useState<Coordenadas | null>(null)
  const [remoteRadar, setRemoteRadar] = useState<RadarResponse | null>(null)
  const [rutas, setRutas] = useState<Ruta[]>(OFFLINE_RUTAS)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [protocolos, setProtocolos] = useState<Record<string, ProtocoloVida>>(OFFLINE_PROTOCOLOS)
  const [directorio, setDirectorio] = useState<EmergenciaContacto[]>(OFFLINE_DIRECTORIO)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null)

  const radar =
    remoteRadar && remoteRadar.altitud_m === altitude
      ? remoteRadar
      : calculateOfflineRadar(altitude)

  const [downloadedIds, setDownloadedIds] = useState<string[]>(() =>
    loadStoredArray<string>(STORAGE_DOWNLOADS, ['brisas-valle-tumbas', 'potosi-laguna-otun']),
  )
  const [bitacora, setBitacora] = useState<BitacoraEntry[]>(() =>
    loadStoredArray<BitacoraEntry>(STORAGE_BITACORA, INITIAL_BITACORA),
  )

  useEffect(() => {
    void getHealth().then(setHealth)
    void getRutas().then(setRutas)
    void getProtocolos().then((data) => {
      setProtocolos(data.protocolos_vida)
      setDirectorio(data.directorio_emergencias)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void getRadar(altitude).then((remote) => {
        if (!cancelled) setRemoteRadar(remote)
      })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [altitude])

  function handleToggleDownload(id: string) {
    setDownloadedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      try {
        window.localStorage.setItem(STORAGE_DOWNLOADS, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors
      }
      return next
    })
  }

  function handleAddBitacora(entry: BitacoraEntry) {
    setBitacora((prev) => {
      const next = [entry, ...prev]
      try {
        window.localStorage.setItem(STORAGE_BITACORA, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors
      }
      return next
    })
  }

  function handleAskInChat(promptText: string) {
    setPendingChatPrompt(promptText)
    setActiveTab('chat')
  }

  const iaActive = health?.ollama_connected ?? false

  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-mist pb-28 shadow-2xl flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-mountain-border/70 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Minimalist Mountain Emblem */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-frailejon text-white"
              aria-hidden="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 19L9.5 7L14 14.5L16.5 11L21 19H3Z" />
                <circle cx="17.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold leading-tight text-mountain-ink">
                PNN Los Nevados
              </h1>
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-moss-surface px-2 py-0.5 text-[10px] font-semibold text-frailejon-deep">
                {iaActive ? (
                  <Wifi className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <CloudOff className="h-3 w-3" aria-hidden="true" />
                )}
                <span>
                  {iaActive ? 'Sin Señal • IA Local Activa' : 'Sin Señal • Respaldo Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Floating/Quick "Protegiendo la Vida" SOS Button */}
          <button
            type="button"
            onClick={() => setSafetyOpen(true)}
            className="min-h-[44px] shrink-0 rounded-full border border-sos-red/30 bg-sos-surface px-3 py-1.5 text-xs font-bold text-on-sos-surface inline-flex items-center gap-1.5 hover:bg-sos-red hover:text-white transition-colors cursor-pointer"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <span>SOS Altura</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-5">
        {activeTab === 'rutas' && (
          <>
            <GpsRadar
              altitude={altitude}
              radar={radar}
              coords={coords}
              onAltitudeChange={setAltitude}
              onCoordsChange={setCoords}
              onOpenSafety={() => setSafetyOpen(true)}
            />
            <TrailCatalog
              rutas={rutas}
              altitude={altitude}
              downloadedIds={downloadedIds}
              onToggleDownload={handleToggleDownload}
              onAskAboutRuta={(ruta) =>
                handleAskInChat(
                  `¿Qué estaciones, reglas de ingreso y cuidados debo tener en ${ruta.nombre}?`,
                )
              }
              bitacora={bitacora}
              onAddBitacora={handleAddBitacora}
            />
          </>
        )}

        {activeTab === 'vision' && (
          <VisionLens altitude={altitude} onAskAboutSpecies={handleAskInChat} />
        )}

        {activeTab === 'chat' && (
          <RagChat
            altitude={altitude}
            initialPrompt={pendingChatPrompt}
            onConsumeInitialPrompt={() => setPendingChatPrompt(null)}
            onOpenSafety={() => setSafetyOpen(true)}
          />
        )}
      </main>

      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      <SafetyModal
        isOpen={safetyOpen}
        altitude={altitude}
        coords={coords}
        protocolos={protocolos}
        directorio={directorio}
        onClose={() => setSafetyOpen(false)}
      />
    </div>
  )
}

export default App
