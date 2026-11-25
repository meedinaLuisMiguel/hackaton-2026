import { ArrowLeft, ArrowRight, CloudOff, Leaf, ShieldAlert, Wifi } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GpsRadar } from './components/GpsRadar'
import { Navbar } from './components/Navbar'
import { RagChat } from './components/RagChat'
import { SafetyModal } from './components/SafetyModal'
import { TrailCatalog } from './components/TrailCatalog'
import { VisionLens } from './components/VisionLens'
import {
  INITIAL_BITACORA,
  OFFLINE_DIRECTORIO,
  OFFLINE_ESPECIES,
  OFFLINE_PROTOCOLOS,
  OFFLINE_RUTAS,
  calculateOfflineRadar,
} from './data/offlineData'
import { getEspecies, getHealth, getProtocolos, getRadar, getRutas, postChat } from './services/api'
import type {
  AppTab,
  BitacoraEntry,
  ChatTurn,
  Coordenadas,
  EmergenciaContacto,
  Especie,
  HealthResponse,
  ProtocoloVida,
  RadarResponse,
  Ruta,
  UiChatMessage,
} from './types/paramo'

const STORAGE_DOWNLOADS = 'pnnn_downloaded_routes_v1'
const STORAGE_BITACORA = 'pnnn_bitacora_v1'
const STORAGE_APP = 'kumanday_app_state_v1'

const WELCOME_MSG: UiChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Soy Kumanday, tu agente local para explorar el PNN Los Nevados: conozco sus rutas, especies y protocolos de montaña. También puedo ayudarte con otras preguntas; te avisaré cuando estén fuera de mi especialidad.',
  sources: ['Base Científica PNN Los Nevados'],
}

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

function loadAppState(): { altitude: number; chatMessages: UiChatMessage[]; lastSpecies: string | null } | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_APP) ?? 'null') as Partial<{
      altitude: number
      chatMessages: UiChatMessage[]
      lastSpecies: string | null
    }> | null
    if (!parsed) return null
    return {
      altitude: typeof parsed.altitude === 'number' ? Math.max(2300, Math.min(4800, parsed.altitude)) : 4150,
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages.slice(-40) : [WELCOME_MSG],
      lastSpecies: typeof parsed.lastSpecies === 'string' ? parsed.lastSpecies : null,
    }
  } catch {
    return null
  }
}

