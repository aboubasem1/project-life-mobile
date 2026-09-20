import { useState, type FormEvent } from 'react'
import { SIGNAL_TYPE_PRESETS, type ActivityRecord, type LifeAreaKey, type Signal } from '../../lib/lifeos'
import { Field, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'

export function SignalsView({
  signals,
  activities,
  onRecord,
  onActivity,
}: {
  signals: Signal[]
  activities: ActivityRecord[]
  onRecord: (input: { type: string; value: number; unit?: string }) => void
  onActivity: (input: { title: string; date: string; plannedDurationMin?: number; actualDurationMin?: number; lifeArea?: LifeAreaKey }) => void
}) {
  const [type, setType] = useState('mood')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('/10')
  const [customType, setCustomType] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [planned, setPlanned] = useState('')
  const [actual, setActual] = useState('')
  const [activityArea, setActivityArea] = useState<LifeAreaKey | undefined>(undefined)

  const submitSignal = (event: FormEvent) => {
    event.preventDefault()
    const parsed = Number(value.replace(',', '.'))
    if (!Number.isFinite(parsed)) return
    onRecord({ type: customType.trim() || type, value: parsed, unit })
    setValue('')
  }

  const submitActivity = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    onActivity({
      title: title.trim(),
      date,
      plannedDurationMin: planned ? Number(planned) : undefined,
      actualDurationMin: actual ? Number(actual) : undefined,
      lifeArea: activityArea,
    })
    setTitle('')
    setPlanned('')
    setActual('')
    setActivityArea(undefined)
  }

  return (
    <LifeOsPage eyebrow="Measure" title="Signale & Planned vs Actual">
      <section className="card">
        <form onSubmit={submitSignal}>
          <div className="lifeos-chip-row">
            {SIGNAL_TYPE_PRESETS.map(item => (
              <button
                key={item.type}
                type="button"
                className={type === item.type ? 'choice-button is-active' : 'choice-button'}
                onClick={() => {
                  setType(item.type)
                  setUnit(item.unit)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="lifeos-inline">
            <Field label="Wert"><input value={value} onChange={event => setValue(event.target.value)} inputMode="decimal" required /></Field>
            <Field label="Einheit"><input value={unit} onChange={event => setUnit(event.target.value)} /></Field>
            <Field label="Eigener Typ"><input value={customType} onChange={event => setCustomType(event.target.value)} placeholder="optional" /></Field>
          </div>
          <button type="submit" className="primary-button">Signal speichern</button>
        </form>
      </section>

      <section className="card">
        <span className="eyebrow">Planned vs Actual</span>
        <form onSubmit={submitActivity}>
          <Field label="Aktivität"><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Projekt A / Training" required /></Field>
          <div className="lifeos-inline">
            <Field label="Datum"><input type="date" value={date} onChange={event => setDate(event.target.value)} /></Field>
            <Field label="Geplant (min)"><input value={planned} onChange={event => setPlanned(event.target.value)} inputMode="numeric" /></Field>
            <Field label="Tatsächlich (min)"><input value={actual} onChange={event => setActual(event.target.value)} inputMode="numeric" /></Field>
          </div>
          <LifeAreaSelect value={activityArea} onChange={setActivityArea} />
          <p className="field-hint">Keine Werte erfinden. Leer lassen, wenn unbekannt.</p>
          <button type="submit" className="secondary-button">Activity speichern</button>
        </form>
      </section>

      <section className="card">
        <span className="eyebrow">Letzte Signale</span>
        {signals.length === 0 ? (
          <LifeOsEmpty title="Keine Signale" text="Manuell, Import oder Connector — dasselbe Modell." />
        ) : (
          [...signals].reverse().slice(0, 30).map(item => (
            <div key={item.id} className="lifeos-list-item">
              <strong>{item.type}: {item.value}{item.unit ? ` ${item.unit}` : ''}</strong>
              <span>{new Date(item.timestamp).toLocaleString('de-DE')} · {item.source}</span>
            </div>
          ))
        )}
      </section>

      {activities.length > 0 && (
        <section className="card">
          <span className="eyebrow">Activities</span>
          {[...activities].reverse().slice(0, 20).map(item => (
            <div key={item.id} className="lifeos-list-item">
              <strong>{item.title}</strong>
              <span>
                {item.date}
                {item.plannedDurationMin != null ? ` · geplant ${item.plannedDurationMin}m` : ''}
                {item.actualDurationMin != null ? ` · tatsächlich ${item.actualDurationMin}m` : ''}
              </span>
            </div>
          ))}
        </section>
      )}
    </LifeOsPage>
  )
}
