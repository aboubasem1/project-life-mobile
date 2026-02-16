import './App.css'

function App() {
  const morningRoutine = [
    { label: 'Datum', value: '16.02.2026' },
    { label: 'Stimmung beim Aufwachen', value: '😊 Motiviert' },
    { label: 'Schlafqualität', value: '82%' },
    { label: 'Schlafdauer', value: '7h 40m' },
    { label: 'Meditation (Min)', value: '12' },
    { label: 'Cold Shower', value: 'Done', status: 'done' },
    { label: 'Protein Shake', value: 'Done', status: 'done' },
  ]

  const workoutDaily = [
    { label: '50 Pushups', value: 'Done', status: 'done' },
    { label: '50 Squats', value: 'Done', status: 'done' },
    { label: '50 Sek Wallsit', value: 'Done', status: 'done' },
    { label: '50 Sek Plank', value: 'Done', status: 'done' },
  ]

  const mindset = [
    { label: 'Dankbarkeit', value: 'Done', status: 'done' },
    { label: 'Fokus', value: 'Done', status: 'done' },
    { label: 'Winner Mode', value: 'Done', status: 'done' },
  ]

  const eveningRoutine = [
    { label: 'Protein (g)', value: '160g' },
    { label: 'Kalorien', value: '2.450' },
    { label: 'Aufgaben erledigt', value: '6/7' },
    { label: 'Journal', value: 'Done', status: 'done' },
    { label: 'Family Time', value: 'Done', status: 'done' },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Project Life Dashboard</p>
          <h1>PROJECT LIFE DASHBOARD</h1>
          <p className="subtle">✓ Bereit</p>
        </div>
        <div className="status-pill">✅ Tagesstatus aktiv</div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>🌅 Morgen Routine</h2>
          <span className="chip">Morning</span>
        </div>
        <div className="metric-grid">
          {morningRoutine.map((item) => (
            <div key={item.label} className="metric-card">
              <span>{item.label}</span>
              <div className="metric-value">
                <strong>{item.value}</strong>
                {item.status && <span className="badge">Done</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>🏋️ Workout Daily 50</h2>
          <span className="chip chip-outline">Daily</span>
        </div>
        <div className="metric-grid">
          {workoutDaily.map((item) => (
            <div key={item.label} className="metric-card">
              <span>{item.label}</span>
              <div className="metric-value">
                <strong>{item.value}</strong>
                {item.status && <span className="badge">Done</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>🎯 Mindset</h2>
          <span className="chip">Focus</span>
        </div>
        <div className="metric-grid">
          {mindset.map((item) => (
            <div key={item.label} className="metric-card">
              <span>{item.label}</span>
              <div className="metric-value">
                <strong>{item.value}</strong>
                {item.status && <span className="badge">Done</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>🌙 Abend Routine</h2>
          <span className="chip chip-outline">Evening</span>
        </div>
        <div className="metric-grid">
          {eveningRoutine.map((item) => (
            <div key={item.label} className="metric-card">
              <span>{item.label}</span>
              <div className="metric-value">
                <strong>{item.value}</strong>
                {item.status && <span className="badge">Done</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default App
