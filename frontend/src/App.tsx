import { ArrowLeft, ArrowRight, CloudOff, Leaf, Moon, ShieldAlert, Sun, Wifi } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GpsRadar } from './components/GpsRadar'
import { KumandayMark } from './components/KumandayMark'
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

const STORAGE_BITACORA = 'pnnn_bitacora_v1'
const STORAGE_APP = 'kumanday_app_state_v1'
const STORAGE_THEME = 'kumanday_theme_v1'
const CHAT_VERSION = 'kumanday_chat_version_v2'

const WELCOME_MSG: UiChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Soy Kumanday, tu guía inteligente para explorar el PNN Los Nevados. Puedo ayudarte con rutas, especies, altitud y seguridad; también describo objetos o respondo dudas generales, y te indicaré cuando salgamos de mi especialidad.',
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
    if (window.localStorage.getItem(CHAT_VERSION) !== '2') {
      window.localStorage.removeItem(STORAGE_APP)
      window.localStorage.setItem(CHAT_VERSION, '2')
    }
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
  const [welcomeIntroComplete, setWelcomeIntroComplete] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [darkMode, setDarkMode] = useState(() => {
    try { return window.localStorage.getItem(STORAGE_THEME) === 'dark' } catch { return false }
  })
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

  const [bitacora, setBitacora] = useState<BitacoraEntry[]>(() =>
    loadStoredArray<BitacoraEntry>(STORAGE_BITACORA, INITIAL_BITACORA),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    try { window.localStorage.setItem(STORAGE_THEME, darkMode ? 'dark' : 'light') } catch { /* optional preference */ }
  }, [darkMode])

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionPreference.matches) return
    const timer = window.setTimeout(() => setWelcomeIntroComplete(true), 7200)
    return () => window.clearTimeout(timer)
  }, [])

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
    const refreshHealth = () => void getHealth().then(setHealth)
    const timer = window.setInterval(refreshHealth, 15000)
    return () => window.clearInterval(timer)
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
    async (rawText: string, speciesOverride?: string, routeId?: string) => {
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
          ruta_id: routeId,
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
            content: 'El servicio local devolvió un error y no pude procesar la consulta. Intenta de nuevo; tus mensajes anteriores siguen disponibles.',
            sources: ['Estado local de Kumanday'],
            fallbackUsed: false,
            model: 'error-local',
          },
        ])
      } finally {
        setChatLoading(false)
        sendingChatRef.current = false
      }
    },
    [altitude, chatMessages, lastSpecies],
  )

  function handleAskKumandayFromOutside(promptText: string, speciesContext?: string, routeId?: string) {
    if (speciesContext) {
      setLastSpecies(speciesContext)
    }
    setActiveTab('chat')
    void sendChatMessage(promptText, speciesContext, routeId)
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
    const confirmed = window.confirm('¿Limpiar la caché de Kumanday? Se borrarán la conversación y los borradores locales. La bitácora se conservará.')
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
    <div className={`app-shell relative mx-auto min-h-screen max-w-5xl bg-mist shadow-2xl flex flex-col ${homeOpen ? 'home-mode' : activeTab === 'chat' ? 'chat-mode pb-28' : 'pb-20'}`}>
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
              <KumandayMark size={25} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold leading-tight text-mountain-ink">
                Kumanday • PNN Los Nevados
              </h1>
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-moss-surface px-2 py-0.5 text-[10px] font-semibold text-frailejon-deep">
                {health?.ollama_connected && health.model_available ? (
                  <Wifi className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <CloudOff className="h-3 w-3" aria-hidden="true" />
                )}
                <span>{health === null ? 'Revisando modelo…' : health.ollama_connected && health.model_available ? 'IA local lista' : health.ollama_connected ? 'Falta modelo local' : 'IA local no disponible'}</span>
              </div>
            </div>
          </div>

          {/* Quick "Protegiendo la Vida" SOS Button */}
          <div className="header-actions flex shrink-0 items-center gap-1.5 rounded-full border border-mountain-border/80 bg-white/45 p-1">
            <button
              type="button"
              onClick={() => setSafetyOpen(true)}
              aria-label="Abrir triaje de seguridad"
              className="safety-header-button grid min-h-9 min-w-9 place-items-center rounded-full border border-sos-red/20 bg-sos-surface text-on-sos-surface transition hover:brightness-95"
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? 'Usar tema claro' : 'Usar tema oscuro'} title={darkMode ? 'Tema claro' : 'Tema oscuro'} className="grid min-h-9 min-w-9 place-items-center rounded-full border border-mountain-border/70 bg-white/70 text-mountain-ink">
              {darkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>}

      {/* Main Content — Views stay mounted with CSS toggle so tab switches preserve state */}
      <main className={`experience-content flex-1 px-4 py-4 md:px-8 md:py-7 ${homeOpen ? 'home-main' : 'experience-enter'}`}>
        {homeOpen ? (
          <section className={`welcome-screen cinematic-welcome ${welcomeIntroComplete ? 'intro-complete' : ''}`} aria-label="Inicio de Kumanday">
            <div className="welcome-scene" aria-hidden="true">
              <div className="scene-stars" />
              <div className="scene-sun-halo"><span /></div>
              <div className="scene-cloud cloud-left" />
              <div className="scene-cloud cloud-right" />
              <svg className="scene-landscape" viewBox="0 0 900 1100" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="skyGlow" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#f2c990"/><stop offset=".42" stopColor="#b7cbb1"/><stop offset="1" stopColor="#294e43"/></linearGradient>
                  <linearGradient id="peakFar" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#738e83"/><stop offset="1" stopColor="#466d63"/></linearGradient>
                  <linearGradient id="peakNear" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#3d7161"/><stop offset="1" stopColor="#173e37"/></linearGradient>
                  <linearGradient id="valley" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#31584b"/><stop offset="1" stopColor="#102c2c"/></linearGradient>
                </defs>
                <rect width="900" height="1100" fill="url(#skyGlow)"/>
                <path className="land-far" d="M0 555c51-32 68-84 111-82 41 2 43 67 83 56 49-13 68-121 119-133 43-10 61 70 102 66 47-4 41-158 93-166 54-8 66 112 113 113 40 1 60-65 98-56 55 12 58 115 104 113 42-2 58-50 77-45v579H0Z" fill="url(#peakFar)"/>
                <path className="land-mid" d="M0 625c49-45 80-98 125-90 36 7 39 68 79 68 48 0 68-101 117-112 45-10 59 65 105 64 53-1 68-142 121-146 55-4 65 126 118 124 44-2 59-63 99-57 46 7 63 94 104 94 38 0 75-73 105-67v497H0Z" fill="#557c68"/>
                <path className="land-near" d="M0 714c43-36 81-94 127-83 41 10 55 69 99 66 39-3 55-61 100-63 52-2 76 100 123 100 50 0 57-92 111-96 48-4 73 79 119 81 41 1 61-54 105-53 45 1 72 72 116 70 40-2 68-51 100-48v312H0Z" fill="url(#peakNear)"/>
                <path className="land-valley" d="M0 816c43-31 87-83 137-68 42 12 61 64 111 62 40-1 66-44 118-40 47 4 68 65 118 68 46 3 74-51 122-51 41 0 73 43 118 44 47 1 79-41 126-40 43 0 90 40 150 25v284H0Z" fill="url(#valley)"/>
                <g className="contour-lines" fill="none" stroke="#e1d9b4" strokeWidth="1.4">
                  <path d="M-50 672c118-92 234-89 321-35s179 60 278-10 204-93 411-30"/>
                  <path d="M-40 695c122-79 220-77 310-25s180 63 283-7 201-87 397-26"/>
                  <path d="M-30 721c125-70 215-67 303-17s188 63 294-6 204-82 380-22"/>
                  <path d="M-24 748c123-60 211-57 299-8s194 60 304-7 203-74 369-19"/>
                  <path d="M-20 780c125-52 208-49 297-1s199 55 312-9 198-66 349-15"/>
                </g>
                <g className="frailejon" transform="translate(670 710)">
                  <path d="M0 220c2-72 1-126 3-178" stroke="#d6c694" strokeWidth="13" strokeLinecap="round"/>
                  <path d="M1 89C-42 69-60 49-75 21c35 4 66 19 82 45M2 119c39-22 61-48 74-80-34 9-59 28-75 57M0 65C-2 26 7-6 25-30c12 36 8 69-14 101M4 89c-9-40-1-73 17-103 19 34 23 66 1 101M-1 100c-31-31-47-63-48-98 31 22 51 50 56 88M5 105c31-32 48-64 51-98-32 22-52 50-58 88" fill="#d2c99c" stroke="#8e9b72" strokeWidth="3" strokeLinejoin="round"/>
                  <circle cx="3" cy="-10" r="8" fill="#f2d58e"/>
                </g>
              </svg>
              <div className="scene-mist mist-low" />
              <div className="scene-mist mist-high" />
              <div className="scene-grain" />
            </div>
            <div className="welcome-topline"><span className="welcome-coordinate">4° 49′ N&nbsp; · &nbsp;75° 22′ O</span><span className="welcome-live"><i /> PÁRAMO VIVO</span></div>
            <div className="welcome-copy cinematic-copy">
              <div className="welcome-brand"><span>PARQUE NACIONAL NATURAL <i>•</i> COLOMBIA</span></div>
              <div className="welcome-brand-mark"><KumandayMark size={55} className="text-white" /></div>
              <p className="welcome-eyebrow">ALTO ANDES · 4.150 M S. N. M.</p>
              <h2>Kumanday<span>.</span></h2>
              <p className="welcome-description">El páramo tiene historias que contar.<br/>Vamos a escucharlas.</p>
              <div className="welcome-route-line" aria-hidden="true"><span/><i/><span/><i/><span/></div>
              <p className="welcome-caption">RUTAS &nbsp;·&nbsp; VIDA &nbsp;·&nbsp; MONTAÑA</p>
              <button type="button" onClick={() => enterExperience()} className="welcome-cta">Explorar el páramo <ArrowRight size={18}/></button>
              {!welcomeIntroComplete && <button type="button" onClick={() => setWelcomeIntroComplete(true)} className="welcome-skip">Saltar animación <ArrowRight size={14}/></button>}
              <div className="welcome-credit"><span>KUMANDAY</span><i/> Luis Miguel Medina & Sebastián Orjuela</div>
            </div>
            <div className="welcome-progress" aria-hidden="true"><span/></div>
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
            onAskAboutRuta={(ruta) =>
              handleAskKumandayFromOutside(
                `¿Qué estaciones, reglas de ingreso y cuidados debo tener en ${ruta.nombre}?`,
                undefined,
                ruta.id,
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
            ollamaConnected={iaActive}
            modelAvailable={health?.model_available ?? false}
            configuredModel={health?.configured_model ?? 'gemma3:4b'}
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
      {!homeOpen && <footer className="app-footer mx-auto w-full max-w-5xl px-5 pb-5 pt-2 text-center text-[10px] text-mountain-muted">
        <span className="inline-flex items-center justify-center gap-1.5"><Leaf size={12} aria-hidden="true"/> Kumanday · Guía local del PNN Los Nevados</span>
        <span className="mt-1 block">Creada por Luis Miguel Medina y Sebastián Orjuela</span>
      </footer>}
    </div>
  )
}

export default App
