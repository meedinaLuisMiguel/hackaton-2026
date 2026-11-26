import { ArrowUpToLine, Compass, MessageSquare, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let touchStartY = 0
    const threshold = 95
    let touchStartX = 0
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    const updateScroll = () => setScrolled(window.scrollY > 180)
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.changedTouches[0]?.clientY ?? 0
      touchStartX = event.changedTouches[0]?.clientX ?? 0
    }
    const onTouchEnd = (event: TouchEvent) => {
      const endY = event.changedTouches[0]?.clientY ?? touchStartY
      const distance = touchStartY - endY
      const startTarget = document.elementFromPoint(touchStartX, touchStartY)
      // A swipe gesture must never hijack range sliders, buttons, inputs, or scrollable panels.
      if (startTarget?.closest('button, a, input, textarea, select, [contenteditable="true"], [data-scroll-gesture-ignore]')) return
      if (distance > threshold && window.scrollY > 300) scrollToTop()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Home' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) scrollToTop()
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', updateScroll, { passive: true })
    updateScroll()
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', updateScroll)
    }
  }, [])

  return (
    <>
    {scrolled && <div role="group" className="scroll-controls fixed bottom-[calc(5.9rem+env(safe-area-inset-bottom))] right-4 z-30 flex flex-col gap-1.5 md:bottom-24" aria-label="Controles de desplazamiento">
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Subir al inicio" className="grid h-10 w-10 place-items-center rounded-full border border-mountain-border bg-white/95 text-frailejon shadow-lg backdrop-blur">
        <ArrowUpToLine size={17} aria-hidden="true" />
      </button>
    </div>}
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-[max(.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 mx-auto w-[calc(100%-1.5rem)] max-w-[520px] -translate-x-1/2 rounded-[1.35rem] border border-white/70 bg-white/90 p-1.5 shadow-[0_12px_40px_-12px_rgba(23,49,36,.35)] backdrop-blur-xl md:bottom-6"
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
              <span className="text-[10px] font-semibold tracking-wide sm:text-[11px]">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
    </>
  )
}