function App() {
  const [initialState] = useState(() => loadAppState())
  // Every fresh app load begins on the welcome cover. Navigation happens only after entry.
  const [homeOpen, setHomeOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<AppTab>('rutas')
  const [altitude, setAltitude] = useState<number>(initialState?.altitude ?? 4150)
  const [coords, setCoords] = useState<Coordenadas | null>(null)
  const [remoteRadar, setRemoteRadar] = useState<RadarResponse | null>(null)
  const [rutas, setRutas] = useState<Ruta[]>(OFFLINE_RUTAS)
  const [especies, setEspecies] = useState<Especie[]>(OFFLINE_ESPECIES)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [protocolos, setProtocolos] = useState<Record<string, ProtocoloVida>>(OFFLINE_PROTOCOLOS)
  const [directorio, setDirectorio] = useState<EmergenciaContacto[]>(OFFLINE_DIRECTORIO)
  const [safetyOpen, setSafetyOpen] = useState(false)

  // Lifted chat & species focus state prevents StrictMode double-sends and preserves history across tabs
  const [chatMessages, setChatMessages] = useState<UiChatMessage[]>(initialState?.chatMessages ?? [WELCOME_MSG])
  const [chatLoading, setChatLoading] = useState(false)
  const [lastSpecies, setLastSpecies] = useState<string | null>(initialState?.lastSpecies ?? null)
  const sendingChatRef = useRef(false)
  const msgSeqRef = useRef(1)

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
    void getEspecies().then(setEspecies)
    void getProtocolos().then((data) => {
      setProtocolos(data.protocolos_vida)
      setDirectorio(data.directorio_emergencias)
    })
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_APP, JSON.stringify({
        altitude, chatMessages: chatMessages.slice(-40), lastSpecies,
      }))
    } catch {
      // Storage may be disabled or full; the in-memory experience still works.
    }
  }, [altitude, chatMessages, lastSpecies])

  function enterExperience(tab: AppTab = 'rutas') {
    setActiveTab(tab)
    setHomeOpen(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void getRadar(altitude, controller.signal).then((remote) => {
        if (!controller.signal.aborted) {
          setRemoteRadar(remote)
        }
      })
    }, 150)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [altitude])

  const sendChatMessage = useCallback(
    async (rawText: string, speciesOverride?: string) => {
      const clean = rawText.trim()
      if (!clean || sendingChatRef.current) return

      sendingChatRef.current = true
      setChatLoading(true)

      const userSeq = msgSeqRef.current++
      const userMsg: UiChatMessage = {
        id: `u-${userSeq}`,
        role: 'user',
        content: clean,
      }

      const history: ChatTurn[] = chatMessages
        .filter((m) => m.id !== 'welcome')
        // The triggering prompt may have been enqueued by the same state transition.
        .filter((m) => !(m.role === 'user' && m.content === clean))
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }))

      setChatMessages((prev) => [...prev, userMsg])

      try {
        const res = await postChat({
          message: clean,
          altitud_m: altitude,
          last_species: speciesOverride ?? lastSpecies ?? undefined,
          history,
        })
        const botSeq = msgSeqRef.current++
        const assistantMsg: UiChatMessage = {
          id: `a-${botSeq}`,
          role: 'assistant',
          content: res.reply,
          sources: res.sources,
          toolsUsed: res.tools_used,
          suggestedAction: res.suggested_action,
          outOfDomain: res.out_of_domain,
          model: res.model,
          fallbackUsed: res.fallback_used,
          safetyAlert: res.safety_alert,
        }
        setChatMessages((prev) => [...prev, assistantMsg])
      } catch {
        const botSeq = msgSeqRef.current++
        setChatMessages((prev) => [
          ...prev,
          {
            id: `a-${botSeq}`,
            role: 'assistant',
            content: 'No pude procesar la consulta. Intenta de nuevo; tus mensajes anteriores siguen disponibles.',
            sources: ['Estado local de Kumanday'],
            fallbackUsed: true,
          },
        ])
      } finally {
        setChatLoading(false)
        sendingChatRef.current = false
      }
    },
    [altitude, chatMessages, lastSpecies],
  )

  function handleAskKumandayFromOutside(promptText: string, speciesContext?: string) {
    if (speciesContext) {
      setLastSpecies(speciesContext)
    }
    setActiveTab('chat')
    void sendChatMessage(promptText, speciesContext)
  }

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

  function handleStartNewChat() {
    setChatMessages([WELCOME_MSG])
    setLastSpecies(null)
    try { window.localStorage.removeItem('kumanday_chat_draft_v1') } catch { /* optional cache */ }
  }

  function handleClearCache(): boolean {
    const confirmed = window.confirm('¿Limpiar la caché de Kumanday? Se borrarán la conversación y los borradores locales. Las rutas descargadas y la bitácora se conservarán.')
    if (!confirmed) return false
    for (const key of [STORAGE_APP, 'kumanday_chat_draft_v1', 'kumanday_trail_search_open_v1', 'kumanday_trail_query_v1']) {
      try { window.localStorage.removeItem(key) } catch { /* optional cache */ }
    }
    setChatMessages([WELCOME_MSG])
    setLastSpecies(null)
    setActiveTab('rutas')
    setAltitude(4150)
    return true
  }

  const iaActive = health?.ollama_connected ?? false

  return (
    <div className={`app-shell relative mx-auto min-h-screen max-w-5xl bg-mist shadow-2xl flex flex-col ${homeOpen ? 'home-mode' : 'pb-28'}`}>
      {/* Sticky Top Header */}
      {!homeOpen && <header className="sticky top-0 z-30 border-b border-mountain-border/70 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button type="button" onClick={() => setHomeOpen(true)} aria-label="Volver al inicio" className="grid min-h-10 min-w-10 shrink-0 place-items-center rounded-full text-mountain-muted transition-colors hover:bg-mist hover:text-frailejon-deep">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
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
                Kumanday • PNN Los Nevados
              </h1>
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-moss-surface px-2 py-0.5 text-[10px] font-semibold text-frailejon-deep">
                {iaActive ? (
                  <Wifi className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <CloudOff className="h-3 w-3" aria-hidden="true" />
                )}
                <span>
                  {iaActive ? 'Sin Señal • Agente IA Local' : 'Sin Señal • Respaldo Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick "Protegiendo la Vida" SOS Button */}
          <button
            type="button"
            onClick={() => setSafetyOpen(true)}
            className="min-h-[44px] shrink-0 rounded-full border border-sos-red/30 bg-sos-surface px-3 py-1.5 text-xs font-bold text-on-sos-surface inline-flex items-center gap-1.5 hover:bg-sos-red hover:text-white transition-colors cursor-pointer"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <span>SOS Altura</span>
          </button>
        </div>
      </header>}

      {/* Main Content — Views stay mounted with CSS toggle so tab switches preserve state */}
      <main className={`experience-content flex-1 px-4 py-4 md:px-8 md:py-7 ${homeOpen ? 'home-main' : 'experience-enter'}`}>
        {homeOpen ? (
          <section className="welcome-screen" aria-label="Inicio de Kumanday">
            <div className="welcome-sky" aria-hidden="true"><div className="welcome-sun"/><div className="welcome-ridge ridge-back"/><div className="welcome-ridge ridge-front"/><div className="welcome-fog fog-one"/><div className="welcome-fog fog-two"/></div>
            <div className="welcome-copy">
              <div className="welcome-brand"><span className="welcome-mark"><Leaf size={21}/></span><span>PNN LOS NEVADOS <i>•</i> COLOMBIA</span></div>
              <p className="welcome-eyebrow">TU GUÍA DE ALTA MONTAÑA</p>
              <h2>Kumanday</h2>
              <p className="welcome-description">El páramo comienza donde el camino se vuelve asombro. Explora sus rutas, descubre su vida y cuida cada paso.</p>
              <button type="button" onClick={() => enterExperience()} className="welcome-cta">Entrar al parque <ArrowRight size={18}/></button>
              <span className="welcome-offline"><span/> Guía local • Disponible sin señal</span>
            </div>
          </section>
        ) : (
        <>
        <div className={`${activeTab === 'rutas' ? 'view-active' : 'view-inactive'} flex flex-col gap-5`} aria-hidden={activeTab !== 'rutas'} inert={activeTab !== 'rutas'}>
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
              handleAskKumandayFromOutside(
                `¿Qué estaciones, reglas de ingreso y cuidados debo tener en ${ruta.nombre}?`,
              )
            }
            bitacora={bitacora}
            onAddBitacora={handleAddBitacora}
          />
        </div>

        <div className={activeTab === 'vision' ? 'view-active' : 'view-inactive'} aria-hidden={activeTab !== 'vision'} inert={activeTab !== 'vision'}>
          <VisionLens
            altitude={altitude}
            especies={especies}
            onSpeciesIdentified={setLastSpecies}
            onAskKumanday={handleAskKumandayFromOutside}
          />
        </div>

        <div className={activeTab === 'chat' ? 'view-active' : 'view-inactive'} aria-hidden={activeTab !== 'chat'} inert={activeTab !== 'chat'}>
          <RagChat
            altitude={altitude}
            messages={chatMessages}
            loading={chatLoading}
            lastSpecies={lastSpecies}
            onSendMessage={(text) => void sendChatMessage(text)}
            onStartNewChat={handleStartNewChat}
            onClearCache={handleClearCache}
            onOpenSafety={() => setSafetyOpen(true)}
            onOpenRutas={() => setActiveTab('rutas')}
          />
        </div>
        </>
        )}
      </main>

      {!homeOpen && <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />}

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
