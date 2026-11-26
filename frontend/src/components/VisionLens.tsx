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
import { speciesText, translateElevationZone, tx, type Language } from '../i18n'
import type { Especie, VisionResponse } from '../types/paramo'

interface VisionLensProps {
  language: Language
  especies: Especie[]
  onSpeciesIdentified: (speciesName: string | null) => void
  onAskKumanday: (promptText: string, speciesContext?: string) => void
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXT_REGEX = /\.(jpe?g|png|webp)$/i
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MIN_IMAGE_DIM = 32
const MAX_CLIENT_DIM = 512

const ENGLISH_VISION_TEXT: Record<string, string> = {
  'Identificación sin confirmar': 'Unconfirmed identification',
  'Sin coincidencia en el catálogo PNN Los Nevados': 'No match in the Los Nevados catalog',
  'Objeto o elemento fuera del catálogo de especies del parque': 'Object or item outside the park species catalog',
  'No pertenece al ecosistema del parque': 'Outside the park ecosystem',
  'Elemento identificado; fuera del catálogo de especies': 'Identified item; outside the species catalog',
  'Resultado no verificable': 'Unverified result',
  'Observación general sin identificación de especie': 'General observation; no species identified',
  'Entorno de alta montaña': 'High-mountain environment',
  'Ecosistema PNN Los Nevados': 'Los Nevados National Natural Park ecosystem',
  'La imagen se reconoce fuera del catálogo de flora y fauna del PNN Los Nevados.': 'The image is outside the Los Nevados National Natural Park flora and fauna catalog.',
  'Kumanday puede reconocer elementos de uso cotidiano, aunque su catálogo se centra en la biodiversidad del parque.': 'Kumanday can recognize everyday objects, although its catalog focuses on the park’s biodiversity.',
  'Puedo ayudarte con objetos cotidianos; mi especialidad es la biodiversidad y las rutas del PNN Los Nevados.': 'I can help with everyday objects; my specialty is the biodiversity and trails of Los Nevados National Natural Park.',
  'El modelo no relacionó la observación con una especie validada del catálogo local.': 'The model could not match the observation to a verified species in the local catalog.',
  'No uses esta respuesta como identificación. Consulta las fichas verificadas del parque.': 'Do not use this as a confirmed identification. Check the park’s verified species records.',
  'Paisaje de alta montaña, páramo y ecosistema volcánico.': 'A high-mountain landscape with páramo and volcanic ecosystems.',
  'Permanece en el sendero demarcado y no recolectes material natural.': 'Stay on marked trails and do not collect natural materials.',
  'No fue posible validar una especie nativa en el catálogo local.': 'A native species could not be verified in the local catalog.',
  'Consulta el catálogo verificado o vuelve a tomar la fotografía.': 'Check the verified catalog or take another photo.',
  'No se obtuvo una identificación verificable.': 'No verifiable identification was obtained.',
}

async function encodeElementToJpegBase64(img: HTMLImageElement, language: Language): Promise<string> {
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (width < MIN_IMAGE_DIM || height < MIN_IMAGE_DIM) {
    throw new Error(tx(language, 'La imagen es demasiado pequeña (mínimo 32x32 píxeles).', 'The image is too small (minimum 32×32 pixels).'))
  }
  const scale = Math.min(1, MAX_CLIENT_DIM / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(tx(language, 'No se pudo inicializar el lienzo de imagen.', 'Could not initialize the image canvas.'))
  ctx.drawImage(img, 0, 0, targetW, targetH)
  return canvas.toDataURL('image/jpeg', 0.82)
}

async function loadImageBase64FromUrl(url: string, language: Language): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        resolve(await encodeElementToJpegBase64(img, language))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error(tx(language, 'No se pudo decodificar la imagen seleccionada.', 'Could not decode the selected image.')))
    img.src = url
  })
}

