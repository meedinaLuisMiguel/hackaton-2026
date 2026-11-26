import { AlertTriangle, LocateFixed, Mountain, ShieldAlert, Thermometer } from 'lucide-react'
import { useState } from 'react'
import type { Coordenadas, RadarResponse } from '../types/paramo'

interface GpsRadarProps {
  altitude: number
  radar: RadarResponse
  coords: Coordenadas | null
  onAltitudeChange: (alt: number) => void
  onCoordsChange: (coords: Coordenadas | null) => void
  onOpenSafety: () => void
}

const RISK_STYLES: Record<RadarResponse['riesgo_soroche'], string> = {
  Bajo: 'bg-moss-surface text-frailejon-deep border-frailejon/20',
  Moderado: 'bg-amber-surface text-on-amber-surface border-life-alert/30',
  Alto: 'bg-amber-surface text-on-amber-surface border-life-alert/40',
  'Muy Alto': 'bg-sos-surface text-on-sos-surface border-sos-red/30',
}

export function GpsRadar({
  altitude,
  radar,
  coords,
  onAltitudeChange,
  onCoordsChange,
  onOpenSafety,
}: GpsRadarProps) {
  const [gpsStatus, setGpsStatus] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  function handleRequestGps() {
    if (!('geolocation' in navigator)) {
      setGpsStatus('GPS no disponible en este navegador. Usa el control de altitud.')
      return
    }
    setLocating(true)
    setGpsStatus('Buscando satélites GNSS...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        const nextCoords: Coordenadas = {
          lat: Number(position.coords.latitude.toFixed(4)),
          lon: Number(position.coords.longitude.toFixed(4)),
        }
        onCoordsChange(nextCoords)
        if (typeof position.coords.altitude === 'number' && position.coords.altitude > 500) {
          const clamped = Math.min(4800, Math.max(2300, Math.round(position.coords.altitude)))
          onAltitudeChange(clamped)
          setGpsStatus(`GPS bloqueado • Altitud real ${clamped.toLocaleString('es-CO')} m`)
        } else {
          setGpsStatus(
            `Coordenadas ${nextCoords.lat}°, ${nextCoords.lon}° • Ajusta altitud si estás en escritorio`,
          )
        }
      },
      () => {
        setLocating(false)
        setGpsStatus('Permiso de ubicación denegado. Usa el simulador de altitud.')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    )
  }

  return (
    <section aria-label="Radar GPS por altitud">
      <article className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-md flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-moss-container px-2.5 py-0.5 text-[11px] font-semibold text-frailejon-deep">
              <Mountain className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Radar de altitud</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-mountain-ink tabular-nums">
                {altitude.toLocaleString('es-CO')}
              </span>
              <span className="font-mono text-sm font-medium text-paramo-earth">m s.n.m.</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-frailejon">
              {radar.piso_termico.piso}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${RISK_STYLES[radar.riesgo_soroche]}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Soroche: {radar.riesgo_soroche}</span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-mountain-muted tabular-nums">
              <Thermometer className="h-3.5 w-3.5 text-paramo-earth" aria-hidden="true" />
              <span>{radar.piso_termico.temp}</span>
            </span>
          </div>
        </div>

        {/* Altitude Slider for Field / Hackathon Demo */}
        <div className="rounded-xl border border-mountain-border/60 bg-mist/80 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-mountain-muted">
            <label htmlFor="altitude-range">Altitud de referencia · simulada</label>
            <span className="font-mono tabular-nums text-frailejon">
              {radar.piso_termico.min_m.toLocaleString('es-CO')}–
              {radar.piso_termico.max_m.toLocaleString('es-CO')} m
            </span>
          </div>
          <input
            id="altitude-range"
            type="range"
            min={2300}
            max={4800}
            step={50}
            value={altitude}
            onChange={(e) => onAltitudeChange(Number(e.target.value))}
            className="altitude-slider w-full"
            data-scroll-gesture-ignore
            aria-valuetext={`${altitude.toLocaleString('es-CO')} metros sobre el nivel del mar`}
          />
          <div className="flex justify-between font-mono text-[11px] text-mountain-muted tabular-nums">
            <span>2.300 m</span>
            <span>3.800 m</span>
            <span>4.800 m</span>
          </div>
        </div>

        <details className="rounded-xl bg-mist/70 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-mountain-muted">Sobre este ecosistema</summary>
          <p className="pt-2 text-sm leading-relaxed text-mountain-muted">{radar.piso_termico.descripcion}</p>
        </details>

        {/* Probable Species */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-paramo-earth">Especies posibles</span>
          <div className="flex flex-wrap gap-1.5">
            {radar.especies_probables.slice(0, 4).map((sp) => (
              <span
                key={sp.id}
                className="inline-flex items-center gap-1 rounded-full border border-frailejon/20 bg-moss-surface px-3 py-1 text-xs font-semibold text-frailejon-deep"
              >
                <span>{sp.nombre_comun}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Safety Advice Strip */}
        <div className="rounded-xl border border-life-alert/30 bg-amber-surface p-3 flex items-start justify-between gap-2.5">
          <p className="line-clamp-2 text-xs leading-relaxed font-medium text-on-amber-surface">{radar.recomendacion_seguridad}</p>
          <button
            type="button"
            onClick={onOpenSafety}
            className="min-h-[44px] shrink-0 rounded-full bg-life-alert px-3 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1 hover:opacity-90 cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Triaje</span>
          </button>
        </div>

        {/* Real GPS Button */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleRequestGps}
            disabled={locating}
            className="min-h-[48px] w-full rounded-full bg-frailejon px-4 py-2.5 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors hover:bg-frailejon-deep disabled:opacity-60 cursor-pointer"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            <span>{locating ? 'Consultando GNSS...' : 'Sincronizar GPS del Dispositivo'}</span>
          </button>
          {(gpsStatus || coords) && (
            <p className="text-center font-mono text-[11px] text-mountain-muted tabular-nums">
              {gpsStatus ??
                `Última posición: ${coords?.lat}° N, ${Math.abs(coords?.lon ?? 0)}° W`}
            </p>
          )}
        </div>
      </article>
    </section>
  )
}
