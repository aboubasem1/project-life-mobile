interface Props { onEnter: () => void }

export function LandingView({ onEnter }: Props) {
  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
      </div>

      <div className="landing-content">
        <div className="landing-badge">Personal OS · v2.0</div>

        <h1 className="landing-title">
          Project<br /><span className="landing-title-accent">Life</span>
        </h1>

        <p className="landing-subtitle">
          Track. Score. Grow.<br />
          Dein Leben — gamifiziert.
        </p>

        <div className="landing-features">
          <div className="landing-feat">
            <span className="landing-feat-icon">📊</span>
            <span>Daily Score System</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">🏆</span>
            <span>18 Achievements</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">🔥</span>
            <span>Habit Streaks</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">⚡</span>
            <span>Weekly Challenges</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">📈</span>
            <span>Korrelations-Insights</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">🗓️</span>
            <span>Score Heatmap</span>
          </div>
        </div>

        <button className="landing-cta" onClick={onEnter}>
          App starten →
        </button>

        <p className="landing-hint">100% lokal · Keine Accounts · Keine Cloud</p>
      </div>
    </div>
  )
}
