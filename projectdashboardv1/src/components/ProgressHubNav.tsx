import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppView } from '../lib/routing'

const TABS: Array<{ id: AppView; label: string }> = [
  { id: 'progress', label: 'Überblick' },
  { id: 'dashboardPlus', label: 'Daten' },
  { id: 'plan', label: 'Plan' },
]

export function ProgressHubNav({
  view,
  onNavigate,
}: {
  view: AppView
  onNavigate: (view: AppView) => void
}) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const measure = () => {
    const root = listRef.current
    if (!root) return
    const active = root.querySelector<HTMLButtonElement>('button.is-on')
    if (!active) return
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
  }

  useLayoutEffect(() => {
    measure()
  }, [view])

  useEffect(() => {
    const root = listRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <nav className="progress-hub" aria-label="Lab">
      <div className="progress-hub__track" ref={listRef}>
        <span
          className="progress-hub__indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={view === tab.id ? 'is-on' : undefined}
            aria-current={view === tab.id ? 'page' : undefined}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
