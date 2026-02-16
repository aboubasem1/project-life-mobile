import './App.css'

function App() {
  const quickActions = [
    { title: 'Quick Note', detail: 'In die Inbox schreiben' },
    { title: 'Training planen', detail: 'Session für heute' },
    { title: 'Cashflow check', detail: 'Monatsübersicht' },
    { title: 'Content Sprint', detail: 'Reel Idee festhalten' },
  ]

  const focusBlocks = [
    { title: 'Deep Work', detail: '2 x 50 Minuten', status: '09:00 - 11:00' },
    { title: 'Admin', detail: 'Emails & Orga', status: '12:30 - 13:00' },
    { title: 'Creatives', detail: 'Moodboard & Hooks', status: '15:00 - 16:30' },
  ]

  const lifeAreas = [
    { title: 'Health', metric: 'Schlaf 7h 40m', note: 'Supplemente: ✅' },
    { title: 'Finanzen', metric: 'Cashflow +2.4k', note: 'Fixkosten Review' },
    { title: 'Ideen', metric: '8 neue Skizzen', note: 'Side Hustle fokus' },
    { title: 'Creative', metric: '3 Content Konzepte', note: 'DJ Set Entwurf' },
    { title: 'Social', metric: '2 Reels Drafts', note: 'Viral Analyse' },
    { title: 'Future', metric: 'Ziele 2026', note: 'Immobilien Scan' },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Project Life Dashboard</p>
          <h1>Guten Morgen, Elias</h1>
          <p className="subtle">16. Februar 2026 · Fokus: Deep Work</p>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost">Sync prüfen</button>
          <button className="btn-primary">Neue Notiz</button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Tagesfokus</p>
          <h2>Strategische Klarheit</h2>
          <p className="stat-meta">3 wichtige Aufgaben · 2 Blöcke Deep Work</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Energie</p>
          <h2>8.2 / 10</h2>
          <p className="stat-meta">Schlafqualität 91% · Kein Koffein nach 14 Uhr</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Momentum</p>
          <h2>+14%</h2>
          <p className="stat-meta">Wöchentlicher Fortschritt über Plan</p>
        </div>
      </section>

      <section className="main-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Top 3 Tasks</h3>
            <span className="chip">Heute</span>
          </div>
          <ul className="task-list">
            <li>
              <span className="task-title">Dashboard UI Review</span>
              <span className="task-meta">60 min · Fokusblock 1</span>
            </li>
            <li>
              <span className="task-title">Business Einnahmen Update</span>
              <span className="task-meta">30 min · Cashflow</span>
            </li>
            <li>
              <span className="task-title">Content Reel Skript</span>
              <span className="task-meta">45 min · Creative</span>
            </li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Fokus Blöcke</h3>
            <span className="chip chip-outline">Plan</span>
          </div>
          <div className="focus-grid">
            {focusBlocks.map((block) => (
              <div key={block.title} className="focus-card">
                <h4>{block.title}</h4>
                <p>{block.detail}</p>
                <span>{block.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Quick Actions</h3>
            <span className="chip chip-outline">Tools</span>
          </div>
          <div className="quick-grid">
            {quickActions.map((action) => (
              <button key={action.title} className="quick-card">
                <span>{action.title}</span>
                <small>{action.detail}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="life-area-grid">
        {lifeAreas.map((area) => (
          <div key={area.title} className="life-card">
            <h4>{area.title}</h4>
            <p>{area.metric}</p>
            <span>{area.note}</span>
          </div>
        ))}
      </section>

      <section className="panel panel-wide">
        <div className="panel-header">
          <h3>Recent Notes</h3>
          <span className="chip">Inbox</span>
        </div>
        <div className="note-grid">
          <div className="note-card">
            <p>„Neue Automationen für Content-Plan testen“</p>
            <span>Vor 2 Stunden · 00_today/Inbox</span>
          </div>
          <div className="note-card">
            <p>„Proteinreiches Frühstück: 35g Ziel“</p>
            <span>Gestern · 01_health/Ernährung</span>
          </div>
          <div className="note-card">
            <p>„Immobilien-Scan: 3 Objekte shortlist“</p>
            <span>Gestern · 06_future/Immobilien</span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
