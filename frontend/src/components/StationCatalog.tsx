import { ArrowUpRight, BookOpen, Droplets, Mountain, Wind } from 'lucide-react'
import { useState } from 'react'
import { tx, type Language } from '../i18n'
import type { Estacion } from '../types/paramo'

interface StationCatalogProps { estaciones: Estacion[]; language: Language; onAsk: (prompt: string) => void }
const ICONS = [Mountain, Droplets, Wind, Mountain, BookOpen]

const ENGLISH_STATIONS: Record<string, { altitude: string; theme: string; summary: string; experience: string }> = {
  brisas: {
    altitude: 'Trail entrance',
    theme: 'Gateway to the páramo',
    summary: 'Brisas introduces the northern route and its importance for water. The supplied sources do not specify an elevation for this station.',
    experience: 'Begin by observing the landscape and connecting the route with the water that originates in the high mountains.',
  },
  aguacerales: {
    altitude: '4,160 m a.s.l.',
    theme: 'Water captured by the páramo',
    summary: 'Vegetation, mosses, and soil all contribute to capturing and regulating water.',
    experience: 'Observe the mist, frailejones, and trickles of water. Stay on the trail to protect the vegetation.',
  },
  arenales: {
    altitude: '4,290 m a.s.l.',
    theme: 'Dunes, wind, and memory',
    summary: 'Wind shapes sand deposits in a landscape that carries memories of the history of skiing.',
    experience: 'View the dunes from the trail and avoid stepping on them: footprints can remain for months.',
  },
  lunares: {
    altitude: '4,350 m a.s.l.',
    theme: 'Rocks record change',
    summary: 'Freeze-thaw weathering fractures rock when water in its cracks freezes; oxidation can produce reddish tones.',
    experience: 'Look for fractures and color changes without moving or taking rocks.',
  },
  'valle-tumbas': {
    altitude: '4,460 m a.s.l.',
    theme: 'Cultural memory and care',
    summary: 'The landscape holds stories and names passed down through oral tradition. Climbing beyond the authorized limit is restricted.',
    experience: 'Listen to the stories respectfully. Ask an authorized guide to confirm access, weather, or volcanic conditions.',
  },
}

export function StationCatalog({ estaciones, language, onAsk }: StationCatalogProps) {
  const [active, setActive] = useState(0)
  const station = estaciones[active]
  const englishNames: Record<string, string> = { Brisas: 'Brisas', Aguacerales: 'Aguacerales', Arenales: 'Arenales', 'Lunares / Valle Lunar': 'Lunares / Moon Valley', 'Valle de las Tumbas': 'Valley of the Tombs' }
  const englishStation = station ? ENGLISH_STATIONS[station.id] : undefined
  return <section className="flex flex-col gap-4" aria-label={language === 'es' ? 'Estaciones del recorrido norte' : 'Northern route stations'}>
    <div className="rounded-[2rem] bg-gradient-to-br from-[#173e37] via-[#31584b] to-[#a9a078] p-5 text-white shadow-xl md:p-8">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-white/75">{tx(language, 'PNN Los Nevados · Zona norte', 'Los Nevados National Natural Park · Northern area')}</p>
      <h2 className="mt-2 text-2xl font-black md:text-4xl">{language === 'es' ? 'Cinco paradas, un páramo vivo' : 'Five stops, one living páramo'}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">{language === 'es' ? 'Explora el agua, el viento, la roca y la memoria. Elige una de las cinco estaciones para conocerla con fuentes UTON.' : 'Explore the story of water, wind, rock, and memory. Choose one of the five stops to learn from UTON sources.'}</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-5" role="tablist" aria-label={tx(language, 'Estaciones', 'Stations')}>
        {estaciones.map((item, index) => {
          const Icon = ICONS[index] ?? Mountain
          const name = language === 'en' ? englishNames[item.nombre] ?? item.nombre : item.nombre.split(' / ')[0]
          const theme = language === 'en' ? ENGLISH_STATIONS[item.id]?.theme ?? item.tema : item.tema
          return <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
            className={`station-card ${index === 4 ? 'station-card-wide' : ''}`}
          >
            <span className="station-card-top">
              <span className="station-card-index">{String(index + 1).padStart(2, '0')}</span>
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="station-card-copy">
              <span className="station-card-name">{name}</span>
              <span className="station-card-theme">{theme}</span>
            </span>
          </button>
        })}
      </div>
    </div>
    {station && (() => { const Icon = ICONS[active] ?? Mountain; return <article key={station.id} className="overflow-hidden rounded-[2rem] border border-mountain-border bg-white shadow-lg">
      <div className="flex min-h-44 items-end justify-between bg-[radial-gradient(ellipse_at_70%_20%,#d9c996,transparent_45%),linear-gradient(145deg,#dce8d6,#93aa8d_55%,#31584b)] p-6 text-[#173e37]">
        <div><span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold">{language === 'en' ? englishStation?.altitude ?? station.altitud : station.altitud}</span><h3 className="mt-3 text-3xl font-black">{language === 'en' ? englishNames[station.nombre] ?? station.nombre : station.nombre}</h3><p className="mt-1 font-semibold">{language === 'en' ? englishStation?.theme ?? station.tema : station.tema}</p></div><Icon size={48} strokeWidth={1.4} aria-hidden="true"/>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[1.3fr_1fr] md:p-7">
        <div><p className="text-xs font-bold uppercase tracking-widest text-frailejon-deep">{tx(language, 'Entiende el paisaje', 'Read the landscape')}</p><p className="mt-2 leading-relaxed text-mountain-ink">{language === 'en' ? englishStation?.summary ?? station.resumen : station.resumen}</p><div className="mt-4 rounded-2xl bg-moss-surface p-4"><p className="text-xs font-bold uppercase tracking-widest text-frailejon-deep">{tx(language, 'Tu experiencia', 'Your experience')}</p><p className="mt-1 text-sm leading-relaxed text-mountain-ink">{language === 'en' ? englishStation?.experience ?? station.experiencia : station.experiencia}</p></div></div>
        <div className="flex flex-col justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-mountain-muted">{tx(language, 'Fuentes revisadas · idioma original', 'Reviewed sources · original language')}</p>{station.fuentes.map(source => <p key={source} className="mt-2 rounded-xl bg-mist px-3 py-2 text-xs font-semibold text-mountain-ink">{source}</p>)}</div><button type="button" onClick={() => onAsk(language === 'es' ? `¿Qué dicen las fuentes UTON sobre ${station.nombre} y qué puedo observar aquí?` : `What do the UTON sources say about ${englishNames[station.nombre] ?? station.nombre}, and what can I observe here?`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-frailejon px-4 text-sm font-bold text-white hover:bg-frailejon-deep">{tx(language, 'Preguntar a Kumanday', 'Ask Kumanday')} <ArrowUpRight size={17}/></button></div>
      </div>
    </article> })()}
  </section>
}
