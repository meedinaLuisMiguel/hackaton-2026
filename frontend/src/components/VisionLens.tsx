import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  MessageSquare,
  ScanLine,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { SAMPLE_SPECIES_PHOTOS, type SamplePhoto } from '../data/offlineData'
import { ApiError, postVision } from '../services/api'
import type { Especie, VisionResponse } from '../types/paramo'

interface VisionLensProps {
  altitude: number
  especies: Especie[]
  onSpeciesIdentified: (speciesName: string | null) => void
  onAskKumanday: (promptText: string, speciesContext?: string) => void
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXT_REGEX = /\.(jpe?g|png|webp)$/i
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MIN_IMAGE_DIM = 32
const MAX_CLIENT_DIM = 512

async function encodeElementToJpegBase64(img: HTMLImageElement): Promise<string> {
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (width < MIN_IMAGE_DIM || height < MIN_IMAGE_DIM) {
    throw new Error('La imagen es demasiado pequeña (mínimo 32x32 píxeles).')
  }
  const scale = Math.min(1, MAX_CLIENT_DIM / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el lienzo de imagen.')
  ctx.drawImage(img, 0, 0, targetW, targetH)
  return canvas.toDataURL('image/jpeg', 0.82)
}

async function loadImageBase64FromUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        resolve(await encodeElementToJpegBase64(img))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen seleccionada.'))
    img.src = url
  })
}

async function loadImageBase64FromFile(file: File): Promise<string> {
  const validMime = ALLOWED_MIME_TYPES.has(file.type.toLowerCase())
  const validExt = ALLOWED_EXT_REGEX.test(file.name)
  if (!validMime || !validExt) {
    throw new Error('Formato no permitido. Sube únicamente imágenes JPG, PNG o WebP.')
  }
  if (file.size === 0) {
    throw new Error('El archivo seleccionado está vacío.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('La imagen supera el límite máximo permitido de 10 MB.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo desde el dispositivo.'))
    reader.readAsDataURL(file)
  })

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        resolve(await encodeElementToJpegBase64(img))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () =>
      reject(new Error('El archivo no contiene una imagen válida (JPG, PNG o WebP).'))
    img.src = dataUrl
  })
}

