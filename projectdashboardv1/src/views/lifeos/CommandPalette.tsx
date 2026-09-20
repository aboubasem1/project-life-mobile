import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchLifeOs, type LifeOsState, type SearchHit } from '../../lib/lifeos'
import type { AppView } from '../../lib/routing'

type Command = {
  id: string
  title: string
  hint: string
  view?: AppView
  action?: 'capture'
}

const COMMANDS: Command[] = [
  { id: 'capture', title: 'Neu erfassen', hint: 'Capture', action: 'capture' },
  { id: 'inbox', title: 'Inbox öffnen', hint: 'Organisieren', view: 'inbox' },
  { id: 'knowledge', title: 'Wissen', hint: 'Knowledge', view: 'knowledge' },
  { id: 'decisions', title: 'Entscheidungen', hint: 'Decision Journal', view: 'decisions' },
  { id: 'reviews', title: 'Reviews', hint: 'Daily bis Yearly', view: 'reviews' },
  { id: 'signals', title: 'Signale', hint: 'Messen', view: 'signals' },
  { id: 'insights', title: 'Insights', hint: 'Nur belegte Muster', view: 'insights' },
  { id: 'integrations', title: 'Integrationen', hint: 'Connectoren', view: 'integrations' },
  { id: 'labor', title: 'Labor / Projekte', hint: 'Bestehende Boards', view: 'dashboardPlus' },
]

export function CommandPalette({
  state,
  projects,
  goals,
  tasks,
  onClose,
  onNavigate,
  onOpenCapture,
  onOpenHit,
}: {
  state: LifeOsState
  projects: Array<{ id: string; label: string; description?: string; outcome?: string; nextAction?: string; tasks: Array<{ id: string; title: string; done: boolean }> }>
  goals: Array<{ id: string; title: string; timeframe: 'Jahr' | 'Quartal' | 'Monat' | 'Woche'; percent: number; dueDate: string; description?: string; outcome?: string; metric?: string }>
  tasks: Array<{ id: string; title: string; project?: string }>
  onClose: () => void
  onNavigate: (view: AppView, entityId?: string) => void
  onOpenCapture: (preset?: string) => void
  onOpenHit: (hit: SearchHit) => void
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const hits = useMemo(
    () => searchLifeOs(state, query, { projects, goals, tasks }),
    [state, query, projects, goals, tasks],
  )
  const commands = COMMANDS.filter(item => (
    !query.trim()
    || `${item.title} ${item.hint}`.toLowerCase().includes(query.trim().toLowerCase())
  ))

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div className="modal modal--small lifeos-palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Suche</span>
            <h2 id="palette-title">Command</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
        <label className="text-field">
          <span className="sr-only">Suchen oder erfassen</span>
          <div className="lifeos-search-line">
            <Search size={16} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Suchen oder Enter zum Erfassen"
              autoFocus
              onKeyDown={event => {
                if (event.key === 'Enter' && query.trim()) {
                  event.preventDefault()
                  onOpenCapture(query.trim())
                }
              }}
            />
          </div>
        </label>
        <div className="lifeos-palette-list">
          {commands.map(item => (
            <button
              key={item.id}
              type="button"
              className="lifeos-palette-item"
              onClick={() => {
                if (item.action === 'capture') onOpenCapture()
                else if (item.view) onNavigate(item.view)
              }}
            >
              <strong>{item.title}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
          {hits.map(hit => (
            <button
              key={`${hit.kind}-${hit.id}`}
              type="button"
              className="lifeos-palette-item"
              onClick={() => onOpenHit(hit)}
            >
              <strong>{hit.title}</strong>
              <span>{hit.kind} · {hit.snippet}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
