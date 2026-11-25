import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  MessageSquare,
  ScanLine,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { SAMPLE_SPECIES_PHOTOS, type SamplePhoto } from '../data/offlineData'
import { postVision } from '../services/api'
import type { VisionResponse } from '../types/paramo'

interface VisionLensProps {
  altitude: number
  onAskAboutSpecies: (speciesName: string) => void
}

async function encodeElementToJpegBase64(img: HTMLImageElement): Promise<string> {
  const maxDim = 768
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el lienzo de imagen.')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.85)
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
    img.onerror = () => reject(new Error('No se pudo cargar la imagen de muestra.'))
    img.src = url
  })
}

async function loadImageBase64FromFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Error leyendo el archivo.'))
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
    img.onerror = () => reject(new Error('El archivo no es una imagen válida.'))
    img.src = dataUrl
  })
}

export function VisionLens({ altitude, onAskAboutSpecies }: VisionLensProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>(SAMPLE_SPECIES_PHOTOS[0].src)
  const [selectedLabel, setSelectedLabel] = useState<string>(SAMPLE_SPECIES_PHOTOS[0].label)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VisionResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function runVisionAnalysis(imageBase64: string, hint?: string) {
    setLoading(true)
    setErrorMsg(null)
    try {
      const response = await postVision({
        image_base64: imageBase64,
        altitud_m: altitude,
        hint,
      })
      setResult(response)
    } catch {
      setErrorMsg('No se pudo procesar la fotografía. Intenta con otra imagen.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSampleSelect(sample: SamplePhoto) {
    setPreviewUrl(sample.src)
    setSelectedLabel(sample.label)
    try {
      const b64 = await loadImageBase64FromUrl(sample.src)
      await runVisionAnalysis(b64, sample.id)
    } catch {
      setErrorMsg('No se pudo cargar la foto de prueba.')
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setSelectedLabel(file.name)
    try {
      const b64 = await loadImageBase64FromFile(file)
      await runVisionAnalysis(b64)
    } catch {
      setErrorMsg('Archivo inválido. Selecciona una fotografía JPG o PNG.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Lente de Páramo - Visión IA">
      <article className="overflow-hidden rounded-2xl border border-mountain-border bg-white shadow-sm">
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
                <span>{loading ? 'Analizando con IA Local...' : 'Visor PNNN Offline'}</span>
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
                Identifica flora y fauna local sin conexión a internet
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-paramo-earth tabular-nums">
              {altitude.toLocaleString('es-CO')} m
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="min-h-[48px] rounded-full bg-frailejon px-4 py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 hover:bg-frailejon-deep disabled:opacity-60 cursor-pointer"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>Tomar / Subir Foto</span>
            </button>

            <button
              type="button"
              onClick={() => handleSampleSelect(SAMPLE_SPECIES_PHOTOS[0])}
              disabled={loading}
              className="min-h-[48px] rounded-full border border-mountain-border bg-mist px-4 py-2 text-xs font-semibold text-mountain-ink inline-flex items-center justify-center gap-1.5 hover:bg-moss-container/50 disabled:opacity-60 cursor-pointer"
            >
              <Upload className="h-4 w-4 text-frailejon" aria-hidden="true" />
              <span>Analizar Vista</span>
            </button>
          </div>

          {/* Quick Test Samples */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-paramo-earth">
              Fotos de prueba rápidas (100% locales)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_SPECIES_PHOTOS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleSelect(sample)}
                  disabled={loading}
                  className="min-h-[48px] rounded-xl border border-mountain-border bg-mist/60 p-2 text-left flex items-center gap-2 hover:bg-moss-surface/60 disabled:opacity-60 cursor-pointer"
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
            <span>Procesando rasgos morfológicos en Ollama local...</span>
          </div>
          <div className="h-4 w-2/3 rounded bg-mist" />
          <div className="h-3 w-full rounded bg-mist" />
          <div className="h-3 w-5/6 rounded bg-mist" />
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl border border-sos-red/30 bg-sos-surface p-3.5 text-xs font-semibold text-on-sos-surface">
          {errorMsg}
        </div>
      )}

      {/* Scientific Result Sheet */}
      {result && !loading && (
        <article className="rounded-2xl border border-mountain-border bg-white p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-mountain-ink leading-snug">
                {result.nombre_comun}
              </h3>
              <p className="text-xs italic font-medium text-mountain-muted">
                {result.nombre_cientifico}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-moss-container px-2.5 py-1 text-[11px] font-semibold text-frailejon-deep">
              {result.tipo} • {result.confianza}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-moss-surface px-3 py-1 text-xs font-semibold text-frailejon-deep">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{result.estado}</span>
          </div>

          <p className="text-sm leading-relaxed text-mountain-ink">{result.descripcion_ia}</p>

          <p className="text-xs leading-relaxed text-mountain-muted">
            <strong className="font-semibold text-mountain-ink">Rol ecológico:</strong>{' '}
            {result.rol_ecologico}
          </p>

          <div
            role="status"
            className="rounded-xl border border-life-alert/30 bg-amber-surface p-3 flex items-start gap-2.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-life-alert mt-0.5" aria-hidden="true" />
            <p className="text-xs font-semibold leading-snug text-on-amber-surface">
              {result.alerta_conservacion}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-mountain-border/50">
            <span className="font-mono text-[11px] text-mountain-muted">
              Motor: {result.fallback_used ? 'Catálogo Offline' : result.model}
            </span>
            <button
              type="button"
              onClick={() =>
                onAskAboutSpecies(
                  `Cuéntame más sobre ${result.nombre_comun} (${result.nombre_cientifico}) y cómo cuidarlo.`,
                )
              }
              className="min-h-[44px] rounded-full bg-moss-container px-3.5 text-xs font-semibold text-frailejon-deep inline-flex items-center gap-1.5 hover:bg-moss-surface cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Profundizar en Chat</span>
            </button>
          </div>
        </article>
      )}
    </section>
  )
}
