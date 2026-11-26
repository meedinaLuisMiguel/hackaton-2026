import {
  Compass,
  DatabaseZap,
  Leaf,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { localizedSpeciesName, tx, type Language } from '../i18n'
import type { UiChatMessage } from '../types/paramo'

interface RagChatProps {
  language: Language
  messages: UiChatMessage[]
  loading: boolean
  lastSpecies: string | null
  ollamaConnected: boolean
  modelAvailable: boolean
  configuredModel: string
  onSendMessage: (text: string) => void
  onStartNewChat: () => void
  onClearCache: () => boolean
  onOpenSafety: () => void
  onOpenRutas: () => void
}

const QUICK_CHIPS = {
  es: ['¿Cómo produce agua el frailejón?', 'Tengo dolor de cabeza a 4.200 m'],
  en: ['How does the frailejón help store water?', 'I have a headache at 4,200 m'],
}
const ENGLISH_TOOL_LABELS: Record<string, string> = {
  consultar_radar_altitud: 'Check altitude radar',
  consultar_especie: 'Check species',
  consultar_ruta: 'Check trail',
  activar_protocolo_vida: 'Open safety protocol',
  consulta_fuentes_uton: 'Check UTON sources',
  recuperar_fragmentos_uton: 'Retrieve UTON excerpts',
  consultar_catalogo_especies: 'Check local species catalog',
  derivar_a_guia_autorizado: 'Refer to an authorized guide',
  consulta_general: 'Generate general answer',
  sin_fuente_disponible: 'No source available',
}
const SPANISH_TOOL_LABELS: Record<string, string> = {
  consultar_catalogo_especies: 'Consultar catálogo de especies',
  derivar_a_guia_autorizado: 'Consultar a un guía autorizado',
  consulta_general: 'Generar respuesta general',
}
const ENGLISH_SOURCE_LABELS: Record<string, string> = {
  'Catálogo local de especies PNN Los Nevados': 'Local Los Nevados species catalog',
  'Respuesta general · IA local': 'General response · local AI',
  'Respuesta general de IA local · no validada por UTON':
    'General local AI response · not validated by UTON',
}

export function RagChat({
  language,
  messages,
  loading,
  lastSpecies,
  ollamaConnected,
  modelAvailable,
  configuredModel,
  onSendMessage,
  onStartNewChat,
  onClearCache,
  onOpenSafety,
  onOpenRutas,
}: RagChatProps) {
  const [input, setInput] = useState(() => {
    try { return window.localStorage.getItem('kumanday_chat_draft_v1') ?? '' } catch { return '' }
  })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const chatThreadRef = useRef<HTMLDivElement | null>(null)
  const sendingRef = useRef(false)
  const sectionRef = useRef<HTMLElement | null>(null)

  function scrollChatToLatest() {
    const chatSection = sectionRef.current
    const appShell = chatSection?.closest<HTMLElement>('.app-shell')
    if (!chatSection || !appShell || chatSection.closest('.view-inactive')) return

    const chatThread = chatThreadRef.current
    chatThread?.scrollTo({ top: chatThread.scrollHeight, behavior: 'smooth' })
    if (appShell.classList.contains('keyboard-open')) return

    window.requestAnimationFrame(() => {
      if (chatSection.closest('.view-inactive') || appShell.classList.contains('keyboard-open')) return
      const sectionBottom = chatSection.getBoundingClientRect().bottom + window.scrollY
      const shellPadding = Number.parseFloat(window.getComputedStyle(appShell).paddingBottom) || 0
      const composer = appShell.querySelector<HTMLElement>('.chat-composer')
      const composerSpace = composer
        ? window.innerHeight - composer.getBoundingClientRect().top + 12
        : 0
      window.scrollTo({
        top: Math.max(0, sectionBottom - window.innerHeight + Math.max(shellPadding, composerSpace)),
        behavior: 'smooth',
      })
    })
  }

  function sendPrompt(prompt: string) {
    if (!prompt.trim() || loading || sendingRef.current) return
    sendingRef.current = true
    onSendMessage(prompt)
    window.setTimeout(() => { sendingRef.current = false }, 500)
  }

  useEffect(() => {
    scrollChatToLatest()
  }, [messages.length, loading])

  useEffect(() => {
    try { window.localStorage.setItem('kumanday_chat_draft_v1', input) } catch { /* optional cache */ }
  }, [input])

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return
    const appShell = sectionRef.current?.closest<HTMLElement>('.app-shell')
    const experienceContent = appShell?.querySelector<HTMLElement>('.experience-content')
    if (!appShell || !experienceContent) return
    let fullViewportHeight = visualViewport.height
    const updateViewport = () => {
      const inputFocused = document.activeElement?.id === 'rag-chat-input'
      const viewportShrunk = fullViewportHeight - visualViewport.height > 120
      const wasKeyboardOpen = appShell.classList.contains('keyboard-open')
      const keyboardOpen = viewportShrunk && (inputFocused || wasKeyboardOpen)
      const keyboardInset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
      if (!inputFocused || visualViewport.height >= fullViewportHeight - 80) {
        fullViewportHeight = Math.max(fullViewportHeight, visualViewport.height)
      }
      appShell.classList.toggle('keyboard-open', keyboardOpen)
      appShell.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
      appShell.style.setProperty('--chat-viewport-height', `${visualViewport.height}px`)
      appShell.style.setProperty(
        '--chat-header-height',
        `${appShell.querySelector('header')?.getBoundingClientRect().height ?? 0}px`,
      )
      if (wasKeyboardOpen && !keyboardOpen) {
        window.setTimeout(scrollChatToLatest, 220)
      }
    }
    const handleFocusOut = () => window.setTimeout(updateViewport, 100)
    visualViewport.addEventListener('resize', updateViewport)
    visualViewport.addEventListener('scroll', updateViewport)
    document.addEventListener('focusin', updateViewport)
    document.addEventListener('focusout', handleFocusOut)
    updateViewport()
    return () => {
      visualViewport.removeEventListener('resize', updateViewport)
      visualViewport.removeEventListener('scroll', updateViewport)
      document.removeEventListener('focusin', updateViewport)
      document.removeEventListener('focusout', handleFocusOut)
      appShell.classList.remove('keyboard-open')
      appShell.style.removeProperty('--keyboard-inset')
      appShell.style.removeProperty('--chat-viewport-height')
      appShell.style.removeProperty('--chat-header-height')
    }
  }, [])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const clean = input.trim()
    if (!clean || loading) return
    setInput('')
    try { window.localStorage.removeItem('kumanday_chat_draft_v1') } catch { /* optional cache */ }
    inputRef.current?.blur()
    sendPrompt(clean)
  }

  return (
    <section ref={sectionRef} className="chat-panel flex flex-col gap-3" aria-label={tx(language, 'Kumanday - Agente IA PNN Los Nevados', 'Kumanday - Los Nevados AI guide')}>
      {/* Context Bar */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-mountain-border bg-white px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frailejon text-white">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-mountain-ink">
              Kumanday • {language === 'es' ? 'Guía de estaciones' : 'Station guide'}
            </h2>
            <p className="truncate text-[11px] text-mountain-muted">
              {ollamaConnected && modelAvailable ? `${tx(language, 'Modelo local listo', 'Local model ready')} · ${configuredModel}` : ollamaConnected ? `${tx(language, 'Falta modelo', 'Model missing')} · ${configuredModel}` : tx(language, 'Asistente local disponible', 'Local assistant available')}
              {lastSpecies
                ? ` · ${localizedSpeciesName(language, lastSpecies)}`
                : ` · ${tx(language, 'UTON primero · IA general identificada', 'UTON first · general AI clearly labeled')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={loading} onClick={() => { setInput(''); try { window.localStorage.removeItem('kumanday_chat_draft_v1') } catch { /* optional cache */ }; onStartNewChat() }} aria-label={tx(language, 'Empezar un chat nuevo', 'Start a new chat')} title={tx(language, 'Chat nuevo', 'New chat')} className="toolbar-button">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{tx(language, 'Nuevo chat', 'New chat')}</span>
          </button>
          <button type="button" disabled={loading} onClick={() => { const accepted = onClearCache(); if (accepted) setInput('') }} aria-label={tx(language, 'Limpiar caché local', 'Clear local cache')} title={tx(language, 'Limpiar caché', 'Clear cache')} className="toolbar-button toolbar-button-muted">
            <DatabaseZap className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{tx(language, 'Caché', 'Cache')}</span>
          </button>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group">
        {QUICK_CHIPS[language].map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={loading}
            onClick={() => sendPrompt(chip)}
            className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border border-mountain-border bg-white px-3.5 py-2 text-xs font-semibold text-mountain-ink hover:bg-moss-surface hover:border-frailejon/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div ref={chatThreadRef} className="chat-thread flex flex-col gap-3">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-frailejon px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                  {msg.content}
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.safetyAlert
                    ? 'bg-life-alert text-white'
                    : msg.outOfDomain
                      ? 'bg-paramo-earth text-white'
                      : 'bg-frailejon text-white'
                }`}
                aria-hidden="true"
              >
                {msg.safetyAlert ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <Leaf className="h-4 w-4" />
                )}
              </div>
              <div
                className={`flex-1 rounded-2xl rounded-tl-sm border p-3.5 shadow-sm flex flex-col gap-2 ${
                  msg.safetyAlert
                    ? 'border-life-alert/40 bg-amber-surface'
                    : 'border-mountain-border bg-white'
                }`}
              >
                <p className="whitespace-pre-line text-sm leading-relaxed text-mountain-ink">
                  {msg.content}
                </p>

                {msg.suggestedAction === 'open_safety' && (
                  <button
                    type="button"
                    onClick={onOpenSafety}
                    className="min-h-[44px] self-start rounded-full bg-sos-red px-4 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    <span>{tx(language, 'Abrir Triaje de Emergencia y SOS', 'Open emergency information and SOS')}</span>
                  </button>
                )}

                {msg.suggestedAction === 'open_rutas' && (
                  <button
                    type="button"
                    onClick={onOpenRutas}
                    className="min-h-[44px] self-start rounded-full bg-moss-container px-4 py-2 text-xs font-bold text-frailejon-deep inline-flex items-center gap-1.5 hover:bg-moss-surface cursor-pointer"
                  >
                    <Compass className="h-4 w-4" aria-hidden="true" />
                    <span>{tx(language, 'Ver Corredores y Estaciones', 'View trails and stations')}</span>
                  </button>
                )}

                {(msg.toolsUsed?.length || msg.sources?.length) && (
                  <details className="border-t border-mountain-border/40 pt-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-mountain-muted">{language === 'es' ? 'Ver fuente y modo de respuesta' : 'Show source and response mode'}</summary>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-mountain-muted">
                        {msg.model === 'error-local' ? tx(language, 'Error del servicio', 'Service error') : msg.fallbackUsed ? tx(language, 'Respaldo local', 'Local fallback') : msg.model ?? 'Kumanday'}
                      </span>
                      {msg.toolsUsed?.map((tool) => (
                        <span key={tool} className="inline-flex items-center gap-1 rounded-full bg-moss-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-frailejon-deep">
                          <Wrench className="h-2.5 w-2.5" aria-hidden="true" />
                          <span>{language === 'en' ? ENGLISH_TOOL_LABELS[tool] ?? tool : SPANISH_TOOL_LABELS[tool] ?? tool}</span>
                        </span>
                      ))}
                      {msg.sources?.map((src) => (
                        <span key={src} className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold text-mountain-muted">
                          {language === 'en'
                            ? localizedSpeciesName(language, src) ?? ENGLISH_SOURCE_LABELS[src] ?? src
                            : src}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex items-start gap-2.5" role="status" aria-busy="true">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frailejon text-white">
              <Sparkles className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-mountain-border bg-white px-4 py-3 text-xs font-semibold text-mountain-muted">
              {tx(language, 'Consultando a Kumanday…', 'Asking Kumanday…')}
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="chat-composer rounded-2xl border border-mountain-border bg-white/95 p-1.5 shadow-lg backdrop-blur-md flex items-center gap-2"
      >
        <label htmlFor="rag-chat-input" className="sr-only">
          {tx(language, 'Escribe tu pregunta para Kumanday', 'Type your question for Kumanday')}
        </label>
        <input
          ref={inputRef}
          id="rag-chat-input"
          type="text"
          autoComplete="off"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tx(language, 'Pregúntale algo a Kumanday…', 'Ask Kumanday a question…')}
          className="min-h-[48px] flex-1 min-w-0 rounded-full bg-transparent px-4 text-sm text-mountain-ink placeholder:text-mountain-muted/70 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={tx(language, 'Enviar consulta a Kumanday', 'Send question to Kumanday')}
          className="min-h-[48px] min-w-[48px] shrink-0 rounded-full bg-frailejon text-white inline-flex items-center justify-center hover:bg-frailejon-deep disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
