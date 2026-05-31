import { useMemo, useState, useEffect, useCallback } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { HABITS } from '../types/DashboardEntry'
import { WeeklyChart } from '../components/charts/WeeklyChart'
import { ScoreHeatmap } from '../components/charts/ScoreHeatmap'
import { calculateScore, calculateStreakForHabit, calculateCompletionRate, getScoreLabel } from '../lib/score'
import { exportJSON, importJSON, upsertEntry } from '../lib/storage'
import { loadAchievements } from '../lib/achievements'
import { getOrCreateChallenge, getChallengeProgress } from '../lib/challenges'
import { computeCorrelations } from '../lib/correlations'
import {
  TrendingUp, Flame, Calendar, HardDrive, Download, Upload, RefreshCw,
  Target, Trophy, Zap, AlertTriangle,
} from 'lucide-react'

const SCORE_GOAL_KEY = 'lifeos-score-goal-v1'
function loadGoal(): number { return Number(localStorage.getItem(SCORE_GOAL_KEY) ?? 0) }
function saveGoal(g: number): void { localStorage.setItem(SCORE_GOAL_KEY, String(g)) }
function getLastExportDate(): string | null { return localStorage.getItem('lifeos-last-export') }
function markExported(): void { localStorage.setItem('lifeos-last-export', new Date().toISOString().split('T')[0]) }
function needsBackupReminder(entries: DashboardEntry[]): boolean {
  if (entries.length === 0) return false
  const last = getLastExportDate()
  if (!last) return entries.length >= 7
  return Math.floor((Date.now() - new Date(last).getTime()) / 86400000) >= 30
}

interface Props { entries: DashboardEntry[]; onReload: () => Promise<void> }

