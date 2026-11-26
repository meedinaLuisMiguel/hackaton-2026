import {
  Compass,
  DatabaseZap,
  Leaf,
  Mic,
  MicOff,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { localizedSpeciesName, tx, type Language } from '../i18n'
import { ApiError, postVoiceTranscription } from '../services/api'
import { convertVoiceRecordingToWav, MAX_VOICE_DURATION_SECONDS } from '../services/voiceAudio'
import type { UiChatMessage } from '../types/paramo'

interface RagChatProps {
  language: Language
  messages: UiChatMessage[]
  loading: boolean
  lastSpecies: string | null
  ollamaConnected: boolean
  modelAvailable: boolean
  configuredModel: string
  onSendMessage: (text: string, fromVoice?: boolean) => void
  onStartNewChat: () => void
  onClearCache: () => boolean
  onOpenSafety: () => void
  onOpenRutas: () => void
}

type VoiceStatus = 'idle' | 'preparing' | 'listening' | 'transcribing' | 'speaking' | 'error'
type VoiceError =
  | 'unsupported'
  | 'language-unavailable'
  | 'install-failed'
  | 'permission-denied'
  | 'microphone-unavailable'
  | 'no-speech'
  | 'recognition-failed'
  | 'invalid-audio'
  | 'transcription-failed'
  | 'model-unavailable'
  | 'recording-too-long'
  | 'no-local-voice'
  | 'secure-context-required'

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
  const discardVoiceInputRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const voiceAbortRef = useRef<AbortController | null>(null)
  const voiceSessionRef = useRef(0)
  const pendingVoiceReplyRef = useRef(false)
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [voiceState, setVoiceState] = useState<{ status: VoiceStatus; language: Language }>({
    status: 'idle',
    language,
  })
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null)
  const voiceStatus = voiceState.status
  const visibleVoiceStatus = voiceState.language === language ? voiceStatus : 'idle'
  const updateVoiceStatus = useCallback(
    (status: VoiceStatus) => setVoiceState({ status, language }),
    [language],
  )

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

  function sendPrompt(prompt: string, fromVoice = false) {
    if (!prompt.trim() || loading || sendingRef.current) return
    sendingRef.current = true
    pendingVoiceReplyRef.current = fromVoice
    onSendMessage(prompt, fromVoice)
    window.setTimeout(() => { sendingRef.current = false }, 500)
  }

  const speakReply = useCallback((text: string, responseLanguage: Language = language) => {
    const speech = window.speechSynthesis
    if (!speech) {
      setVoiceError('no-local-voice')
      updateVoiceStatus('error')
      return
    }

    speech.cancel()
    activeUtteranceRef.current = null
    const languagePrefix = responseLanguage === 'es' ? 'es' : 'en'
    const voice = speech.getVoices().find(
      (candidate) => candidate.localService && candidate.lang.toLowerCase().startsWith(languagePrefix),
    )
    if (!voice) {
      setVoiceError('no-local-voice')
      updateVoiceStatus('error')
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    activeUtteranceRef.current = utterance
    utterance.onstart = () => {
      if (activeUtteranceRef.current === utterance) updateVoiceStatus('speaking')
    }
    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null
        updateVoiceStatus('idle')
      }
    }
    utterance.onerror = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null
        setVoiceError('no-local-voice')
        updateVoiceStatus('error')
      }
    }
    speech.speak(utterance)
  }, [language, updateVoiceStatus])

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    activeUtteranceRef.current = null
    if (voiceStatus === 'speaking') updateVoiceStatus('idle')
  }

  const stopVoiceResources = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.onerror = null
      recorder.stop()
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    audioChunksRef.current = []
    voiceAbortRef.current?.abort()
    voiceAbortRef.current = null
  }, [])

  const cancelVoiceInput = useCallback(() => {
    voiceSessionRef.current += 1
    discardVoiceInputRef.current = true
    stopVoiceResources()
  }, [stopVoiceResources])

  function stopVoiceRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    updateVoiceStatus('transcribing')
    recorder.stop()
  }

  async function transcribeVoiceRecording(
    recording: Blob,
    session: number,
    requestedLanguage: Language,
  ) {
    try {
      const wav = await convertVoiceRecordingToWav(recording)
      if (session !== voiceSessionRef.current) return
      if (wav.size > 1_000_000) {
        setVoiceError('recording-too-long')
        updateVoiceStatus('error')
        return
      }

      const controller = new AbortController()
      voiceAbortRef.current = controller
      const result = await postVoiceTranscription(wav, requestedLanguage, controller.signal)
      if (session !== voiceSessionRef.current) return
      const transcript = result.transcript.trim()
      if (!transcript) {
        setVoiceError('no-speech')
        updateVoiceStatus('error')
        return
      }

      setInput('')
      updateVoiceStatus('idle')
      sendPrompt(transcript, true)
    } catch (error) {
      if (session !== voiceSessionRef.current) return
      setVoiceError(
        error instanceof RangeError
          ? 'recording-too-long'
          : error instanceof ApiError && error.status === 413
            ? 'recording-too-long'
            : error instanceof ApiError && error.status === 503
              ? 'model-unavailable'
              : error instanceof ApiError && error.status === 422
                ? 'invalid-audio'
                : 'transcription-failed',
      )
      updateVoiceStatus('error')
    } finally {
      if (session === voiceSessionRef.current) voiceAbortRef.current = null
    }
  }

  async function startVoiceInput() {
    const voiceSession = ++voiceSessionRef.current
    const requestedLanguage = language
    if (!window.isSecureContext) {
      setVoiceError('secure-context-required')
      updateVoiceStatus('error')
      return
    }
    if (
      !navigator.mediaDevices?.getUserMedia
      || typeof MediaRecorder === 'undefined'
      || typeof AudioContext === 'undefined'
      || typeof OfflineAudioContext === 'undefined'
    ) {
      setVoiceError('unsupported')
      updateVoiceStatus('error')
      return
    }

    updateVoiceStatus('preparing')
    setVoiceError(null)
    discardVoiceInputRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (voiceSession !== voiceSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      mediaStreamRef.current = stream
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        if (voiceSession !== voiceSessionRef.current) return
        discardVoiceInputRef.current = true
        stopVoiceResources()
        setVoiceError('transcription-failed')
        updateVoiceStatus('error')
      }
      recorder.onstop = () => {
        const recording = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        audioChunksRef.current = []
        recorderRef.current = null
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        if (voiceSession !== voiceSessionRef.current) return
        if (discardVoiceInputRef.current) {
          discardVoiceInputRef.current = false
          updateVoiceStatus('idle')
          return
        }
        if (recording.size === 0) {
          setVoiceError('no-speech')
          updateVoiceStatus('error')
          return
        }
        updateVoiceStatus('transcribing')
        void transcribeVoiceRecording(recording, voiceSession, requestedLanguage)
      }
      inputRef.current?.blur()
      recorder.start(250)
      updateVoiceStatus('listening')
      recordingTimerRef.current = window.setTimeout(
        stopVoiceRecording,
        MAX_VOICE_DURATION_SECONDS * 1000,
      )
    } catch (error) {
      if (voiceSession !== voiceSessionRef.current) return
      stopVoiceResources()
      setVoiceError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'permission-denied'
          : error instanceof DOMException && ['NotFoundError', 'NotReadableError'].includes(error.name)
            ? 'microphone-unavailable'
            : 'transcription-failed',
      )
      updateVoiceStatus('error')
    }
  }

  function handleVoiceButton() {
    if (visibleVoiceStatus === 'listening') {
      stopVoiceRecording()
      return
    }
    if (loading || ['preparing', 'transcribing'].includes(visibleVoiceStatus)) return
    window.speechSynthesis?.cancel()
    activeUtteranceRef.current = null
    void startVoiceInput()
  }

  function voiceStatusMessage(): string {
    if (voiceStatus === 'preparing') {
      return tx(
        language,
        'Solicitando el micrófono. Al detener, el audio se enviará solo al servidor local y no se guardará.',
        'Requesting microphone access. When you stop, audio goes only to the local server and is not saved.',
      )
    }
    if (voiceStatus === 'listening') {
      return tx(
        language,
        `Grabando… Toca para transcribir. Máximo ${MAX_VOICE_DURATION_SECONDS} segundos.`,
        `Recording… Tap to transcribe. Maximum ${MAX_VOICE_DURATION_SECONDS} seconds.`,
      )
    }
    if (voiceStatus === 'transcribing') {
      return tx(language, 'Transcribiendo en el servidor local… El audio no se conserva.', 'Transcribing on the local server… Audio is not retained.')
    }
    if (voiceStatus === 'speaking') {
      return tx(language, 'Kumanday está leyendo su respuesta. El texto y las fuentes siguen visibles.', 'Kumanday is reading its reply. The text and sources remain visible.')
    }
    if (voiceStatus !== 'error' || !voiceError) return ''

    const messages: Record<VoiceError, [string, string]> = {
      unsupported: [
        'Este navegador no permite grabación de audio compatible. Puedes seguir usando el chat escrito.',
        'This browser does not support compatible audio recording. You can keep using text chat.',
      ],
      'language-unavailable': [
        'Este dispositivo no tiene un paquete local para ese idioma. Instala el idioma en el navegador o continúa escribiendo.',
        'This device has no local speech pack for that language. Install the language in your browser or continue typing.',
      ],
      'install-failed': [
        'No se pudo instalar el paquete de voz local. Revisa la conexión y vuelve a intentarlo.',
        'The local speech pack could not be installed. Check your connection and try again.',
      ],
      'permission-denied': [
        'No se concedió permiso para usar el micrófono. Puedes continuar escribiendo.',
        'Microphone permission was not granted. You can continue typing.',
      ],
      'microphone-unavailable': [
        'No se encontró un micrófono disponible. Puedes continuar escribiendo.',
        'No microphone was found. You can continue typing.',
      ],
      'no-speech': [
        'No detecté voz. Toca el micrófono e inténtalo de nuevo.',
        'No speech was detected. Tap the microphone and try again.',
      ],
      'invalid-audio': [
        'No pude leer el audio grabado. Inténtalo de nuevo o escribe tu pregunta.',
        'The recorded audio could not be read. Try again or type your question.',
      ],
      'transcription-failed': [
        'Falló la transcripción local. Revisa que el servidor esté activo o escribe tu pregunta.',
        'Local transcription failed. Check that the server is running or type your question.',
      ],
      'model-unavailable': [
        'Falta instalar el modelo local de voz en el servidor. Consulta las instrucciones de configuración.',
        'The local speech model is missing from the server. Check the setup instructions.',
      ],
      'recording-too-long': [
        'La grabación supera el límite permitido. Inténtalo otra vez con una pregunta más corta.',
        'The recording exceeds the allowed limit. Try again with a shorter question.',
      ],
      'recognition-failed': [
        'Falló el reconocimiento local. Inténtalo de nuevo o escribe tu pregunta.',
        'On-device speech recognition failed. Try again or type your question.',
      ],
      'no-local-voice': [
        'No hay una voz instalada localmente para este idioma. La respuesta escrita sigue disponible.',
        'No local voice is installed for this language. The written reply is still available.',
      ],
      'secure-context-required': [
        'El micrófono solo funciona en localhost o en una conexión HTTPS segura.',
        'Microphone access requires localhost or a secure HTTPS connection.',
      ],
    }
    return tx(language, ...messages[voiceError])
  }

  useEffect(() => {
    scrollChatToLatest()
  }, [messages.length, loading])

  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (!pendingVoiceReplyRef.current || latestMessage?.role !== 'assistant') return
    pendingVoiceReplyRef.current = false
    const hasUtonCitation = latestMessage.sources?.some((source) => /uton|guion/i.test(source)) ?? false
    speakReply(latestMessage.content, hasUtonCitation ? 'es' : language)
  }, [language, messages, speakReply])

  useEffect(() => {
    return () => {
      cancelVoiceInput()
      window.speechSynthesis?.cancel()
      activeUtteranceRef.current = null
    }
  }, [cancelVoiceInput])

  useEffect(() => {
    cancelVoiceInput()
    window.speechSynthesis?.cancel()
    activeUtteranceRef.current = null
  }, [cancelVoiceInput, language])

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
          <button type="button" disabled={loading || visibleVoiceStatus === 'listening' || visibleVoiceStatus === 'preparing' || visibleVoiceStatus === 'transcribing'} onClick={() => { stopSpeaking(); setInput(''); try { window.localStorage.removeItem('kumanday_chat_draft_v1') } catch { /* optional cache */ }; onStartNewChat() }} aria-label={tx(language, 'Empezar un chat nuevo', 'Start a new chat')} title={tx(language, 'Chat nuevo', 'New chat')} className="toolbar-button">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{tx(language, 'Nuevo chat', 'New chat')}</span>
          </button>
          <button type="button" disabled={loading || visibleVoiceStatus === 'listening' || visibleVoiceStatus === 'preparing' || visibleVoiceStatus === 'transcribing'} onClick={() => { stopSpeaking(); const accepted = onClearCache(); if (accepted) setInput('') }} aria-label={tx(language, 'Limpiar caché local', 'Clear local cache')} title={tx(language, 'Limpiar caché', 'Clear cache')} className="toolbar-button toolbar-button-muted">
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
            disabled={loading || ['preparing', 'listening', 'transcribing'].includes(visibleVoiceStatus)}
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
                <button
                  type="button"
                  onClick={() => {
                    const hasUtonCitation = msg.sources?.some((source) => /uton|guion/i.test(source)) ?? false
                    speakReply(msg.content, hasUtonCitation ? 'es' : language)
                  }}
                  aria-label={tx(language, 'Leer respuesta en voz alta', 'Read reply aloud')}
                  title={tx(language, 'Leer respuesta en voz alta', 'Read reply aloud')}
                  className="toolbar-icon-button min-h-[44px] min-w-[44px] self-end"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                </button>

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

                {Boolean(msg.toolsUsed?.length || msg.sources?.length) && (
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
        {visibleVoiceStatus !== 'idle' && (
          <div className="voice-status" role="status" aria-live="polite">
            {visibleVoiceStatus === 'listening' && <span className="status-pulse inline-block h-2 w-2 rounded-full bg-life-alert" aria-hidden="true" />}
            <span>{voiceStatusMessage()}</span>
            {visibleVoiceStatus === 'speaking' && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="shrink-0 rounded-full px-2 py-1 font-semibold text-frailejon-deep hover:bg-moss-surface"
              >
                {tx(language, 'Detener audio', 'Stop audio')}
              </button>
            )}
          </div>
        )}
        <label htmlFor="rag-chat-input" className="sr-only">
          {tx(language, 'Escribe tu pregunta para Kumanday', 'Type your question for Kumanday')}
        </label>
        <input
          ref={inputRef}
          id="rag-chat-input"
          type="text"
          autoComplete="off"
          value={input}
          disabled={loading || ['preparing', 'listening', 'transcribing'].includes(visibleVoiceStatus)}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tx(language, 'Pregúntale algo a Kumanday…', 'Ask Kumanday a question…')}
          className="min-h-[48px] flex-1 min-w-0 rounded-full bg-transparent px-4 text-sm text-mountain-ink placeholder:text-mountain-muted/70 focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleVoiceButton}
          disabled={loading || visibleVoiceStatus === 'preparing' || visibleVoiceStatus === 'transcribing'}
          aria-label={visibleVoiceStatus === 'listening'
            ? tx(language, 'Detener y transcribir', 'Stop and transcribe')
            : tx(language, 'Preguntar por voz', 'Ask by voice')}
          title={visibleVoiceStatus === 'listening'
            ? tx(language, 'Detener y transcribir', 'Stop and transcribe')
            : tx(language, 'Preguntar por voz', 'Ask by voice')}
          className={`min-h-[48px] min-w-[48px] shrink-0 rounded-full inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
            visibleVoiceStatus === 'listening'
              ? 'bg-sos-red text-white'
              : 'bg-moss-container text-frailejon-deep hover:bg-moss-surface'
          }`}
        >
          {visibleVoiceStatus === 'listening'
            ? <MicOff className="h-5 w-5" aria-hidden="true" />
            : <Mic className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button
          type="submit"
          disabled={loading || !input.trim() || ['preparing', 'listening', 'transcribing'].includes(visibleVoiceStatus)}
          aria-label={tx(language, 'Enviar consulta a Kumanday', 'Send question to Kumanday')}
          className="min-h-[48px] min-w-[48px] shrink-0 rounded-full bg-frailejon text-white inline-flex items-center justify-center hover:bg-frailejon-deep disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
