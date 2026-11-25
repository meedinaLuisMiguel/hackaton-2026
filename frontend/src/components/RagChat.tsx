import { Leaf, Send, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { postChat } from '../services/api'
import type { ChatTurn } from '../types/paramo'

interface RagChatProps {
  altitude: number
  initialPrompt: string | null
  onConsumeInitialPrompt: () => void
  onOpenSafety: () => void
}

interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  model?: string
  fallbackUsed?: boolean
  safetyAlert?: boolean
}

const QUICK_CHIPS = [
  '¿Cómo produce agua el frailejón?',
  'Tengo dolor de cabeza a 4.200 m',
  '¿Qué aves viven aquí?',
  'Reglas Valle de las Tumbas',
]

const WELCOME_MSG: UiMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Soy tu Guía Científico Offline del PNN Los Nevados. Respondo únicamente con conocimiento verificado sobre ecología de páramo, rutas autorizadas y seguridad en alta montaña.',
  sources: ['Base Científica PNN Los Nevados'],
}

export function RagChat({
  altitude,
  initialPrompt,
  onConsumeInitialPrompt,
  onOpenSafety,
}: RagChatProps) {
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(rawText: string) {
    const clean = rawText.trim()
    if (!clean || loading) return

    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: clean,
    }
    const history: ChatTurn[] = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await postChat({
        message: clean,
        altitud_m: altitude,
        history,
      })
      const assistantMsg: UiMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        sources: res.sources,
        model: res.model,
        fallbackUsed: res.fallback_used,
        safetyAlert: res.safety_alert,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialPrompt) {
      const promptToRun = initialPrompt
      onConsumeInitialPrompt()
      void sendMessage(promptToRun)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void sendMessage(input)
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Guía Científico RAG Offline">
      {/* Context Bar */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-mountain-border bg-white px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frailejon text-white">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-mountain-ink">Guía Científico RAG</h2>
            <p className="font-mono text-[11px] text-mountain-muted tabular-nums">
              Contexto activo: {altitude.toLocaleString('es-CO')} m s.n.m.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMessages([WELCOME_MSG])}
          aria-label="Reiniciar conversación"
          className="min-h-[44px] min-w-[44px] rounded-full text-mountain-muted hover:bg-mist inline-flex items-center justify-center cursor-pointer"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={loading}
            onClick={() => void sendMessage(chip)}
            className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border border-mountain-border bg-white px-3.5 py-2 text-xs font-semibold text-mountain-ink hover:bg-moss-surface hover:border-frailejon/30 disabled:opacity-60 cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div className="flex flex-col gap-3">
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
                  msg.safetyAlert ? 'bg-life-alert text-white' : 'bg-frailejon text-white'
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

                {msg.safetyAlert && (
                  <button
                    type="button"
                    onClick={onOpenSafety}
                    className="min-h-[44px] self-start rounded-full bg-sos-red px-4 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    <span>Abrir Triaje de Emergencia y SOS</span>
                  </button>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-mountain-border/40 pt-2">
                    <span className="font-mono text-[10px] text-mountain-muted">
                      {msg.fallbackUsed ? 'Offline verificado' : msg.model}:
                    </span>
                    {msg.sources.map((src) => (
                      <span
                        key={src}
                        className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold text-frailejon-deep"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex items-start gap-2.5" role="status">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-frailejon text-white">
              <Sparkles className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-mountain-border bg-white px-4 py-3 text-xs font-semibold text-mountain-muted">
              Consultando base científica del PNN Los Nevados...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-20 z-20 rounded-full border border-mountain-border bg-white/95 p-1.5 shadow-md backdrop-blur-md flex items-center gap-2"
      >
        <label htmlFor="rag-chat-input" className="sr-only">
          Escribe tu pregunta sobre el páramo
        </label>
        <input
          id="rag-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta sin señal sobre flora, rutas o salud..."
          className="min-h-[48px] flex-1 min-w-0 rounded-full bg-transparent px-4 text-sm text-mountain-ink placeholder:text-mountain-muted/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar consulta"
          className="min-h-[48px] min-w-[48px] shrink-0 rounded-full bg-frailejon text-white inline-flex items-center justify-center hover:bg-frailejon-deep disabled:opacity-50 cursor-pointer"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
