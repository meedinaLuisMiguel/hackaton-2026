import {
  AlertTriangle,
  CheckSquare,
  Copy,
  LocateFixed,
  Phone,
  Radio,
  Satellite,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { tx, type Language } from '../i18n'
import type { Coordenadas, EmergenciaContacto, ProtocoloVida } from '../types/paramo'

interface SafetyModalProps {
  isOpen: boolean
  language: Language
  coords: Coordenadas | null
  onCoordsChange: (coords: Coordenadas | null) => void
  protocolos: Record<string, ProtocoloVida>
  directorio: EmergenciaContacto[]
  onClose: () => void
}

type ProtocolKey = 'soroche' | 'hipotermia' | 'volcanico'
type GpsMessageKey =
  | 'insecure'
  | 'unsupported'
  | 'requesting'
  | 'received'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'copied'
  | 'copy-failed'

const PROTOCOL_TABS: Array<{ key: ProtocolKey; label: string }> = [
  { key: 'soroche', label: 'Soroche' },
  { key: 'hipotermia', label: 'Hipotermia' },
  { key: 'volcanico', label: 'Volcán' },
]

const ENGLISH_PROTOCOLS: Record<ProtocolKey, { title: string; symptoms: Record<string, string>; action: string }> = {
  soroche: {
    title: 'Acute Mountain Sickness (soroche) protocol',
    symptoms: {
      'Dolor de cabeza pulsátil': 'Throbbing headache',
      'Náuseas o vómito': 'Nausea or vomiting',
      'Mareo intenso': 'Severe dizziness',
      'Fatiga extrema o falta de aire en reposo': 'Extreme fatigue or shortness of breath at rest',
    },
    action: '1. Stop ascending immediately. 2. Drink small sips of water. 3. Descend at least 500 metres with someone accompanying you. 4. Notify the guide or the Brisas/Potosí checkpoint.',
  },
  hipotermia: {
    title: 'Hypothermia prevention protocol',
    symptoms: {
      'Temblores incontrolables': 'Uncontrollable shivering',
      'Torpeza en manos': 'Clumsy hands',
      'Habla arrastrada o confusión': 'Slurred speech or confusion',
    },
    action: '1. Get out of the wind. 2. Replace wet clothes with dry layers. 3. Give warm, sugary drinks if the person is conscious. 4. Descend immediately.',
  },
  volcanico: {
    title: 'Volcanic safety protocol (Kumanday / Ruiz)',
    symptoms: {
      'Olor fuerte a azufre o irritación ocular': 'Strong sulfur smell or eye irritation',
      'Caída repentina de ceniza volcánica': 'Sudden volcanic ashfall',
      'Sismo sentido o instrucción de guardaparques': 'Felt earthquake or instruction from park staff',
    },
    action: '1. Cover your nose and mouth with a damp cloth or mask. 2. Move away from ravines and river channels because of flow hazards. 3. Evacuate to nearby high ground, following only your authorized guide and evacuation signs.',
  },
}

const ENGLISH_CONTACTS: Record<string, { name: string; description: string }> = {
  'pnnn-brisas': { name: 'Los Nevados National Natural Park — Brisas sector', description: 'High-mountain park rangers and access control' },
  'cruz-roja-caldas': { name: 'Caldas Red Cross', description: 'Mountain rescue and pre-hospital care' },
  'defensa-civil-villamaria': { name: 'Civil Defense — Villamaría', description: 'Search and evacuation in the páramo' },
}

const GPS_MESSAGES: Record<GpsMessageKey, { es: string; en: string }> = {
  insecure: { es: 'La ubicación requiere HTTPS o abrir la app en localhost.', en: 'Location access requires HTTPS or opening the app on localhost.' },
  unsupported: { es: 'Este navegador no ofrece geolocalización.', en: 'This browser does not support geolocation.' },
  requesting: { es: 'Solicitando ubicación al dispositivo. En teléfonos con GPS puede tardar hasta 2 minutos sin Wi‑Fi; prueba al aire libre.', en: 'Requesting location from your device. Phones with GPS may take up to 2 minutes without Wi-Fi; try outdoors.' },
  received: { es: 'Ubicación recibida. La precisión depende de la señal del dispositivo.', en: 'Location received. Accuracy depends on your device signal.' },
  denied: { es: 'Permiso de ubicación denegado. Puedes habilitarlo en la configuración del navegador.', en: 'Location permission denied. You can enable it in your browser settings.' },
  unavailable: { es: 'El dispositivo no pudo determinar la ubicación. En un teléfono, inténtalo al aire libre; en un PC, puede requerir Wi‑Fi o un receptor GPS.', en: 'Your device could not determine the location. Try outdoors on a phone; a PC may need Wi-Fi or a GPS receiver.' },
  timeout: { es: 'No se determinó la ubicación en 2 minutos. En un teléfono con GPS, prueba al aire libre; en un PC, puede requerir Wi‑Fi o un receptor GPS.', en: 'Location was not determined within 2 minutes. On a phone with GPS, try outdoors; a PC may need Wi-Fi or a GPS receiver.' },
  copied: { es: 'Coordenadas copiadas.', en: 'Coordinates copied.' },
  'copy-failed': { es: 'No se pudieron copiar. Mantén pulsadas las coordenadas para seleccionarlas.', en: 'Could not copy. Press and hold the coordinates to select them.' },
}

export function SafetyModal({
  isOpen,
  language,
  coords,
  onCoordsChange,
  protocolos,
  directorio,
  onClose,
}: SafetyModalProps) {
  const [activeProtocol, setActiveProtocol] = useState<ProtocolKey>('soroche')
  const [checkedByProtocol, setCheckedByProtocol] = useState<Record<ProtocolKey, string[]>>({
    soroche: [],
    hipotermia: [],
    volcanico: [],
  })
  const [locating, setLocating] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsTimestamp, setGpsTimestamp] = useState<number | null>(null)
  const [gpsMessage, setGpsMessage] = useState<GpsMessageKey | null>(null)

  if (!isOpen) return null

  const currentProto = protocolos[activeProtocol] ?? protocolos.soroche
  const checkedSymptoms = checkedByProtocol[activeProtocol] ?? []

  function toggleSymptom(symptom: string) {
    setCheckedByProtocol((prev) => {
      const current = prev[activeProtocol] ?? []
      const next = current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom]
      return { ...prev, [activeProtocol]: next }
    })
  }

  function handleClose() {
    onClose()
  }

  function requestGpsLocation() {
    onCoordsChange(null)
    setGpsAccuracy(null)
    setGpsTimestamp(null)
    if (!window.isSecureContext) {
      setGpsMessage('insecure')
      return
    }
    if (!navigator.geolocation) {
      setGpsMessage('unsupported')
      return
    }
    setLocating(true)
    setGpsMessage('requesting')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onCoordsChange({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setGpsAccuracy(position.coords.accuracy)
        setGpsTimestamp(position.timestamp)
        setGpsMessage('received')
        setLocating(false)
      },
      (error) => {
        const message: GpsMessageKey = error.code === error.PERMISSION_DENIED
          ? 'denied'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'unavailable'
            : 'timeout'
        setGpsMessage(message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 120000, maximumAge: 0 },
    )
  }

  const coordinateLabel = coords
    ? `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`
    : tx(language, 'Ubicación no obtenida', 'Location not obtained')

  async function copyCoordinates() {
    if (!coords) return
    try {
      await navigator.clipboard.writeText(`${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`)
      setGpsMessage('copied')
    } catch {
      setGpsMessage('copy-failed')
    }
  }

  const translatedProtocol = ENGLISH_PROTOCOLS[activeProtocol]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-mountain-ink/60 backdrop-blur-xs sm:items-center"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-mist shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-mountain-border bg-white px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sos-surface text-on-sos-surface">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="safety-modal-title" className="text-base font-bold text-mountain-ink">
                {tx(language, 'Protegiendo la Vida · SOS', 'Protecting Life · SOS')}
              </h2>
              <p className="font-mono text-[11px] text-mountain-muted tabular-nums">
                {coordinateLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={tx(language, 'Cerrar módulo de emergencia', 'Close emergency information')}
            className="min-h-[44px] min-w-[44px] rounded-full border border-mountain-border bg-mist text-mountain-ink inline-flex items-center justify-center cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5">
          <div className="rounded-2xl border border-sos-red/25 bg-sos-surface p-4 text-sm leading-relaxed text-on-sos-surface"><strong>{tx(language, 'Orientación informativa.', 'For information only.')}</strong> {tx(language, 'Esta pantalla no envía una alerta ni confirma condiciones actuales. Si hay peligro o síntomas, avisa de inmediato al guía experto autorizado y sigue sus instrucciones. No te separes del grupo.', 'This screen does not send an alert or confirm current conditions. If there is danger or someone has symptoms, notify the authorized guide immediately and follow their instructions. Stay with your group.')}</div>
          {/* Interactive Triage */}
          <section className="rounded-2xl border border-mountain-border bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-mountain-ink">{tx(language, 'Información para reconocer señales', 'Recognizing warning signs')}</h3>
              <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-[11px] font-semibold text-on-amber-surface">
                {tx(language, 'Sin conexión', 'Offline')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {PROTOCOL_TABS.map(({ key, label }) => {
                const active = activeProtocol === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveProtocol(key)}
                    className={`min-h-[44px] rounded-full px-2 text-xs font-semibold cursor-pointer ${
                      active
                        ? 'bg-frailejon text-white'
                        : 'bg-mist text-mountain-ink border border-mountain-border'
                    }`}
                  >
                    {language === 'en' ? ({ soroche: 'Altitude sickness', hipotermia: 'Hypothermia', volcanico: 'Volcano' }[key]) : label}
                  </button>
                )
              })}
            </div>

            {currentProto && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-frailejon">{language === 'en' ? translatedProtocol.title : currentProto.titulo}</p>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-mountain-muted">
                    {tx(language, 'Señales descritas en la ficha informativa (no es diagnóstico):', 'Signs described in this information sheet (not a diagnosis):')}
                  </span>
                  {currentProto.sintomas.map((symptom) => {
                    const checked = checkedSymptoms.includes(symptom)
                    return (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => toggleSymptom(symptom)}
                        className={`min-h-[44px] w-full rounded-xl border px-3 py-2 text-left text-xs font-medium flex items-center gap-2.5 cursor-pointer ${
                          checked
                            ? 'border-life-alert bg-amber-surface text-on-amber-surface font-semibold'
                            : 'border-mountain-border bg-mist/60 text-mountain-ink'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-life-alert" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-mountain-muted" />
                        )}
                        <span>{language === 'en' ? translatedProtocol.symptoms[symptom] ?? symptom : symptom}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-xl border border-life-alert/40 bg-amber-surface p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-amber-surface">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-life-alert" />
                    <span>
                      {checkedSymptoms.length > 0
                        ? tx(language, `Acción inmediata (${checkedSymptoms.length} síntoma(s) marcado(s))`, `Immediate action (${checkedSymptoms.length} symptom(s) selected)`)
                        : tx(language, 'Protocolo de acción inmediata', 'Immediate action protocol')}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-on-amber-surface">
                    {language === 'en' ? translatedProtocol.action : currentProto.accion_inmediata}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Satellite SOS Card */}
          <section className="rounded-2xl border border-sos-red/30 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Satellite className="h-5 w-5 text-sos-red" aria-hidden="true" />
              <h3 className="text-sm font-bold text-mountain-ink">{tx(language, 'Qué hacer para pedir ayuda', 'How to ask for help')}</h3>
            </div>
            <p className="text-xs leading-relaxed text-mountain-muted">
              {tx(language, 'Esta aplicación no tiene conexión satelital ni transmite una baliza. La ubicación depende del dispositivo: un teléfono con GPS puede obtener coordenadas sin Wi‑Fi, sobre todo al aire libre; un PC suele necesitar Wi‑Fi o un receptor GPS. Compartirlas sí requiere comunicación. Si es útil, compártelas con el guía autorizado o el personal del parque y solicita que activen el protocolo de emergencia.', 'This app has no satellite connection and cannot transmit an SOS beacon. Location depends on the device: a phone with GPS can obtain coordinates without Wi-Fi, especially outdoors; a PC usually needs Wi-Fi or a GPS receiver. Sharing them does require communication. If useful, share them with the authorized guide or park staff and ask them to activate the emergency protocol.')}
            </p>

            <button
              type="button"
              onClick={requestGpsLocation}
              disabled={locating}
              className="min-h-[52px] w-full rounded-full bg-sos-red px-4 text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer"
            >
              <LocateFixed className="h-5 w-5" aria-hidden="true" />
              <span>{locating ? tx(language, 'Buscando ubicación…', 'Finding location…') : tx(language, 'Obtener ubicación del dispositivo', 'Get device location')}</span>
            </button>
            {coords && (
              <div className="rounded-xl border border-sos-red/30 bg-sos-surface p-3 text-center">
                <p className="font-mono text-sm font-bold tabular-nums text-on-sos-surface" aria-label={tx(language, 'Coordenadas en grados decimales', 'Coordinates in decimal degrees')}>{coordinateLabel}</p>
                {gpsAccuracy !== null && <p className="mt-1 text-xs text-on-sos-surface">{tx(language, `Precisión estimada: ±${Math.round(gpsAccuracy)} m`, `Estimated accuracy: ±${Math.round(gpsAccuracy)} m`)}</p>}
                {gpsTimestamp !== null && <p className="mt-1 text-xs text-on-sos-surface">{tx(language, 'Obtenidas', 'Obtained')} {new Date(gpsTimestamp).toLocaleTimeString(language === 'en' ? 'en-US' : 'es-CO')}</p>}
                <button type="button" onClick={() => void copyCoordinates()} className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-sos-red">
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />{tx(language, 'Copiar coordenadas', 'Copy coordinates')}
                </button>
              </div>
            )}
            {gpsMessage && <p role="status" className="text-center text-xs text-mountain-muted">{GPS_MESSAGES[gpsMessage]?.[language] ?? tx(language, 'Estado de ubicación actualizado.', 'Location status updated.')}</p>}
          </section>

          {/* Offline Emergency Directory */}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold text-mountain-ink">
              {tx(language, 'Directorio de Emergencias (Caldas)', 'Emergency directory (Caldas)')}
            </h3>
            {directorio.map((contact) => (
              <article
                key={contact.id}
                className="rounded-2xl border border-mountain-border bg-white p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-mountain-ink">{language === 'en' ? ENGLISH_CONTACTS[contact.id]?.name ?? contact.entidad : contact.entidad}</h4>
                    <p className="text-[11px] text-mountain-muted">{language === 'en' ? ENGLISH_CONTACTS[contact.id]?.description ?? contact.descripcion : contact.descripcion}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-moss-container px-2.5 py-0.5 font-mono text-[11px] font-semibold text-frailejon-deep">
                    <Radio className="h-3 w-3" aria-hidden="true" />
                    <span>{language === 'en' ? contact.canal.replace(/^Línea /, 'Line ') : contact.canal}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-mountain-border/50 pt-2">
                  <span className="font-mono text-xs font-medium text-paramo-earth tabular-nums">
                    {contact.telefono_display}
                  </span>
                  <a
                    href={contact.telefono_uri}
                    className="min-h-[44px] rounded-full bg-frailejon px-4 text-xs font-semibold text-white inline-flex items-center gap-1.5 hover:bg-frailejon-deep"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{tx(language, 'Llamar', 'Call')}</span>
                  </a>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
