import { useMemo, useState } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { createDefaultEntry } from '../types/DashboardEntry'

function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  entries: DashboardEntry[]
  onSave:  (entry: DashboardEntry) => Promise<void>
  onOpenFocus?: (task: string) => void
}

export function PlanView({ entries, onSave, onOpenFocus }: Props) {
  const today = getToday()
  const entry = useMemo(
    () => entries.find(e => e.date === today) ?? createDefaultEntry(today),
    [entries, today],
  )

  const anchors = entry.anchors ?? []
  const [draft, setDraft] = useState('')

  const save = (patch: Partial<DashboardEntry>) =>
    void onSave({ ...entry, ...patch })

  const addAnchor = () => {
    const t = draft.trim()
    if (!t || anchors.length >= 4) return
    save({
      anchors:     [...anchors, t],
      anchorsDone: [...(entry.anchorsDone ?? []), false],
    })
    setDraft('')
  }

  const removeAnchor = (i: number) => {
    save({
      anchors:     anchors.filter((_, idx) => idx !== i),
      anchorsDone: (entry.anchorsDone ?? []).filter((_, idx) => idx !== i),
    })
  }

  return (
    <div className="plan-view fade-in">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 'var(--sp-1)',
        }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>
            Was ist heute wichtig?
          </h2>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            {anchors.length}/4
          </span>
        </div>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-5)' }}>
          Maximal 4 Anker. Weniger ist mehr.
        </p>

        {/* Anchor list */}
        {anchors.map((a, i) => (
          <div key={i} className="anchor-item" style={{ cursor: 'default' }}>
            {onOpenFocus && (
              <button
                className="anchor-check"
                onClick={() => onOpenFocus(a)}
                aria-label={`Fokus auf: ${a}`}
                title="Fokus starten"
                style={{ background: 'var(--accent-soft)', border: 'none' }}
              >
                <Zap size={11} style={{ color: 'var(--accent)' }} aria-hidden="true" />
              </button>
            )}
            <span className="anchor-text">{a}</span>
            <button
              className="anchor-delete-btn"
              onClick={() => removeAnchor(i)}
              aria-label={`${a} entfernen`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        {/* Add anchor input */}
        {anchors.length < 4 && (
          <div className="anchor-add-row">
            <input
              className="anchor-input"
              placeholder="Neue wichtige Aufgabe…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAnchor()}
              aria-label="Tagesanker hinzufügen"
              maxLength={120}
            />
            <button
              className="btn btn-secondary"
              onClick={addAnchor}
              disabled={!draft.trim()}
              aria-label="Hinzufügen"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* ── Tip ──────────────────────────────────────────────────────── */}
      <p style={{
        fontSize: 'var(--font-xs)',
        color: 'var(--text-muted)',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'var(--surface)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        lineHeight: 1.6,
      }}>
        Tipp: 1–3 Anker reichen für einen fokussierten Tag. Drücke Eingabe zum Hinzufügen.
      </p>
    </div>
  )
}
