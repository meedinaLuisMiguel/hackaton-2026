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
import type { UiChatMessage } from '../types/paramo'

interface RagChatProps {
  altitude: number
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

const QUICK_CHIPS = [
  '¿Cómo produce agua el frailejón?',
  'Tengo dolor de cabeza a 4.200 m',
]

export function RagChat({
  altitude,
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
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const sendingRef = useRef(false)
  const sectionRef = useRef<HTMLElement | null>(null)

  function sendPrompt(prompt: string) {
    if (!prompt.trim() || loading || sendingRef.current) return
    sendingRef.current = true
    onSendMessage(prompt)
    window.setTimeout(() => { sendingRef.current = false }, 500)
  }

  useEffect(() => {
    const chatSection = sectionRef.current
    if (!chatSection || chatSection.closest('.view-inactive')) return
    const chatTop = chatSection.getBoundingClientRect().top
    const chatBottom = chatSection.getBoundingClientRect().bottom
    const viewportBottom = window.visualViewport?.height ?? window.innerHeight
    // Keep the latest conversation in view only when it was already in the user's reading area.
    // This avoids switching tabs or starting a chat from yanking the whole page to the bottom.
    if (chatBottom > 0 && chatTop < viewportBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
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
    const updateViewport = () => {
      const keyboardInset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
      const keyboardOpen = keyboardInset > 120
      appShell.classList.toggle('keyboard-open', keyboardOpen)
      appShell.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
      experienceContent.style.setProperty('--chat-viewport-height', `${visualViewport.height}px`)
    }
    visualViewport.addEventListener('resize', updateViewport)
    visualViewport.addEventListener('scroll', updateViewport)
    updateViewport()
    return () => {
      visualViewport.removeEventListener('resize', updateViewport)
      visualViewport.removeEventListener('scroll', updateViewport)
      appShell.classList.remove('keyboard-open')
      appShell.style.removeProperty('--keyboard-inset')
      experienceContent.style.removeProperty('--chat-viewport-height')
    }
  }, [])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const clean = input.trim()
    if (!clean || loading) return
    setInput('')
    try { window.localStorage.removeItem('kumanday_chat_draft_v1') } catch { /* optional cache */ }
    sendPrompt(clean)
  }

  return (
    <section ref={sectionRef} className="chat-panel flex flex-col gap-3" aria-label="Kumanday - Agente IA PNN Los Nevados">
      {/* Context Bar */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-mountain-border bg-white px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frailejon text-white">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-mountain-ink">
              Kumanday • Agente PNNN
            </h2>
            <p className="truncate text-[11px] text-mountain-muted">
              {ollamaConnected && modelAvailable ? `Modelo local listo · ${configuredModel}` : ollamaConnected ? `Falta modelo · ${configuredModel}` : 'Asistente local disponible'}
              {lastSpecies ? ` · ${lastSpecies}` : ` · ${altitude.toLocaleString('es-CO')} m`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={loading} onClick={() => { setInput(''); try { window.localStorage.removeItem('kumanday_chat_draft_v1') } catch { /* optional cache */ }; onStartNewChat() }} aria-label="Empezar un chat nuevo" title="Chat nuevo" className="toolbar-button">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Nuevo chat</span>
          </button>
          <button type="button" disabled={loading} onClick={() => { const accepted = onClearCache(); if (accepted) setInput('') }} aria-label="Limpiar caché local" title="Limpiar caché" className="toolbar-button toolbar-button-muted">
            <DatabaseZap className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Caché</span>
          </button>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group">
        {QUICK_CHIPS.map((chip) => (
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
      <div className="chat-thread flex flex-col gap-3">
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
                    <span>Abrir Triaje de Emergencia y SOS</span>
                  </button>
                )}

                {msg.suggestedAction === 'open_rutas' && (
                  <button
                    type="button"
                    onClick={onOpenRutas}
                    className="min-h-[44px] self-start rounded-full bg-moss-container px-4 py-2 text-xs font-bold text-frailejon-deep inline-flex items-center gap-1.5 hover:bg-moss-surface cursor-pointer"
                  >
                    <Compass className="h-4 w-4" aria-hidden="true" />
                    <span>Ver Corredores y Estaciones</span>
                  </button>
                )}

                {(msg.toolsUsed?.length || msg.sources?.length) && (
                  <details className="border-t border-mountain-border/40 pt-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-mountain-muted">Ver fuente y modo de respuesta</summary>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-mountain-muted">
                        {msg.model === 'error-local' ? 'Error del servicio' : msg.fallbackUsed ? 'Respaldo local' : msg.model ?? 'Kumanday'}
                      </span>
                      {msg.toolsUsed?.map((tool) => (
                        <span key={tool} className="inline-flex items-center gap-1 rounded-full bg-moss-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-frailejon-deep">
                          <Wrench className="h-2.5 w-2.5" aria-hidden="true" />
                          <span>{tool}</span>
                        </span>
                      ))}
                      {msg.sources?.map((src) => (
                        <span key={src} className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold text-mountain-muted">{src}</span>
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
              Consultando a Kumanday…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="chat-composer rounded-2xl border border-mountain-border bg-white/95 p-1.5 shadow-lg backdrop-blur-md flex items-center gap-2"
      >
        <label htmlFor="rag-chat-input" className="sr-only">
          Escribe tu pregunta para Kumanday
        </label>
        <input
          id="rag-chat-input"
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntale algo a Kumanday…"
          className="min-h-[48px] flex-1 min-w-0 rounded-full bg-transparent px-4 text-sm text-mountain-ink placeholder:text-mountain-muted/70 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar consulta a Kumanday"
          className="min-h-[48px] min-w-[48px] shrink-0 rounded-full bg-frailejon text-white inline-flex items-center justify-center hover:bg-frailejon-deep disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
