import type { AppView } from '../../views/TodayView'
import { Sun, LayoutList, BarChart2 } from 'lucide-react'

interface Props {
  current: AppView
  onChange: (v: AppView) => void
}

export function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      <button
        className={`bottom-nav-btn ${current === 'today' ? 'active' : ''}`}
        onClick={() => onChange('today')}
        aria-current={current === 'today' ? 'page' : undefined}
      >
        <Sun aria-hidden="true" />
        <span>Heute</span>
      </button>
      <button
        className={`bottom-nav-btn ${current === 'plan' ? 'active' : ''}`}
        onClick={() => onChange('plan')}
        aria-current={current === 'plan' ? 'page' : undefined}
      >
        <LayoutList aria-hidden="true" />
        <span>Plan</span>
      </button>
      <button
        className={`bottom-nav-btn ${current === 'verlauf' ? 'active' : ''}`}
        onClick={() => onChange('verlauf')}
        aria-current={current === 'verlauf' ? 'page' : undefined}
      >
        <BarChart2 aria-hidden="true" />
        <span>Verlauf</span>
      </button>
    </nav>
  )
}
