import {
  AlertTriangle,
  CheckSquare,
  Phone,
  Radio,
  Satellite,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { Coordenadas, EmergenciaContacto, ProtocoloVida } from '../types/paramo'

interface SafetyModalProps {
  isOpen: boolean
  altitude: number
  coords: Coordenadas | null
  protocolos: Record<string, ProtocoloVida>
  directorio: EmergenciaContacto[]
  onClose: () => void
}

type ProtocolKey = 'soroche' | 'hipotermia' | 'volcanico'

const PROTOCOL_TABS: Array<{ key: ProtocolKey; label: string }> = [
  { key: 'soroche', label: 'Soroche' },
  { key: 'hipotermia', label: 'Hipotermia' },
  { key: 'volcanico', label: 'Volcán' },
]

export function SafetyModal({
  isOpen,
  altitude,
  coords,
  protocolos,
  directorio,
  onClose,
}: SafetyModalProps) {
  const [activeProtocol, setActiveProtocol] = useState<ProtocolKey>('soroche')
  const [checkedSymptoms, setCheckedSymptoms] = useState<string[]>([])
  const [sosStep, setSosStep] = useState<'idle' | 'confirm' | 'sent'>('idle')

  if (!isOpen) return null

  const currentProto = protocolos[activeProtocol] ?? protocolos.soroche

  function toggleSymptom(symptom: string) {
    setCheckedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((item) => item !== symptom) : [...prev, symptom],
    )
  }

  const latLabel = coords ? `${coords.lat}° N` : '4.8950° N'
  const lonLabel = coords ? `${Math.abs(coords.lon)}° W` : '75.3550° W'

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
                Protegiendo la Vida (SOS)
              </h2>
              <p className="font-mono text-[11px] text-mountain-muted tabular-nums">
                {latLabel}, {lonLabel} • {altitude.toLocaleString('es-CO')} m
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar módulo de emergencia"
            className="min-h-[44px] min-w-[44px] rounded-full border border-mountain-border bg-mist text-mountain-ink inline-flex items-center justify-center cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5">
          {/* Interactive Triage */}
          <section className="rounded-2xl border border-mountain-border bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-mountain-ink">Triaje Rápido de Síntomas</h3>
              <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-[11px] font-semibold text-on-amber-surface">
                Offline
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
                    {label}
                  </button>
                )
              })}
            </div>

            {currentProto && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-frailejon">{currentProto.titulo}</p>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-mountain-muted">
                    Marca los síntomas presentes:
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
                        <span>{symptom}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-xl border border-life-alert/40 bg-amber-surface p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-amber-surface">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-life-alert" />
                    <span>
                      {checkedSymptoms.length > 0
                        ? `Acción inmediata (${checkedSymptoms.length} síntoma(s) marcado(s))`
                        : 'Protocolo de acción inmediata'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-on-amber-surface">
                    {currentProto.accion_inmediata}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Satellite SOS Card */}
          <section className="rounded-2xl border border-sos-red/30 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Satellite className="h-5 w-5 text-sos-red" aria-hidden="true" />
              <h3 className="text-sm font-bold text-mountain-ink">Baliza SOS Satelital</h3>
            </div>
            <p className="text-xs leading-relaxed text-mountain-muted">
              Prepara tu última coordenada GPS y altitud para envío de emergencia o reporte por radio
              VHF sin señal celular.
            </p>

            {sosStep === 'idle' && (
              <button
                type="button"
                onClick={() => setSosStep('confirm')}
                className="min-h-[52px] w-full rounded-full bg-sos-red px-4 text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
              >
                <Satellite className="h-5 w-5" aria-hidden="true" />
                <span>Activar Alerta SOS Satelital</span>
              </button>
            )}

            {sosStep === 'confirm' && (
              <div
                role="alert"
                className="rounded-xl border border-sos-red/30 bg-sos-surface p-3 flex flex-col gap-2.5"
              >
                <p className="text-xs font-semibold text-on-sos-surface">
                  Confirma el envío de baliza de auxilio desde {latLabel}, {lonLabel} (
                  {altitude.toLocaleString('es-CO')} m s.n.m.).
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSosStep('sent')}
                    className="min-h-[44px] flex-1 rounded-full bg-sos-red px-3 text-xs font-bold text-white cursor-pointer"
                  >
                    Confirmar envío
                  </button>
                  <button
                    type="button"
                    onClick={() => setSosStep('idle')}
                    className="min-h-[44px] rounded-full border border-mountain-border bg-white px-4 text-xs font-semibold text-mountain-ink cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {sosStep === 'sent' && (
              <div
                role="status"
                className="rounded-xl border border-sos-red/30 bg-sos-surface p-3 text-xs font-semibold text-on-sos-surface"
              >
                Baliza SOS en cola ({latLabel}, {lonLabel} • {altitude.toLocaleString('es-CO')} m).
                Permanece en punto visible, abrígate y desciende si es seguro.
              </div>
            )}
          </section>

          {/* Offline Emergency Directory */}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold text-mountain-ink">
              Directorio de Emergencias (Caldas)
            </h3>
            {directorio.map((contact) => (
              <article
                key={contact.id}
                className="rounded-2xl border border-mountain-border bg-white p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-mountain-ink">{contact.entidad}</h4>
                    <p className="text-[11px] text-mountain-muted">{contact.descripcion}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-moss-container px-2.5 py-0.5 font-mono text-[11px] font-semibold text-frailejon-deep">
                    <Radio className="h-3 w-3" aria-hidden="true" />
                    <span>{contact.canal}</span>
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
                    <span>Llamar</span>
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