export function VisionLens({
  altitude,
  especies,
  onSpeciesIdentified,
  onAskKumanday,
}: VisionLensProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const inFlightRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string>(SAMPLE_SPECIES_PHOTOS[0].src)
  const [selectedLabel, setSelectedLabel] = useState<string>(SAMPLE_SPECIES_PHOTOS[0].label)
  const [activeHint, setActiveHint] = useState<string | undefined>(SAMPLE_SPECIES_PHOTOS[0].id)
  const [cachedBase64, setCachedBase64] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<VisionResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogFilter, setCatalogFilter] = useState<'Todas' | 'Flora' | 'Fauna'>('Todas')

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  function updatePreview(url: string, label: string, hint: string | undefined, isObjUrl: boolean) {
    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (isObjUrl) {
      objectUrlRef.current = url
    }
    setPreviewUrl(url)
    setSelectedLabel(label)
    setActiveHint(hint)
  }

  async function runVisionAnalysis(imageBase64: string, hint?: string) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setErrorMsg(null)
    setCachedBase64(imageBase64)

    try {
      const response = await postVision({
        image_base64: imageBase64,
        altitud_m: altitude,
        hint: hint ? `sample:${hint}` : undefined,
      })
      setResult(response)
      onSpeciesIdentified(response.en_pnnn ? response.nombre_comun : null)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'No se pudo procesar la fotografía. Verifica que sea JPG, PNG o WebP.'
      setErrorMsg(msg)
      setResult(null)
      onSpeciesIdentified(null)
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }

  async function handleSampleSelect(sample: SamplePhoto) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    updatePreview(sample.src, sample.label, sample.id, false)
    try {
      const b64 = await loadImageBase64FromUrl(sample.src)
      inFlightRef.current = false
      setLoading(false)
      await runVisionAnalysis(b64, sample.id)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar la foto de prueba.')
      setLoading(false)
      inFlightRef.current = false
    }
  }

  async function processIncomingFile(file: File) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setErrorMsg(null)
    try {
      const b64 = await loadImageBase64FromFile(file)
      const objUrl = URL.createObjectURL(file)
      updatePreview(objUrl, file.name, undefined, true)
      inFlightRef.current = false
      setLoading(false)
      await runVisionAnalysis(b64, undefined)
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Archivo inválido. Solo se aceptan imágenes JPG, PNG o WebP.',
      )
      setLoading(false)
      inFlightRef.current = false
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await processIncomingFile(file)
  }

  function openCamera() {
    if (!window.isSecureContext) {
      setErrorMsg('La cámara requiere una conexión segura (HTTPS) o abrir la app desde localhost. Prueba con “Elegir imagen” en este dispositivo.')
      return
    }
    setErrorMsg(null)
    if (!cameraInputRef.current) {
      setErrorMsg('No se pudo abrir la cámara. Revisa los permisos del navegador o usa “Elegir imagen”.')
      return
    }
    cameraInputRef.current?.click()
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    if (inFlightRef.current) return
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await processIncomingFile(file)
  }

  async function handleReanalyzeCurrent() {
    if (inFlightRef.current) return
    try {
      const b64 = cachedBase64 ?? (await loadImageBase64FromUrl(previewUrl))
      await runVisionAnalysis(b64, activeHint)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo re-analizar la imagen actual.')
    }
  }

  const filteredSpecies = especies.filter(
    (sp) => catalogFilter === 'Todas' || sp.tipo === catalogFilter,
  )

  return (
    <section className="flex flex-col gap-4" aria-label="Lente de Páramo - Visión IA">
      <article
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
          dragOver ? 'border-frailejon ring-2 ring-frailejon/40' : 'border-mountain-border'
        }`}
      >
        {/* Camera Viewfinder */}
        <div className="relative h-56 w-full bg-mountain-ink overflow-hidden">
          <img
            src={previewUrl}
            alt={`Vista de especie: ${selectedLabel}`}
            className="h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-4 flex flex-col justify-between"
            aria-hidden="true"
          >
            <div className="flex justify-between">
              <span className="h-5 w-5 rounded-tl-sm border-t-2 border-l-2 border-white/90" />
              <span className="h-5 w-5 rounded-tr-sm border-t-2 border-r-2 border-white/90" />
            </div>
            <div className="flex items-end justify-between">
              <span className="h-5 w-5 rounded-bl-sm border-b-2 border-l-2 border-white/90" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mountain-ink/80 px-3 py-1 font-mono text-xs text-white backdrop-blur-sm">
                <ScanLine className="h-3.5 w-3.5 text-moss-surface" />
                <span>{loading ? 'Kumanday analizando...' : 'Lente Kumanday • JPG/PNG/WebP'}</span>
              </span>
              <span className="h-5 w-5 rounded-br-sm border-b-2 border-r-2 border-white/90" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-mountain-ink">Lente de Páramo (Visión IA)</h2>
              <p className="text-xs text-mountain-muted">
                Reconoce objetos y especies • JPG, PNG o WebP
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-paramo-earth tabular-nums">
              {altitude.toLocaleString('es-CO')} m
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openCamera}
              disabled={loading}
              className="min-h-[48px] rounded-full bg-frailejon px-3.5 py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 hover:bg-frailejon-deep disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Tomar foto</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="min-h-[48px] rounded-full border border-mountain-border bg-mist px-3.5 py-2 text-xs font-semibold text-mountain-ink inline-flex items-center justify-center gap-1.5 hover:bg-moss-container/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ImageIcon className="h-4 w-4 shrink-0 text-frailejon" aria-hidden="true" />
              <span>Elegir imagen</span>
            </button>
          </div>
          {previewUrl.startsWith('blob:') && (
            <button type="button" onClick={handleReanalyzeCurrent} disabled={loading} className="self-start text-xs font-semibold text-frailejon underline underline-offset-2 disabled:opacity-50">Volver a analizar esta foto</button>
          )}

          {/* Quick Test Samples */}
          <div className="flex flex-col gap-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-paramo-earth">
              O explora una muestra
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SAMPLE_SPECIES_PHOTOS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleSelect(sample)}
                  disabled={loading}
                  className={`min-h-[48px] min-w-[155px] rounded-xl border p-2 text-left flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    activeHint === sample.id && previewUrl === sample.src
                      ? 'border-frailejon bg-moss-surface/50'
                      : 'border-mountain-border bg-mist/60 hover:bg-moss-surface/40'
                  }`}
                >
                  <img
                    src={sample.src}
                    alt={sample.label}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-mountain-ink">
                      {sample.label}
                    </div>
                    <div className="truncate text-[10px] italic text-mountain-muted">
                      {sample.subtitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* Loading Skeleton */}
      {loading && (
        <div
          role="status"
          className="rounded-2xl border border-mountain-border bg-white p-4 shadow-sm flex flex-col gap-3 animate-pulse"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-frailejon">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Kumanday está analizando la captura…</span>
          </div>
          <div className="h-4 w-2/3 rounded bg-mist" />
          <div className="h-3 w-full rounded bg-mist" />
          <div className="h-3 w-5/6 rounded bg-mist" />
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-sos-red/30 bg-sos-surface p-3.5 text-xs font-semibold text-on-sos-surface flex items-start gap-2"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Scientific Result Sheet */}
      {result && !loading && (
        <article
          className={`rounded-2xl border bg-white p-4 shadow-sm flex flex-col gap-3 ${
              result.en_pnnn || result.tipo === 'Objeto' ? 'border-mountain-border' : 'border-life-alert/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-mountain-ink leading-snug">
                {result.nombre_comun}
              </h3>
              <p className="text-xs italic font-medium text-mountain-muted">
                {result.nombre_cientifico}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                result.en_pnnn || result.tipo === 'Objeto'
                  ? 'bg-moss-container text-frailejon-deep'
                  : 'bg-amber-surface text-on-amber-surface'
              }`}
            >
              {result.tipo} • {result.confianza}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold ${
              result.en_pnnn || result.tipo === 'Objeto'
                ? 'bg-moss-surface text-frailejon-deep'
                : 'bg-sos-surface text-on-sos-surface'
            }`}
          >
            {result.en_pnnn || result.tipo === 'Objeto' ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{result.estado}</span>
          </div>

          <p className="text-sm leading-relaxed text-mountain-ink">{result.descripcion_ia}</p>

          <p className="text-xs leading-relaxed text-mountain-muted">
            {result.tipo === 'Objeto' ? result.rol_ecologico : <><strong className="font-semibold text-mountain-ink">Contexto ecológico:</strong>{' '}{result.rol_ecologico}</>}
          </p>

          {result.alerta_conservacion && <div
            role="status"
            className="rounded-xl border border-life-alert/30 bg-amber-surface p-3 flex items-start gap-2.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-life-alert mt-0.5" aria-hidden="true" />
            <p className="text-xs font-semibold leading-snug text-on-amber-surface">
              {result.alerta_conservacion}
            </p>
          </div>}

          {result.enfoque_notice && (
            <p className="rounded-xl border border-frailejon/20 bg-moss-surface/60 px-3 py-2 text-xs leading-relaxed text-frailejon-deep">{result.enfoque_notice}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-mountain-border/50">
            <span className="font-mono text-[11px] text-mountain-muted">
              {result.fallback_used ? 'Ficha local' : `IA local · ${result.model}`}
            </span>
            <button
              type="button"
              onClick={() =>
                result.en_pnnn
                  ? onAskKumanday(
                      `Explícame el rol ecológico y cómo proteger a ${result.nombre_comun} (${result.nombre_cientifico}).`,
                      result.nombre_comun,
                    )
                  : onAskKumanday(
                      `¿Qué fauna y flora nativa puedo encontrar a ${altitude.toLocaleString('es-CO')} m s.n.m. en el PNN Los Nevados?`,
                    )
              }
              className="min-h-[44px] rounded-full bg-moss-container px-3.5 text-xs font-semibold text-frailejon-deep inline-flex items-center gap-1.5 hover:bg-moss-surface cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {result.en_pnnn ? 'Profundizar con Kumanday' : 'Ver especies del parque'}
              </span>
            </button>
          </div>
        </article>
      )}

      {/* Offline 12-Species Explorer */}
      <section className="rounded-2xl border border-mountain-border bg-white/90 p-4 shadow-sm flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setCatalogOpen((v) => !v)}
          aria-expanded={catalogOpen}
          className="min-h-[44px] w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-frailejon" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-mountain-ink">
                Catálogo Verificado ({especies.length} especies)
              </h3>
              <p className="text-[11px] text-mountain-muted">
                Flora y fauna nativa incluida en el dispositivo
              </p>
            </div>
          </div>
          {catalogOpen ? (
            <ChevronUp className="h-5 w-5 text-mountain-muted" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5 text-mountain-muted" aria-hidden="true" />
          )}
        </button>

        {catalogOpen && (
          <div className="flex flex-col gap-3 border-t border-mountain-border/50 pt-3">
            <div className="flex gap-2">
              {(['Todas', 'Flora', 'Fauna'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCatalogFilter(tab)}
                  className={`min-h-[40px] rounded-full px-3.5 text-xs font-semibold cursor-pointer ${
                    catalogFilter === tab
                      ? 'bg-frailejon text-white'
                      : 'border border-mountain-border bg-mist text-mountain-ink'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2.5">
              {filteredSpecies.map((sp) => (
                <article
                  key={sp.id}
                  className="rounded-xl border border-mountain-border/70 bg-mist/60 p-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-mountain-ink">{sp.nombre_comun}</h4>
                      <p className="text-[11px] italic text-mountain-muted">
                        {sp.nombre_cientifico}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-moss-container px-2 py-0.5 text-[10px] font-semibold text-frailejon-deep">
                      {sp.tipo}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-mountain-muted">{sp.rol_ecologico}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-[10px] text-paramo-earth">
                      {sp.pisos.join(' • ')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onAskKumanday(
                          `Cuéntame más sobre ${sp.nombre_comun} (${sp.nombre_cientifico}) y dónde habita.`,
                          sp.nombre_comun,
                        )
                      }
                      className="min-h-[36px] rounded-full bg-white border border-frailejon/30 px-2.5 text-[11px] font-semibold text-frailejon hover:bg-moss-surface/60 cursor-pointer"
                    >
                      Consultar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  )
}
