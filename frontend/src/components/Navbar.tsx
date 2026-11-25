import { Compass, MessageSquare, ScanLine } from 'lucide-react'
import type { AppTab } from '../types/paramo'

interface NavbarProps {
  activeTab: AppTab
  onSelectTab: (tab: AppTab) => void
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; Icon: typeof Compass }> = [
  { id: 'rutas', label: 'Rutas & GPS', Icon: Compass },
  { id: 'vision', label: 'Lente IA', Icon: ScanLine },
  { id: 'chat', label: 'Kumanday IA', Icon: MessageSquare },
]

export function Navbar({ activeTab, onSelectTab }: NavbarProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[520px] -translate-x-1/2 rounded-full border border-white/70 bg-white/90 p-1.5 shadow-[0_12px_40px_-12px_rgba(23,49,36,.35)] backdrop-blur-xl md:bottom-6"
    >
      <div className="grid grid-cols-3 gap-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`nav-item min-h-[52px] rounded-full px-2 py-1.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isActive
                  ? 'bg-frailejon text-white shadow-sm'
                  : 'text-mountain-muted hover:bg-mist hover:text-mountain-ink'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold tracking-wide">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