async function loadBundledSampleBase64(url: string, language: Language): Promise<string> {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(tx(language, 'No se pudo cargar la muestra local.', 'Could not load the local sample.'))
  }
  const blob = await response.blob()
  if (!ALLOWED_MIME_TYPES.has(blob.type.toLowerCase())) {
    throw new Error(tx(language, 'La muestra local tiene un formato no permitido.', 'The local sample has an unsupported format.'))
  }
  if (blob.size > MAX_FILE_BYTES) {
    throw new Error(tx(language, 'La muestra supera el límite máximo de 8 MiB.', 'The sample exceeds the 8 MiB limit.'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(tx(language, 'No se pudo leer la muestra local.', 'Could not read the local sample.')))
    reader.readAsDataURL(blob)
  })
}

async function loadImageBase64FromFile(file: File, language: Language): Promise<string> {
  const validMime = ALLOWED_MIME_TYPES.has(file.type.toLowerCase())
  const validExt = ALLOWED_EXT_REGEX.test(file.name)
  if (!validMime || !validExt) {
    throw new Error(tx(language, 'Formato no permitido. Sube únicamente imágenes JPG, PNG o WebP.', 'Unsupported format. Upload a JPG, PNG, or WebP image.'))
  }
  if (file.size === 0) {
    throw new Error(tx(language, 'El archivo seleccionado está vacío.', 'The selected file is empty.'))
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(tx(language, 'La imagen supera el límite máximo permitido de 8 MiB.', 'The image exceeds the 8 MiB limit.'))
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(tx(language, 'No se pudo leer el archivo desde el dispositivo.', 'Could not read the file from this device.')))
    reader.readAsDataURL(file)
  })

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        resolve(await encodeElementToJpegBase64(img, language))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () =>
      reject(new Error(tx(language, 'El archivo no contiene una imagen válida (JPG, PNG o WebP).', 'The file does not contain a valid image (JPG, PNG, or WebP).')))
    img.src = dataUrl
  })
}

