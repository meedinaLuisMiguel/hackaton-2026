import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Download,
  Edit3,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { BitacoraCategoria, BitacoraEntry, Ruta } from '../types/paramo'

interface TrailCatalogProps {
  rutas: Ruta[]
  altitude: number
  downloadedIds: string[]
  onToggleDownload: (id: string) => void
  onAskAboutRuta: (ruta: Ruta) => void
  bitacora: BitacoraEntry[]
  onAddBitacora: (entry: BitacoraEntry) => void
}

const CATEGORIES: BitacoraCategoria[] = ['Fauna', 'Flora', 'Clima']

export function TrailCatalog({
  rutas,
  altitude,
  downloadedIds,
  onToggleDownload,
  onAskAboutRuta,
  bitacora,
  onAddBitacora,
}: TrailCatalogProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(rutas[0]?.id ?? null)

  const [logFormOpen, setLogFormOpen] = useState(false)
  const [categoria, setCategoria] = useState<BitacoraCategoria>('Fauna')
  const [nota, setNota] = useState('')

  const filteredRutas = rutas.filter((r) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (
      r.nombre.toLowerCase().includes(q) ||
      r.sector.toLowerCase().includes(q) ||
      r.dificultad.toLowerCase().includes(q)
    )
  })

  function handleSubmitLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const clean = nota.trim()
    if (!clean) return
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    onAddBitacora({
      id: `log-${Date.now()}`,
      categoria,
      titulo: `Observación de ${categoria.toLowerCase()} en ruta`,
      nota: clean,
      altitud_m: altitude,
      fecha_label: `Hoy ${hh}:${mm}`,
    })
    setNota('')
    setLogFormOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Official Trails Section */}
      <section className="flex flex-col gap-3" aria-labelledby="catalog-heading">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="catalog-heading" className="text-base font-bold text-mountain-ink">
              Corredores Oficiales PNNN
            </h2>
            <p className="font-mono text-xs text-mountain-muted">
              {rutas.length} rutas verificadas • Paquete offline
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Buscar o filtrar senderos"
            aria-expanded={searchOpen}
            className="min-h-[48px] min-w-[48px] rounded-full border border-mountain-border bg-white text-mountain-ink inline-flex items-center justify-center hover:bg-mist cursor-pointer"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {searchOpen && (
          <div>
            <label htmlFor="trail-search" className="sr-only">
              Filtrar senderos
            </label>
            <input
              id="trail-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, sector o dificultad..."
              className="min-h-[48px] w-full rounded-full border border-mountain-border bg-white px-4 text-sm text-mountain-ink placeholder:text-mountain-muted/70 focus:border-frailejon focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filteredRutas.map((ruta) => {
            const isDownloaded = downloadedIds.includes(ruta.id)
            const isExpanded = expandedId === ruta.id
            const isHighDifficulty = ruta.dificultad.toLowerCase().includes('alta')

            return (
              <article
                key={ruta.id}
                className="rounded-2xl border border-mountain-border/80 bg-white/90 p-4 shadow-sm backdrop-blur-md flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-base font-bold leading-snug text-mountain-ink">
                      {ruta.nombre}
                    </h3>
                    <p className="text-xs font-medium text-mountain-muted inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-paramo-earth shrink-0" aria-hidden="true" />
                      <span>{ruta.sector}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isHighDifficulty
                            ? 'bg-amber-surface text-on-amber-surface'
                            : 'bg-moss-container text-frailejon-deep'
                        }`}
                      >
                        {ruta.dificultad}
                      </span>
                      <span className="font-mono text-xs text-mountain-muted tabular-nums">
                        {ruta.altitud_rango}
                      </span>
                      <span className="font-mono text-xs font-medium text-paramo-earth tabular-nums">
                        • {ruta.distancia_km} km
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mountain-border/50 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : ruta.id)}
                    className="min-h-[44px] rounded-full px-3 text-xs font-semibold text-frailejon inline-flex items-center gap-1 hover:bg-moss-surface/60 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Ocultar estaciones' : 'Ver estaciones y reglas'}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleDownload(ruta.id)}
                    className={`min-h-[44px] rounded-full px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isDownloaded
                        ? 'bg-moss-surface text-frailejon-deep border border-frailejon/20'
                        : 'bg-white text-mountain-ink border border-mountain-border hover:bg-mist'
                    }`}
                  >
                    {isDownloaded ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Descargado ✓</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span>Descargar Pack</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded Stations & Mandatory Rules */}
                {isExpanded && (
                  <div className="rounded-xl bg-mist p-3.5 flex flex-col gap-3 border border-mountain-border/60">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-frailejon">
                        Estaciones del recorrido
                      </h4>
                      <ol className="mt-2 flex flex-col gap-2">
                        {ruta.estaciones.map((st, idx) => (
                          <li key={st} className="flex items-start gap-2 text-xs leading-relaxed text-mountain-ink">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-frailejon text-[11px] font-bold text-white">
                              {idx + 1}
                            </span>
                            <span>{st}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-lg border border-life-alert/30 bg-amber-surface p-2.5 flex items-start gap-2">
                      <ShieldCheck
                        className="h-4 w-4 shrink-0 text-life-alert mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-medium text-on-amber-surface">
                        <strong className="font-bold">Reglas obligatorias:</strong> {ruta.reglas}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAskAboutRuta(ruta)}
                      className="min-h-[44px] w-full rounded-full border border-frailejon/30 bg-white px-4 text-xs font-semibold text-frailejon inline-flex items-center justify-center gap-1.5 hover:bg-moss-surface/50 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      <span>Preguntar al Guía sobre esta ruta</span>
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {/* Offline Field Log (Bitácora) */}
      <section className="flex flex-col gap-3" aria-labelledby="bitacora-heading">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="bitacora-heading" className="text-base font-bold text-mountain-ink">
              Bitácora Offline en Ruta
            </h2>
            <p className="font-mono text-xs text-mountain-muted tabular-nums">
              Guardado local • {bitacora.length} registros
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLogFormOpen((v) => !v)}
            aria-expanded={logFormOpen}
            className="min-h-[48px] rounded-full bg-frailejon px-4 py-2 text-xs font-semibold text-white inline-flex items-center gap-1.5 hover:bg-frailejon-deep cursor-pointer"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            <span>Nueva nota</span>
          </button>
        </div>

        {logFormOpen && (
          <form
            onSubmit={handleSubmitLog}
            className="rounded-2xl border border-mountain-border bg-white p-4 shadow-sm flex flex-col gap-3"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-frailejon">Registrar observación</span>
              <span className="font-mono text-paramo-earth tabular-nums">
                GPS {altitude.toLocaleString('es-CO')} m s.n.m.
              </span>
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
              {CATEGORIES.map((cat) => {
                const active = categoria === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoria(cat)}
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-full px-3.5 text-xs font-semibold cursor-pointer ${
                      active
                        ? 'bg-moss-surface text-frailejon-deep border border-frailejon/30'
                        : 'bg-mist text-mountain-ink border border-mountain-border'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>

            <label htmlFor="bitacora-nota" className="sr-only">
              Detalle de la observación
            </label>
            <textarea
              id="bitacora-nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Avistamiento de cóndor o neblina densa en el sendero..."
              className="w-full rounded-xl border border-mountain-border bg-mist/60 p-3 text-sm text-mountain-ink placeholder:text-mountain-muted/70 focus:border-frailejon focus:outline-none"
            />

            <button
              type="submit"
              className="min-h-[48px] w-full rounded-full bg-frailejon px-4 text-sm font-semibold text-white hover:bg-frailejon-deep cursor-pointer"
            >
              Guardar en Bitácora Offline
            </button>
          </form>
        )}

        <div className="flex flex-col gap-2.5">
          {bitacora.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-mountain-border/80 bg-white/90 p-3.5 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    entry.categoria === 'Clima'
                      ? 'bg-amber-surface text-on-amber-surface'
                      : 'bg-moss-container text-frailejon-deep'
                  }`}
                >
                  {entry.categoria}
                </span>
                <span className="font-mono text-[11px] text-mountain-muted tabular-nums">
                  {entry.altitud_m.toLocaleString('es-CO')} m • {entry.fecha_label}
                </span>
              </div>
              <h3 className="text-sm font-bold text-mountain-ink">{entry.titulo}</h3>
              <p className="text-xs leading-relaxed text-mountain-muted">{entry.nota}</p>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-frailejon">
                <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Guardado offline en dispositivo</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