export function StatsView({ entries, onReload }: Props) {
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries])
  const last30 = sorted.slice(-30)
  const [goal, setGoal] = useState<number>(loadGoal)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [achievements, setAchievements] = useState(() => loadAchievements())
  const challenge = useMemo(() => getOrCreateChallenge(), [])
  const challengeProgress = useMemo(() => getChallengeProgress(entries, challenge), [entries, challenge])
  const correlations = useMemo(() => computeCorrelations(sorted), [sorted])
  const showBackup = useMemo(() => needsBackupReminder(entries), [entries])
  useEffect(() => { setAchievements(loadAchievements()) }, [entries])

  const avgScore = useMemo(() => {
    const scored = sorted.filter(e => (e.dailyScore ?? 0) > 0)
    if (!scored.length) return 0
    return Math.round(scored.reduce((s, e) => s + (e.dailyScore ?? 0), 0) / scored.length)
  }, [sorted])

  const weekAvg = useMemo(() => {
    const week = sorted.slice(-7).filter(e => (e.dailyScore ?? 0) > 0)
    if (!week.length) return 0
    return Math.round(week.reduce((s, e) => s + (e.dailyScore ?? 0), 0) / week.length)
  }, [sorted])

  const bestDay = useMemo(() => {
    if (!sorted.length) return null
    return sorted.reduce((best, e) => (e.dailyScore ?? 0) > (best.dailyScore ?? 0) ? e : best, sorted[0])
  }, [sorted])

  const currentStreak = useMemo(() => {
    if (!sorted.length) return 0
    const today = new Date().toISOString().split('T')[0]
    let streak = 0
    let cursor = new Date(today)
    const set = new Set(sorted.map(e => e.date))
    while (set.has(cursor.toISOString().split('T')[0])) { streak++; cursor.setDate(cursor.getDate() - 1) }
    return streak
  }, [sorted])

  const handleExport = useCallback(() => { exportJSON(entries); markExported() }, [entries])

  const handleImport = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json'
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const imported = await importJSON(file)
        imported.forEach(entry => upsertEntry(entry))
        await onReload()
        alert(`${imported.length} Einträge importiert.`)
      } catch { alert('Import fehlgeschlagen.') }
    }
    inp.click()
  }

  const saveNewGoal = () => {
    const v = parseInt(goalInput)
    if (v > 0 && v <= 100) { setGoal(v); saveGoal(v) }
    setEditingGoal(false)
  }

  const goalProgress = goal > 0 ? Math.min(100, Math.round((weekAvg / goal) * 100)) : 0

  return (
    <div className="stats-view">

      {/* Backup Reminder */}
      {showBackup && (
        <div className="backup-banner">
          <AlertTriangle size={14} />
          <span>
            Exportiere deine Daten — letzte Sicherung vor{' '}
            {getLastExportDate()
              ? Math.floor((Date.now() - new Date(getLastExportDate()!).getTime()) / 86400000) + ' Tagen'
              : 'nie'}
          </span>
          <button className="backup-btn" onClick={handleExport}>Jetzt exportieren</button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card"><span className="kpi-value">{sorted.length}</span><span className="kpi-label">TAGE ERFASST</span></div>
        <div className="kpi-card"><span className="kpi-value">{avgScore}</span><span className="kpi-label">Ø SCORE</span></div>
        <div className="kpi-card"><span className="kpi-value">{bestDay ? (bestDay.dailyScore ?? calculateScore(bestDay)) : '—'}</span><span className="kpi-label">BESTER TAG</span></div>
        <div className="kpi-card"><span className="kpi-value">{currentStreak}</span><span className="kpi-label">STREAK</span></div>
      </div>

      {/* Wochenziel */}
      <section className="panel">
        <div className="panel-header">
          <span className="chip"><Target size={12} /> WOCHENZIEL</span>
          <button className="ghost-btn" onClick={() => { setGoalInput(String(goal || 70)); setEditingGoal(true) }}>
            {goal > 0 ? 'Ändern' : 'Ziel setzen'}
          </button>
        </div>
        {editingGoal ? (
          <div className="goal-edit">
            <input
              className="goal-input" type="number" min="1" max="100"
              placeholder="Ziel-Score (1-100)" value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveNewGoal()}
              autoFocus
            />
            <button className="action-btn" onClick={saveNewGoal}>Speichern</button>
            <button className="action-btn ghost" onClick={() => setEditingGoal(false)}>Abbrechen</button>
          </div>
        ) : goal > 0 ? (
          <div className="goal-body">
            <div className="goal-labels">
              <span>Diese Woche Ø: <strong>{weekAvg}</strong></span>
              <span>Ziel: <strong>{goal}</strong></span>
            </div>
            <div className="goal-bar-bg">
              <div className={`goal-bar-fill${weekAvg >= goal ? ' reached' : ''}`} style={{ width: `${goalProgress}%` }} />
            </div>
            <div className="goal-status">
              {weekAvg >= goal ? '✅ Ziel diese Woche erreicht!' : `Noch ${goal - weekAvg} Pkt bis zum Ziel`}
            </div>
          </div>
        ) : (
          <p className="data-hint">Setze ein Wochenziel um deinen Fortschritt zu tracken.</p>
        )}
      </section>

      {/* Wochenchallenge */}
      <section className="panel">
        <div className="panel-header"><span className="chip"><Zap size={12} /> WOCHENCHALLENGE</span></div>
        <div className="challenge-card">
          <div className="challenge-icon">{challenge.icon}</div>
          <div className="challenge-body">
            <div className="challenge-title">{challenge.title}</div>
            <div className="challenge-desc">{challenge.desc}</div>
            <div className="challenge-progress-row">
              <div className="challenge-bar-bg">
                <div className={`challenge-bar-fill${challenge.completed ? ' done' : ''}`}
                  style={{ width: `${Math.round((challengeProgress / 7) * 100)}%` }} />
              </div>
              <span className="challenge-counter">{challengeProgress}/7</span>
            </div>
          </div>
          <div className="challenge-xp">+{challenge.xpReward}<br /><span>XP</span></div>
        </div>
        {challenge.completed && <div className="challenge-done-badge">🎉 Abgeschlossen! XP gutgeschrieben.</div>}
      </section>

      {/* Heatmap */}
      <section className="panel">
        <div className="panel-header"><span className="chip"><Calendar size={12} /> SCORE HEATMAP</span></div>
        <ScoreHeatmap entries={sorted} />
      </section>

      {/* Correlations */}
      {correlations.length > 0 && (
        <section className="panel">
          <div className="panel-header"><span className="chip"><TrendingUp size={12} /> INSIGHTS</span></div>
          <div className="correlation-list">
            {correlations.map(c => (
              <div key={c.habitKey} className="corr-row">
                <div className="corr-habit">{c.habitLabel}</div>
                <div className="corr-body">
                  <div className="corr-bar-wrap"><div className="corr-bar-without" style={{ width: `${c.avgWithoutHabit}%` }} /></div>
                  <div className="corr-bar-wrap"><div className="corr-bar-with" style={{ width: `${c.avgWithHabit}%` }} /></div>
                </div>
                <div className={`corr-delta ${c.delta >= 0 ? 'pos' : 'neg'}`}>{c.delta >= 0 ? '+' : ''}{c.delta}</div>
              </div>
            ))}
            <p className="corr-hint">Score-Unterschied mit vs. ohne Habit (Ø Punkte)</p>
          </div>
        </section>
      )}

      {/* 30-Tage Chart */}
      <section className="panel">
        <div className="panel-header"><span className="chip"><TrendingUp size={12} /> 30-TAGE VERLAUF</span></div>
        <div className="chart-wrap"><WeeklyChart entries={last30} /></div>
      </section>

      {/* Achievements */}
      <section className="panel">
        <div className="panel-header">
          <span className="chip"><Trophy size={12} /> ACHIEVEMENTS</span>
          <span className="chip-count">{achievements.length}/18</span>
        </div>
        <div className="achievement-grid">
          {achievements.length === 0
            ? <p className="data-hint">Noch keine Badges. Weiter so!</p>
            : achievements.map(a => (
              <div key={a.id} className="ach-badge">
                <div className="ach-badge-icon">{a.icon}</div>
                <div className="ach-badge-name">{a.title}</div>
                <div className="ach-badge-date">{a.unlockedAt}</div>
              </div>
            ))
          }
        </div>
      </section>

      {/* Habit Streaks */}
      <section className="panel">
        <div className="panel-header"><span className="chip"><Flame size={12} /> HABIT STREAKS</span></div>
        <div className="habit-streak-list">
          {HABITS.map(h => {
            const streak = calculateStreakForHabit(sorted, h.key)
            const rate7  = calculateCompletionRate(sorted, h.key, 7)
            const rate30 = calculateCompletionRate(sorted, h.key, 30)
            return (
              <div key={h.key} className="streak-row">
                <span className="streak-emoji"><h.icon size={18} style={{ color: h.color }} /></span>
                <div className="streak-info">
                  <span className="streak-label">{h.label}</span>
                  <div className="streak-bars">
                    <div className="streak-bar-wrap" title={`7 Tage: ${rate7}%`}><div className="streak-bar-fill" style={{ width: `${rate7}%`, background: h.color }} /></div>
                    <div className="streak-bar-wrap" title={`30 Tage: ${rate30}%`}><div className="streak-bar-fill" style={{ width: `${rate30}%`, background: h.color, opacity: 0.6 }} /></div>
                  </div>
                </div>
                <div className="streak-stats">
                  <span className="streak-fire">{streak > 0 ? <><Flame size={12} style={{ color: '#ff9500', verticalAlign: 'middle' }} />{streak}</> : '—'}</span>
                  <span className="streak-pct">{rate7}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* History */}
      {sorted.length > 0 && (
        <section className="panel">
          <div className="panel-header"><span className="chip"><Calendar size={12} /> VERLAUF</span></div>
          <div className="history-list">
            {[...sorted].reverse().slice(0, 14).map(e => {
              const s = e.dailyScore ?? calculateScore(e)
              return (
                <div key={e.date} className="history-row">
                  <span className="history-date">{e.date}</span>
                  <div className="history-bar-wrap"><div className="history-bar" style={{ width: `${s}%` }} /></div>
                  <span className="history-score">{s}</span>
                  <span className="history-label">{getScoreLabel(s)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Data */}
      <section className="panel">
        <div className="panel-header"><span className="chip"><HardDrive size={12} /> DATEN</span></div>
        <div className="data-actions">
          <button className="action-btn" onClick={handleExport}><Download size={14} /> EXPORTIEREN</button>
          <button className="action-btn secondary" onClick={handleImport}><Upload size={14} /> IMPORTIEREN</button>
          <button className="action-btn ghost" onClick={() => void onReload()}><RefreshCw size={14} /> SYNC</button>
        </div>
        <p className="data-hint">{sorted.length} Einträge lokal gespeichert</p>
      </section>

    </div>
  )
}