export function VisionLens({
  language,
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
        hint: hint ? `sample:${hint}` : undefined,
        language,
      })
      setResult(response)
      onSpeciesIdentified(response.en_pnnn ? response.nombre_comun : null)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : tx(language, 'No se pudo procesar la fotografía. Verifica que sea JPG, PNG o WebP.', 'Could not process the photo. Check that it is JPG, PNG, or WebP.')
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
      const b64 = await loadBundledSampleBase64(sample.src, language)
      inFlightRef.current = false
      setLoading(false)
      await runVisionAnalysis(b64, sample.id)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tx(language, 'No se pudo cargar la foto de prueba.', 'Could not load the sample photo.'))
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
      const b64 = await loadImageBase64FromFile(file, language)
      const objUrl = URL.createObjectURL(file)
      updatePreview(objUrl, file.name, undefined, true)
      inFlightRef.current = false
      setLoading(false)
      await runVisionAnalysis(b64, undefined)
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : tx(language, 'Archivo inválido. Solo se aceptan imágenes JPG, PNG o WebP.', 'Invalid file. Only JPG, PNG, or WebP images are supported.'),
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
      setErrorMsg(tx(language, 'La cámara requiere una conexión segura (HTTPS) o abrir la app desde localhost. Prueba con “Elegir imagen” en este dispositivo.', 'Camera access requires a secure connection (HTTPS) or localhost. Try “Choose image” on this device.'))
      return
    }
    setErrorMsg(null)
    if (!cameraInputRef.current) {
      setErrorMsg(tx(language, 'No se pudo abrir la cámara. Revisa los permisos del navegador o usa “Elegir imagen”.', 'Could not open the camera. Check browser permissions or use “Choose image”.'))
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
      const b64 = cachedBase64 ?? (await loadImageBase64FromUrl(previewUrl, language))
      await runVisionAnalysis(b64, activeHint)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tx(language, 'No se pudo re-analizar la imagen actual.', 'Could not re-analyze the current image.'))
    }
  }

  const filteredSpecies = especies.filter(
    (sp) => catalogFilter === 'Todas' || sp.tipo === catalogFilter,
  )
  const sampleName = (name: string) => {
    const sample = SAMPLE_SPECIES_PHOTOS.find((item) => item.label === name)
    return sample ? speciesText(language, sample.id, 'name', name) : name
  }
  const resultSpecies = result
    ? especies.find((species) => species.nombre_cientifico === result.nombre_cientifico)
    : undefined
  const englishVisionText = (value: string | undefined) => (
    value && language === 'en' ? ENGLISH_VISION_TEXT[value] ?? value : value
  )
  const resultStatus = result && language === 'en'
    ? (resultSpecies
      ? speciesText(language, resultSpecies.id, 'status', result.estado)
      : ({
        'No pertenece al ecosistema del parque': 'Outside the park ecosystem',
        'Elemento identificado; fuera del catálogo de especies': 'Identified object; not a catalogued species',
        'Resultado no verificable': 'Unverified result',
        'Observación general sin identificación de especie': 'General observation; no species identified',
        'Ollama multimodal offline': 'Ollama multimodal offline',
      }[result.estado] ?? englishVisionText(result.estado)))
    : result?.estado
  const resultEcology = result && language === 'en' && resultSpecies
    ? speciesText(language, resultSpecies.id, 'ecology', result.rol_ecologico)
    : result?.rol_ecologico
  const resultConservation = result && language === 'en' && resultSpecies
    ? speciesText(language, resultSpecies.id, 'conservation', result.alerta_conservacion)
    : englishVisionText(result?.alerta_conservacion)

  return (
    <section className="flex flex-col gap-4" aria-label={tx(language, 'Lente de Páramo - Visión IA', 'Páramo AI Lens')}>
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
            alt={`${tx(language, 'Vista de especie', 'Species preview')}: ${sampleName(selectedLabel)}`}
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
                <span>{loading ? tx(language, 'Kumanday analizando…', 'Kumanday is analyzing…') : tx(language, 'Lente Kumanday • JPG/PNG/WebP', 'Kumanday Lens • JPG/PNG/WebP')}</span>
              </span>
              <span className="h-5 w-5 rounded-br-sm border-b-2 border-r-2 border-white/90" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-mountain-ink">{tx(language, 'Lente de Páramo (Visión IA)', 'Páramo Lens (AI vision)')}</h2>
              <p className="text-xs text-mountain-muted">
                {tx(language, 'Reconoce objetos y especies • JPG, PNG o WebP', 'Recognizes objects and species • JPG, PNG, or WebP')}
              </p>
            </div>
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
              <span>{tx(language, 'Tomar foto', 'Take photo')}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="min-h-[48px] rounded-full border border-mountain-border bg-mist px-3.5 py-2 text-xs font-semibold text-mountain-ink inline-flex items-center justify-center gap-1.5 hover:bg-moss-container/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ImageIcon className="h-4 w-4 shrink-0 text-frailejon" aria-hidden="true" />
              <span>{tx(language, 'Elegir imagen', 'Choose image')}</span>
            </button>
          </div>
          {previewUrl.startsWith('blob:') && (
            <button type="button" onClick={handleReanalyzeCurrent} disabled={loading} className="self-start text-xs font-semibold text-frailejon underline underline-offset-2 disabled:opacity-50">{tx(language, 'Volver a analizar esta foto', 'Re-analyze this photo')}</button>
          )}

          {/* Quick Test Samples */}
          <div className="flex flex-col gap-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-paramo-earth">
              {tx(language, 'O explora una muestra', 'Or try a sample')}
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
                    alt={sampleName(sample.label)}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-mountain-ink">
                      {sampleName(sample.label)}
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
            <span>{tx(language, 'Kumanday está analizando la captura…', 'Kumanday is analyzing the image…')}</span>
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
                {resultSpecies ? speciesText(language, resultSpecies.id, 'name', result.nombre_comun) : englishVisionText(result.nombre_comun)}
              </h3>
              <p className="text-xs italic font-medium text-mountain-muted">
                {englishVisionText(result.nombre_cientifico)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                result.en_pnnn || result.tipo === 'Objeto'
                  ? 'bg-moss-container text-frailejon-deep'
                  : 'bg-amber-surface text-on-amber-surface'
              }`}
            >
              {language === 'en' ? ({ Flora: 'Flora', Fauna: 'Fauna', Entorno: 'Environment', Objeto: 'Object', 'Fuera de Ecosistema': 'Outside ecosystem', 'Sin Confirmación': 'Unconfirmed' }[result.tipo] ?? result.tipo) : result.tipo} • {language === 'en' ? ({ 'Sin confirmación': 'Unconfirmed', 'Catálogo Offline Verificado': 'Verified offline catalog', 'Alta': 'High', 'Media': 'Medium', 'Baja': 'Low' }[result.confianza] ?? result.confianza) : result.confianza}
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
            <span>{resultStatus}</span>
          </div>

          <p className="text-sm leading-relaxed text-mountain-ink">{englishVisionText(result.descripcion_ia)}</p>

          <p className="text-xs leading-relaxed text-mountain-muted">
          {result.tipo === 'Objeto' ? englishVisionText(resultEcology) : <><strong className="font-semibold text-mountain-ink">{tx(language, 'Contexto ecológico:', 'Ecological context:')}</strong>{' '}{englishVisionText(resultEcology)}</>}
          </p>

          {resultConservation && <div
            role="status"
            className="rounded-xl border border-life-alert/30 bg-amber-surface p-3 flex items-start gap-2.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-life-alert mt-0.5" aria-hidden="true" />
            <p className="text-xs font-semibold leading-snug text-on-amber-surface">
              {resultConservation}
            </p>
          </div>}

          {result.enfoque_notice && (
            <p className="rounded-xl border border-frailejon/20 bg-moss-surface/60 px-3 py-2 text-xs leading-relaxed text-frailejon-deep">{englishVisionText(result.enfoque_notice)}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-mountain-border/50">
            <span className="font-mono text-[11px] text-mountain-muted">
              {result.fallback_used ? tx(language, 'Ficha local', 'Local record') : `${tx(language, 'IA local', 'Local AI')} · ${result.model}`}
            </span>
            <button
              type="button"
              onClick={() =>
                result.en_pnnn
                  ? onAskKumanday(
                      language === 'es'
                        ? `Explícame el rol ecológico y cómo proteger a ${result.nombre_comun} (${result.nombre_cientifico}).`
                        : `Explain the ecological role of ${result.nombre_comun} (${result.nombre_cientifico}) and how to protect it.`,
                      result.nombre_comun,
                    )
                  : onAskKumanday(
                      language === 'es'
                        ? '¿Qué fauna y flora nativa puedo encontrar en el PNN Los Nevados?'
                        : 'What native flora and fauna can I find in Los Nevados National Natural Park?',
                    )
              }
              className="min-h-[44px] rounded-full bg-moss-container px-3.5 text-xs font-semibold text-frailejon-deep inline-flex items-center gap-1.5 hover:bg-moss-surface cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {result.en_pnnn ? tx(language, 'Profundizar con Kumanday', 'Learn more with Kumanday') : tx(language, 'Ver especies del parque', 'View park species')}
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
                {tx(language, `Catálogo verificado (${especies.length} especies)`, `Verified catalog (${especies.length} species)`)}
              </h3>
              <p className="text-[11px] text-mountain-muted">
                {tx(language, 'Flora y fauna nativa incluida en el dispositivo', 'Native flora and fauna available on this device')}
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
                  {tab === 'Todas' ? tx(language, 'Todas', 'All') : tab}
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
                      <h4 className="text-xs font-bold text-mountain-ink">{speciesText(language, sp.id, 'name', sp.nombre_comun)}</h4>
                      <p className="text-[11px] italic text-mountain-muted">
                        {sp.nombre_cientifico}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-moss-container px-2 py-0.5 text-[10px] font-semibold text-frailejon-deep">
                      {sp.tipo}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-mountain-muted">{speciesText(language, sp.id, 'ecology', sp.rol_ecologico)}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-[10px] text-paramo-earth">
                      {sp.pisos.map((zone) => translateElevationZone(language, zone)).join(' • ')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onAskKumanday(
                          language === 'es'
                            ? `Cuéntame más sobre ${sp.nombre_comun} (${sp.nombre_cientifico}) y dónde habita.`
                            : `Tell me more about ${sp.nombre_comun} (${sp.nombre_cientifico}) and its habitat.`,
                          sp.nombre_comun,
                        )
                      }
                      className="min-h-[36px] rounded-full bg-white border border-frailejon/30 px-2.5 text-[11px] font-semibold text-frailejon hover:bg-moss-surface/60 cursor-pointer"
                    >
                      {tx(language, 'Consultar', 'Ask Kumanday')}
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
