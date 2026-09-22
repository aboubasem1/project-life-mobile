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
  return (
    <nav className="progress-hub" aria-label="Lab">
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
    </nav>
  )
}
