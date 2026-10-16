import { useState, type FormEvent } from 'react'
import {
  addAsset,
  addDelegation,
  addExperiment,
  addGoal,
  addInbox,
  addMeal,
  addPortfolio,
  addPreference,
  addShoppingItem,
  addSupplement,
  addTask,
  addVisit,
  addWeightPoint,
  applyReviewDecision,
  attachTranscript,
  assetAccessLabel,
  blockActive,
  completeActive,
  contributionMargin,
  delegateTask,
  deletePreference,
  delegationStatusLabel,
  goalStatusLabel,
  importReel,
  isOverdue,
  localPriority,
  patchAsset,
  patchDelegation,
  patchExperiment,
  patchFinance,
  patchGoal,
  patchHealth,
  patchPortfolio,
  patchPreference,
  patchSupplement,
  patchVisit,
  patchReelCandidate,
  patchRequirement,
  pauseActive,
  pauseTask,
  promoteGoal,
  portfolioStatusLabel,
  preferenceKindLabel,
  reelStatusLabel,
  releaseReel,
  removeMeal,
  removeShoppingItem,
  removeSupplement,
  removeVisit,
  rescheduleTask,
  reviewDecisionLabel,
  RUN_PROJECT_ID,
  setCapacity,
  setCaptureDraft,
  setEnergyMode,
  setExperimentLimit,
  setExperimentStatus,
  setPortfolioStatus,
  shrinkTask,
  sleepDurationMinutes,
  startNext,
  startTask,
  taskKindLabel,
  todayBoard,
  weekSummary,
  weightTrend,
} from '../../lib/generationalRun/logic'
import type {
  AssetRecord,
  DayCapacity,
  EnergyMode,
  DelegationStatus,
  Experiment,
  GoalLevel,
  GoalNode,
  PreferenceKind,
  ReviewDecision,
  SourceKind,
  TaskEnergy,
  TaskKind,
} from '../../lib/generationalRun/types'
import { nowIso, type KnowledgeItem, type LifeOsState } from '../../lib/lifeos'
import { Field, LifeOsPage } from './lifeosUi'
import { BodyEvolutionCard } from '../../components/BodyEvolutionCard'

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript?: string }>> }
type SpeechRecognitionInstance = {
  lang: string
  onresult: ((event: SpeechResult) => void) | null
  onerror: (() => void) | null
  start: () => void
}

function speechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null
}

function localToday(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nullableNumber(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export type LaborCommitment = {
  id: string
  label: string
  time: string
  taken: boolean
}

export function GenerationalRunView({
  life,
  commit,
  commitments,
  onOpenLabor,
  onOpenCheckin,
}: {
  life: LifeOsState
  commit: (updater: (current: LifeOsState) => LifeOsState) => void
  commitments: LaborCommitment[]
  onOpenLabor: () => void
  onOpenCheckin: () => void
}) {
  const run = life.run
  const board = todayBoard(run)
  const priority = localPriority(run)
  const [audioNote, setAudioNote] = useState('')
  const [limitNote, setLimitNote] = useState('')
  const [blockNote, setBlockNote] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [dueDrafts, setDueDrafts] = useState<Record<string, string>>({})
  const [transcriptDrafts, setTranscriptDrafts] = useState<Record<string, string>>({})
  const today = localToday()
  const apply = (updater: (current: LifeOsState['run']) => LifeOsState['run']) => {
    commit(current => ({ ...current, run: updater(current.run) }))
  }

  const capture = (event: FormEvent) => {
    event.preventDefault()
    apply(current => addInbox(current, { text: current.captureDraft }, nowIso()))
  }

  const startAudio = () => {
    const Recognition = speechRecognition()
    if (!Recognition) {
      setAudioNote('Audio auf diesem Gerät nicht verfügbar. Der Textentwurf bleibt gespeichert.')
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'de-DE'
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
      if (!transcript) return
      apply(current => setCaptureDraft(current, `${current.captureDraft} ${transcript}`.trim(), nowIso()))
    }
    recognition.onerror = () => setAudioNote('Audio fehlgeschlagen. Text bleibt erhalten.')
    recognition.start()
  }

  const release = (jobId: string) => {
    commit(current => {
      const result = releaseReel(current.run, jobId, nowIso())
      if (!result.created || !result.knowledge) return { ...current, run: result.run }
      const now = nowIso()
      const knowledge: KnowledgeItem = {
        id: result.knowledge.id,
        title: result.knowledge.title,
        content: result.knowledge.content,
        summary: result.knowledge.summary,
        source: result.knowledge.source,
        type: 'video',
        topics: result.knowledge.topics,
        tags: result.knowledge.tags,
        createdAt: now,
        updatedAt: now,
      }
      const exists = current.knowledge.some(item => item.id === knowledge.id)
      return {
        ...current,
        run: result.run,
        knowledge: exists ? current.knowledge : [knowledge, ...current.knowledge],
      }
    })
  }

  const importFile = (file: File, existingJobId?: string) => {
    const finish = (text?: string) => {
      apply(current => importReel(current, {
        fileName: file.name,
        byteSize: file.size,
        text,
        existingJobId,
        now: nowIso(),
      }).run)
    }
    if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.vtt') || file.name.toLowerCase().endsWith('.srt')) {
      const reader = new FileReader()
      reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => finish('')
      reader.readAsText(file)
      return
    }
    finish()
  }

  const active = run.tasks.find(task => task.id === run.session?.taskId)
  const margin = contributionMargin(run.finance)
  const week = run.reviews.at(-1)

  return (
    <LifeOsPage eyebrow="Arbeitsbereich" title="Generational Run">
      <div className="run-stack">
        <BodyEvolutionCard records={run.healthPlan.weightPoints.map(point => ({ date: point.date, kg: point.value }))} />
        <section className="card" aria-labelledby="run-priority">
          <h3 id="run-priority">Nächste Priorität</h3>
          <p>{priority.reason}</p>
          <p className="prog-sub">Status: lokal, ohne Anbieter.</p>
        </section>

        <section className="card" aria-labelledby="run-today">
          <h3 id="run-today">Heute</h3>
          {board.primary.length === 0 ? (
            <p>Keine Hauptaufgabe in dieser Kapazität. Erfasse eine kleine Aufgabe oder wechsle den Modus.</p>
          ) : (
            <ul className="run-list">
              {board.primary.map(task => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <span>{taskKindLabel(task.kind)} · {task.minutes} Min · Energie {task.energy}</span>
                  <span>Nächster Schritt: {task.nextStep || 'offen'}</span>
                  <span>Ergebnis: {task.result || 'noch offen'}</span>
                  {task.due ? <span>Termin: {task.due}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <TaskForm apply={apply} />
          <h4>Überfällig</h4>
          {run.tasks.filter(task => isOverdue(task, today)).length === 0 ? (
            <p className="prog-sub">Keine überfällige Aufgabe.</p>
          ) : (
            <ul className="run-list">
              {run.tasks.filter(task => isOverdue(task, today)).map(task => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <span>Fällig {task.due} · {task.minutes} Min</span>
                  <Field label={`Neuer Termin ${task.title}`}>
                    <input
                      type="date"
                      value={dueDrafts[task.id] ?? ''}
                      onChange={event => setDueDrafts(current => ({ ...current, [task.id]: event.target.value }))}
                    />
                  </Field>
                  <div className="run-actions">
                    <button type="button" className="secondary-button" onClick={() => apply(current => rescheduleTask(current, task.id, dueDrafts[task.id] ?? '', nowIso()))}>Neu planen</button>
                    <button type="button" className="secondary-button" onClick={() => apply(current => shrinkTask(current, task.id, nowIso()))}>Verkleinern</button>
                    <button type="button" className="secondary-button" onClick={() => apply(current => delegateTask(current, task.id, nowIso()))}>Delegieren</button>
                    <button type="button" className="secondary-button" onClick={() => apply(current => pauseTask(current, task.id, nowIso()))}>Pausieren</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h4>Bleibt stehen</h4>
          {board.protectedItems.length === 0 && commitments.length === 0 ? (
            <p className="prog-sub">Keine festen Termine oder markierten Einnahmen. Labor-Medis und Check-in bleiben unverändert.</p>
          ) : (
            <ul className="run-list">
              {commitments.map(item => (
                <li key={item.id}>
                  <strong>{item.label}</strong>
                  <span>Einnahme aus Labor{item.time ? ` · ${item.time}` : ''}{item.taken ? ' · heute erfasst' : ''}</span>
                </li>
              ))}
              {board.protectedItems.map(task => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <span>{taskKindLabel(task.kind)}{task.due ? ` · ${task.due}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="run-start">
          <h3 id="run-start">Jetzt starten</h3>
          {active ? (
            <p>{active.title} · {run.session?.phase === 'paused' ? 'Pause' : 'läuft'}</p>
          ) : (
            <p>Startet die nächste sichtbare Aufgabe.</p>
          )}
          <div className="run-actions">
            <button type="button" className="primary-button" onClick={() => apply(current => startNext(current, nowIso()).run)}>Jetzt starten</button>
            <button type="button" className="secondary-button" onClick={() => apply(current => pauseActive(current, nowIso()))}>Pause</button>
            <button type="button" className="secondary-button" onClick={() => apply(current => completeActive(current, nowIso()))}>Fertig</button>
          </div>
          <Field label="Blockade">
            <input value={blockNote} onChange={event => setBlockNote(event.target.value)} placeholder="Was fehlt?" />
          </Field>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const result = blockActive(run, blockNote, nowIso())
              apply(() => result.run)
              setBlockNote('')
            }}
          >
            Blockade speichern
          </button>
          {run.tasks.filter(task => task.status === 'blocked').map(task => {
            const fallback = run.tasks.find(item => item.id === task.fallbackTaskId && item.status !== 'done')
            return (
              <p key={task.id}>
                Blockiert: {task.title}. {task.blockedNote || ''}
                {fallback ? (
                  <button type="button" className="secondary-button" onClick={() => apply(current => startTask(current, fallback.id, nowIso()))}>
                    Ersatz: {fallback.title}
                  </button>
                ) : ' Keine Ersatzaufgabe vorbereitet.'}
              </p>
            )
          })}
        </section>

        <section className="card" aria-labelledby="run-capture">
          <h3 id="run-capture">Schnell erfassen</h3>
          <form onSubmit={capture}>
            <Field label="Text, Link oder Idee">
              <textarea
                value={run.captureDraft}
                onChange={event => apply(current => setCaptureDraft(current, event.target.value, nowIso()))}
                rows={3}
              />
            </Field>
            <div className="run-actions">
              <button type="submit" className="primary-button">Speichern</button>
              <button type="button" className="secondary-button" onClick={startAudio}>Audio</button>
            </div>
          </form>
          {audioNote ? <p role="status">{audioNote}</p> : null}
          <ul className="run-list">
            {run.inbox.map(item => (
              <li key={item.id}>
                <span>{item.text}</span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => apply(current => addTask(removeInboxItem(current, item.id), {
                    title: item.text,
                    kind: 'revenue',
                    energy: 'okay',
                  }, nowIso()))}
                >
                  Als Aufgabe
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="run-energy">
          <h3 id="run-energy">Energie und Kapazität</h3>
          <div className="run-actions" role="group" aria-label="Energiemodus">
            {(['normal', 'low'] as EnergyMode[]).map(mode => (
              <button
                type="button"
                key={mode}
                className={run.energyMode === mode ? 'primary-button' : 'secondary-button'}
                aria-pressed={run.energyMode === mode}
                onClick={() => apply(current => setEnergyMode(current, mode, nowIso()))}
              >
                {mode === 'normal' ? 'Normal' : 'Wenig Energie'}
              </button>
            ))}
          </div>
          <Field label="Tageskapazität">
            <select
              value={run.capacity}
              onChange={event => apply(current => setCapacity(current, event.target.value as DayCapacity, nowIso()))}
            >
              <option value="small">Klein</option>
              <option value="normal">Normal</option>
              <option value="wide">Weit</option>
            </select>
          </Field>
        </section>

        <Experiments run={run} limitNote={limitNote} onLimitNote={setLimitNote} apply={apply} />
        <Portfolio run={run} onLimitNote={setLimitNote} apply={apply} />

        <section className="card" aria-labelledby="run-review">
          <h3 id="run-review">Wochenreview</h3>
          <p>{weekSummary(run)}</p>
          <p>{week?.summary ? `Gespeichert: ${week.summary}` : 'Noch keine Entscheidung in dieser Woche.'}</p>
          {week?.decision ? <p>Entscheidung: {reviewDecisionLabel(week.decision)}</p> : null}
          <Field label="Notiz zur Entscheidung">
            <input value={reviewNote} onChange={event => setReviewNote(event.target.value)} />
          </Field>
          <div className="run-actions">
            {(['continue', 'change', 'pause'] as ReviewDecision[]).map(decision => (
              <button
                type="button"
                key={decision}
                className="secondary-button"
                onClick={() => apply(current => applyReviewDecision(current, decision, reviewNote, nowIso()))}
              >
                {reviewDecisionLabel(decision)}
              </button>
            ))}
          </div>
        </section>

        <details className="card">
          <summary>Ziele</summary>
          <GoalForm goals={run.goals} apply={apply} />
          <ul className="run-list">
            {run.goals.map(goal => (
              <li key={goal.id}>
                <strong>{goal.level === 'big' ? 'Big Goal' : goal.level === 'mid' ? 'Zwischenziel' : 'Nächste Aufgabe'}: {goal.title}</strong>
                <span>Ergebnis: {goal.result || 'offen'} · {goalStatusLabel(goal.status)}</span>
                {goal.level === 'task' ? (
                  <button type="button" className="secondary-button" onClick={() => apply(current => promoteGoal(current, goal.id, nowIso()))}>
                    Als Aufgabe übernehmen
                  </button>
                ) : null}
                <select
                  aria-label={`Status ${goal.title}`}
                  value={goal.status}
                  onChange={event => apply(current => patchGoal(current, goal.id, { status: event.target.value as GoalNodeStatus }, nowIso()))}
                >
                  <option value="draft">Entwurf</option>
                  <option value="active">Aktiv</option>
                  <option value="paused">Pausiert</option>
                  <option value="done">Erledigt</option>
                </select>
              </li>
            ))}
          </ul>
        </details>

        <details className="card">
          <summary>Assets</summary>
          <p className="prog-sub">Unbekannte Kennzahlen bleiben leer. Entwürfe sind nicht bestätigt.</p>
          <AssetCreator apply={apply} />
          {run.assets.map(asset => (
            <AssetEditor key={asset.id} asset={asset} apply={apply} />
          ))}
        </details>

        <details className="card">
          <summary>Finanzen</summary>
          <p>Deckungsbeitrag: {margin == null ? 'noch nicht berechenbar' : margin}. Annahme, keine Steuerbewertung.</p>
          <FinanceFields run={run} apply={apply} />
        </details>

        <details className="card">
          <summary>Delegation</summary>
          <DelegationBlock run={run} apply={apply} />
        </details>

        <details className="card">
          <summary>Leben und Health</summary>
          <p>Verordnete Einnahmen bleiben in Labor. Schlaf und Gewicht im Check-in werden hier nicht gelöscht.</p>
          <div className="run-actions">
            <button type="button" className="secondary-button" onClick={onOpenLabor}>Labor öffnen</button>
            <button type="button" className="secondary-button" onClick={onOpenCheckin}>Check-in öffnen</button>
          </div>
          <HealthBlock run={run} apply={apply} />
        </details>

        <details className="card">
          <summary>Präferenzen</summary>
          <p className="prog-sub">Fakt, Präferenz und Hypothese bleiben getrennt. Kein Training.</p>
          <PreferenceBlock run={run} apply={apply} />
        </details>

        <details className="card">
          <summary>Reel-Wissen</summary>
          <p className="prog-sub">Freigabe nur nach Prüfung. Transkription ohne Dienst bleibt blockiert.</p>
          <label className="secondary-button">
            Datei importieren
            <input
              className="run-file"
              type="file"
              onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) importFile(file)
              }}
            />
          </label>
          {run.reels.map(job => (
            <article key={job.id} className="run-reel">
              <strong>{job.fileName}</strong>
              <span>{reelStatusLabel(job.status)}{job.transcriptBlocked ? ' · Transkript extern blockiert' : ''}</span>
              {job.error ? <p role="status">{job.error}</p> : null}
              {job.transcriptBlocked && !job.knowledgeId ? (
                <>
                  <Field label={`Transkript ${job.fileName}`}>
                    <textarea
                      rows={3}
                      value={transcriptDrafts[job.id] ?? ''}
                      onChange={event => setTranscriptDrafts(current => ({ ...current, [job.id]: event.target.value }))}
                    />
                  </Field>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => apply(current => attachTranscript(current, job.id, transcriptDrafts[job.id] ?? '', nowIso()).run)}
                  >
                    Text übernehmen
                  </button>
                </>
              ) : null}
              {job.candidates.map(candidate => (
                <div key={candidate.id} className="run-candidate">
                  <Field label="Text">
                    <textarea
                      value={candidate.text}
                      onChange={event => apply(current => patchReelCandidate(current, job.id, candidate.id, { text: event.target.value }, nowIso()))}
                      rows={2}
                    />
                  </Field>
                  <Field label="Kategorie">
                    <input
                      value={candidate.category}
                      onChange={event => apply(current => patchReelCandidate(current, job.id, candidate.id, { category: event.target.value }, nowIso()))}
                    />
                  </Field>
                  <Field label="Quelle">
                    <select
                      value={candidate.sourceKind}
                      onChange={event => apply(current => patchReelCandidate(current, job.id, candidate.id, { sourceKind: event.target.value as SourceKind }, nowIso()))}
                    >
                      <option value="note">Eigene Notiz</option>
                      <option value="transcript">Transkript</option>
                      <option value="external">Extern belegt</option>
                    </select>
                  </Field>
                </div>
              ))}
              <label className="secondary-button">
                Erneut versuchen
                <input
                  className="run-file"
                  type="file"
                  onChange={event => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) importFile(file, job.id)
                  }}
                />
              </label>
              <button type="button" className="primary-button" disabled={Boolean(job.knowledgeId)} onClick={() => release(job.id)}>
                {job.knowledgeId ? 'Einmal freigegeben' : 'Freigeben'}
              </button>
            </article>
          ))}
        </details>

        <details className="card">
          <summary>Integrationen</summary>
          <ul className="run-list">
            <li>iPhone: diese Prüfung ist ein Browserlayout, kein Gerätetest.</li>
            <li>Meta-Brille: kein belegter Kamera-, Audio- oder Bewegungspfad in diesem Stand.</li>
            <li>Preisradar: keine Live-Quelle angebunden. Einkaufspreis ist keine Marge.</li>
          </ul>
        </details>
      </div>
    </LifeOsPage>
  )
}

type Apply = (updater: (current: LifeOsState['run']) => LifeOsState['run']) => void

function removeInboxItem(run: LifeOsState['run'], id: string): LifeOsState['run'] {
  return { ...run, inbox: run.inbox.filter(item => item.id !== id) }
}

type GoalNodeStatus = 'draft' | 'active' | 'paused' | 'done'

function TaskForm({ apply }: { apply: Apply }) {
  const [title, setTitle] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [minutes, setMinutes] = useState('25')
  const [energy, setEnergy] = useState<TaskEnergy>('okay')
  const [result, setResult] = useState('')
  const [kind, setKind] = useState<TaskKind>('revenue')
  const [due, setDue] = useState('')
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        apply(current => addTask(current, {
          title,
          nextStep,
          minutes: Number(minutes) || 25,
          energy,
          result,
          kind,
          due,
        }, nowIso()))
        setTitle('')
        setNextStep('')
        setResult('')
        setDue('')
      }}
    >
      <Field label="Aufgabe">
        <input value={title} onChange={event => setTitle(event.target.value)} />
      </Field>
      <Field label="Nächster Schritt">
        <input value={nextStep} onChange={event => setNextStep(event.target.value)} />
      </Field>
      <Field label="Minuten">
        <input value={minutes} onChange={event => setMinutes(event.target.value)} />
      </Field>
      <Field label="Energie">
        <select value={energy} onChange={event => setEnergy(event.target.value as TaskEnergy)}>
          <option value="low">Niedrig</option>
          <option value="okay">Okay</option>
          <option value="high">Hoch</option>
        </select>
      </Field>
      <Field label="Ergebnis">
        <input value={result} onChange={event => setResult(event.target.value)} />
      </Field>
      <Field label="Art">
        <select value={kind} onChange={event => setKind(event.target.value as TaskKind)}>
          <option value="revenue">Umsatz</option>
          <option value="support">Unterstützung</option>
          <option value="anchor">Anker</option>
          <option value="appointment">Termin</option>
          <option value="prescribed">Einnahme</option>
        </select>
      </Field>
      <Field label="Termin, optional">
        <input type="date" value={due} onChange={event => setDue(event.target.value)} />
      </Field>
      <button type="submit" className="secondary-button">Aufgabe speichern</button>
    </form>
  )
}

function GoalForm({ goals, apply }: { goals: GoalNode[]; apply: Apply }) {
  const [level, setLevel] = useState<GoalLevel>('big')
  const [parentId, setParentId] = useState('')
  const [title, setTitle] = useState('')
  const [result, setResult] = useState('')
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        apply(current => addGoal(current, { level, parentId: parentId || undefined, title, result }, nowIso()))
        setTitle('')
        setResult('')
      }}
    >
      <Field label="Ebene">
        <select value={level} onChange={event => setLevel(event.target.value as GoalLevel)}>
          <option value="big">Big Goal</option>
          <option value="mid">Zwischenziel</option>
          <option value="task">Nächste Aufgabe</option>
        </select>
      </Field>
      <Field label="Gehört zu">
        <select value={parentId} onChange={event => setParentId(event.target.value)}>
          <option value="">Keins</option>
          {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
        </select>
      </Field>
      <Field label="Titel">
        <input value={title} onChange={event => setTitle(event.target.value)} />
      </Field>
      <Field label="Ergebnis">
        <input value={result} onChange={event => setResult(event.target.value)} />
      </Field>
      <button type="submit" className="secondary-button">Ziel speichern</button>
    </form>
  )
}

function Experiments({
  run,
  limitNote,
  onLimitNote,
  apply,
}: {
  run: LifeOsState['run']
  limitNote: string
  onLimitNote: (value: string) => void
  apply: Apply
}) {
  const [draft, setDraft] = useState<Pick<Experiment, 'offer' | 'buyers' | 'hypothesis' | 'success' | 'abort' | 'nextAction' | 'basis' | 'uncertainty'>>({
    offer: '',
    buyers: '',
    hypothesis: '',
    success: '',
    abort: '',
    nextAction: '',
    basis: '',
    uncertainty: '',
  })
  const [limits, setLimits] = useState({ budget: '', time: '', days: '', metrics: '' })
  return (
    <section className="card" aria-labelledby="run-experiments">
      <h3 id="run-experiments">Umsatzexperimente</h3>
      <p>Aktive Vorgabe: {run.experimentLimit}. {run.capacityNote}</p>
      {limitNote ? <p role="status">{limitNote}</p> : null}
      <Field label="Vorgabe aktiver Experimente">
        <input
          type="number"
          min={1}
          max={8}
          value={run.experimentLimit}
          onChange={event => apply(current => setExperimentLimit(current, Number(event.target.value) || current.experimentLimit, nowIso()))}
        />
      </Field>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addExperiment(current, {
            ...draft,
            budgetLimit: nullableNumber(limits.budget),
            timeBudgetMin: nullableNumber(limits.time),
            durationDays: nullableNumber(limits.days),
            metricsNote: limits.metrics,
          }, nowIso()))
          setDraft({ offer: '', buyers: '', hypothesis: '', success: '', abort: '', nextAction: '', basis: '', uncertainty: '' })
          setLimits({ budget: '', time: '', days: '', metrics: '' })
        }}
      >
        {([
          ['offer', 'Angebot'],
          ['buyers', 'Käufergruppe'],
          ['hypothesis', 'Hypothese'],
          ['basis', 'Datengrundlage'],
          ['uncertainty', 'Unsicherheit'],
          ['success', 'Erfolgskriterium'],
          ['abort', 'Abbruchkriterium'],
          ['nextAction', 'Nächste Handlung'],
        ] as const).map(([key, label]) => (
          <Field key={key} label={label}>
            <input value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} />
          </Field>
        ))}
        <Field label="Budgetgrenze">
          <input value={limits.budget} placeholder="unbekannt" onChange={event => setLimits(current => ({ ...current, budget: event.target.value }))} />
        </Field>
        <Field label="Zeitbudget, Minuten">
          <input value={limits.time} placeholder="unbekannt" onChange={event => setLimits(current => ({ ...current, time: event.target.value }))} />
        </Field>
        <Field label="Testdauer, Tage">
          <input value={limits.days} placeholder="unbekannt" onChange={event => setLimits(current => ({ ...current, days: event.target.value }))} />
        </Field>
        <Field label="Messwerte">
          <input value={limits.metrics} placeholder="offen" onChange={event => setLimits(current => ({ ...current, metrics: event.target.value }))} />
        </Field>
        <button type="submit" className="secondary-button">Experiment anlegen</button>
      </form>
      <ul className="run-list">
        {run.experiments.map(experiment => (
          <li key={experiment.id}>
            <strong>{experiment.offer || 'Ohne Angebot'}</strong>
            <span>{experiment.status} · {experiment.basis || 'Grundlage offen'} · {experiment.uncertainty || 'Unsicherheit offen'}</span>
            <span>Nächste Handlung: {experiment.nextAction || 'offen'}</span>
            <span>Messwerte: {experiment.metricsNote || 'offen'}</span>
            {experiment.status === 'active' && !experiment.nextAction.trim() ? <span>Aktives Experiment ohne nächste Handlung.</span> : null}
            {([
              ['budgetLimit', 'Budgetgrenze'],
              ['timeBudgetMin', 'Zeitbudget, Minuten'],
              ['durationDays', 'Testdauer, Tage'],
            ] as const).map(([key, label]) => (
              <Field key={key} label={`${label} ${experiment.offer || 'Experiment'}`}>
                <input
                  value={experiment[key] ?? ''}
                  placeholder="unbekannt"
                  onChange={event => apply(current => patchExperiment(current, experiment.id, { [key]: nullableNumber(event.target.value) }, nowIso()))}
                />
              </Field>
            ))}
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const result = setExperimentStatus(run, experiment.id, experiment.status === 'active' ? 'paused' : 'active', nowIso())
                if (!result.ok) {
                  onLimitNote(`Vorgabe ist ${result.limit}. ${result.active} sind aktiv. Erhöhe die Vorgabe bewusst.`)
                  return
                }
                onLimitNote('')
                apply(() => result.run)
              }}
            >
              {experiment.status === 'active' ? 'Pausieren' : 'Aktivieren'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Portfolio({
  run,
  onLimitNote,
  apply,
}: {
  run: LifeOsState['run']
  onLimitNote: (value: string) => void
  apply: Apply
}) {
  const [name, setName] = useState('')
  return (
    <section className="card" aria-labelledby="run-portfolio">
      <h3 id="run-portfolio">Projektportfolio</h3>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addPortfolio(current, { name }, nowIso()))
          setName('')
        }}
      >
        <Field label="Projektname">
          <input value={name} onChange={event => setName(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Projekt anlegen</button>
      </form>
      <ul className="run-list">
        {run.portfolio.map(item => (
          <li key={item.id}>
            <strong>{item.name}</strong>
            <span>{portfolioStatusLabel(item.status)} · {item.confirmed ? 'bestätigt' : 'Entwurf'} · {item.kind === 'revenue' ? 'Umsatz' : item.kind === 'workspace' ? 'Arbeitsbereich' : 'sonstig'}</span>
            <Field label={`Nächste Handlung ${item.name}`}>
              <input value={item.nextAction} onChange={event => apply(current => patchPortfolio(current, item.id, { nextAction: event.target.value }, nowIso()))} />
            </Field>
            {item.id !== RUN_PROJECT_ID ? (
              <select
                aria-label={`Status ${item.name}`}
                value={item.status}
                onChange={event => {
                  const status = event.target.value as typeof item.status
                  const result = setPortfolioStatus(run, item.id, status, nowIso())
                  if (!result.ok) {
                    onLimitNote(`Vorgabe ist ${result.limit}. ${result.active} Umsatzexperimente sind aktiv.`)
                    return
                  }
                  onLimitNote('')
                  apply(() => result.run)
                }}
              >
                <option value="idea">Idee</option>
                <option value="ready">Bereit</option>
                <option value="active">Aktiv</option>
                <option value="paused">Pausiert</option>
                <option value="done">Abgeschlossen</option>
              </select>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function AssetCreator({ apply }: { apply: Apply }) {
  const [name, setName] = useState('')
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        apply(current => addAsset(current, name, nowIso()))
        setName('')
      }}
    >
      <Field label="Exakter Name">
        <input value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <button type="submit" className="secondary-button">Asset anlegen</button>
    </form>
  )
}

function AssetEditor({ asset, apply }: { asset: AssetRecord; apply: Apply }) {
  const patch = (next: Partial<AssetRecord>) => apply(current => patchAsset(current, asset.id, next, nowIso()))
  return (
    <fieldset className="run-asset">
      <legend>{asset.name}{asset.confirmed ? '' : ' · Entwurf'}</legend>
      <Field label="Name">
        <input value={asset.name} onChange={event => patch({ name: event.target.value })} />
      </Field>
      <Field label="URL">
        <input value={asset.url ?? ''} onChange={event => patch({ url: event.target.value.trim() || null })} />
      </Field>
      <Field label="Plattform">
        <input value={asset.platform ?? ''} onChange={event => patch({ platform: event.target.value.trim() || null })} />
      </Field>
      <Field label="Zielgruppe">
        <input value={asset.audience ?? ''} onChange={event => patch({ audience: event.target.value.trim() || null })} />
      </Field>
      <Field label="Letzte Aktivität">
        <input value={asset.lastActivity ?? ''} placeholder="unbekannt" onChange={event => patch({ lastActivity: event.target.value.trim() || null })} />
      </Field>
      <Field label="Inhalte und Rechte">
        <input value={asset.contentRights ?? ''} placeholder="unbekannt" onChange={event => patch({ contentRights: event.target.value.trim() || null })} />
      </Field>
      <Field label="Produkte">
        <input value={asset.products ?? ''} placeholder="unbekannt" onChange={event => patch({ products: event.target.value.trim() || null })} />
      </Field>
      <Field label="Zugang">
        <select value={asset.access} onChange={event => patch({ access: event.target.value as AssetRecord['access'] })}>
          {(['unknown', 'owned', 'shared', 'none'] as const).map(access => (
            <option key={access} value={access}>{assetAccessLabel(access)}</option>
          ))}
        </select>
      </Field>
      <Field label="Kennzahl">
        <input
          value={asset.metricValue ?? ''}
          onChange={event => patch({ metricValue: nullableNumber(event.target.value) })}
          placeholder="unbekannt"
        />
      </Field>
      <Field label="Kennzahl-Datum">
        <input value={asset.metricDate ?? ''} onChange={event => patch({ metricDate: event.target.value.trim() || null })} />
      </Field>
      <Field label="Kennzahl-Quelle">
        <input value={asset.metricSource ?? ''} onChange={event => patch({ metricSource: event.target.value.trim() || null })} />
      </Field>
      <Field label="Erlös">
        <input
          value={asset.revenue ?? ''}
          onChange={event => patch({ revenue: nullableNumber(event.target.value) })}
          placeholder="unbekannt"
        />
      </Field>
      <label className="run-check">
        <input type="checkbox" checked={asset.confirmed} onChange={event => patch({ confirmed: event.target.checked })} />
        Name bestätigt
      </label>
    </fieldset>
  )
}

function FinanceFields({ run, apply }: { run: LifeOsState['run']; apply: Apply }) {
  const fields: Array<['revenue' | 'paidIn' | 'variableCosts' | 'fixedCosts' | 'receivables' | 'capital' | 'returnsAmount' | 'shipping' | 'purchaseCosts' | 'platformFees', string]> = [
    ['revenue', 'Umsatz'],
    ['paidIn', 'Bezahlte Eingänge'],
    ['variableCosts', 'Variable Kosten'],
    ['fixedCosts', 'Fixkosten'],
    ['receivables', 'Offene Forderungen'],
    ['capital', 'Verfügbares Kapital'],
    ['returnsAmount', 'Retouren'],
    ['shipping', 'Versand'],
    ['purchaseCosts', 'Einkauf'],
    ['platformFees', 'Plattform- und Zahlungsgebühren'],
  ]
  return (
    <>
      {fields.map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            value={run.finance[key] ?? ''}
            onChange={event => apply(current => patchFinance(current, { [key]: nullableNumber(event.target.value) }, nowIso()))}
            placeholder="unbekannt"
          />
        </Field>
      ))}
      <Field label="Annahmen">
        <textarea
          value={run.finance.assumptions}
          rows={2}
          onChange={event => apply(current => patchFinance(current, { assumptions: event.target.value }, nowIso()))}
        />
      </Field>
    </>
  )
}

function DelegationBlock({ run, apply }: { run: LifeOsState['run']; apply: Apply }) {
  const [task, setTask] = useState('')
  return (
    <>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addDelegation(current, task, nowIso()))
          setTask('')
        }}
      >
        <Field label="Aufgabe">
          <input value={task} onChange={event => setTask(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Briefing anlegen</button>
      </form>
      {run.delegations.map(item => (
        <fieldset key={item.id}>
          <legend>{item.task || 'Delegation'}</legend>
          {([
            ['owner', 'Verantwortlich'],
            ['input', 'Input'],
            ['example', 'Beispiel'],
            ['output', 'Output'],
            ['doneWhen', 'Definition of Done'],
            ['budget', 'Budget'],
            ['due', 'Fällig'],
            ['questions', 'Rückfragen'],
          ] as const).map(([key, label]) => (
            <Field key={key} label={label}>
              <input value={item[key]} onChange={event => apply(current => patchDelegation(current, item.id, { [key]: event.target.value }, nowIso()))} />
            </Field>
          ))}
          <Field label={`Status ${item.task || 'Delegation'}`}>
            <select
              value={item.status}
              onChange={event => apply(current => patchDelegation(current, item.id, { status: event.target.value as DelegationStatus }, nowIso()))}
            >
              {(['draft', 'active', 'blocked', 'done'] as const).map(status => (
                <option key={status} value={status}>{delegationStatusLabel(status)}</option>
              ))}
            </select>
          </Field>
          <p>Zuweisung bleibt manuell.</p>
        </fieldset>
      ))}
    </>
  )
}

function HealthBlock({ run, apply }: { run: LifeOsState['run']; apply: Apply }) {
  const plan = run.healthPlan
  const trend = weightTrend(plan.weightPoints)
  const sleepMinutes = sleepDurationMinutes(plan.sleepStart, plan.sleepEnd)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState('')
  const [product, setProduct] = useState('')
  const [amount, setAmount] = useState('')
  const [stock, setStock] = useState('')
  const [mealName, setMealName] = useState('')
  const [shopText, setShopText] = useState('')
  const [visitTitle, setVisitTitle] = useState('')
  return (
    <>
      <Field label="Bewegung, Einheiten pro Woche">
        <input
          type="number"
          min={0}
          max={14}
          value={plan.movementSessionsPerWeek}
          onChange={event => apply(current => patchHealth(current, { movementSessionsPerWeek: Number(event.target.value) || 0 }, nowIso()))}
        />
      </Field>
      <Field label="Bewegungsnotiz">
        <textarea
          rows={2}
          value={plan.movementNote}
          onChange={event => apply(current => patchHealth(current, { movementNote: event.target.value }, nowIso()))}
        />
      </Field>
      <p className="prog-sub">BJJ bleibt eine spätere Achse. Kein Trainingsplan.</p>
      <h4>Schlaf</h4>
      <p className="prog-sub">Manuelle Zeiten. Kein Sleep-Score.</p>
      <Field label="Schlafbeginn">
        <input type="time" value={plan.sleepStart ?? ''} onChange={event => apply(current => patchHealth(current, { sleepStart: event.target.value || null }, nowIso()))} />
      </Field>
      <Field label="Schlafende">
        <input type="time" value={plan.sleepEnd ?? ''} onChange={event => apply(current => patchHealth(current, { sleepEnd: event.target.value || null }, nowIso()))} />
      </Field>
      <p>{sleepMinutes == null ? 'Schlafdauer offen.' : `Schlafdauer ${Math.floor(sleepMinutes / 60)} h ${sleepMinutes % 60} min.`}</p>
      <Field label="Subjektive Erholung">
        <input
          value={plan.sleepRecovery ?? ''}
          placeholder="offen"
          onChange={event => apply(current => patchHealth(current, { sleepRecovery: event.target.value.trim() || null }, nowIso()))}
        />
      </Field>
      <h4>Ernährung</h4>
      <Field label="Kalorienziel">
        <input
          value={plan.calorieTarget ?? ''}
          placeholder="kein automatisches Ziel"
          onChange={event => apply(current => patchHealth(current, { calorieTarget: nullableNumber(event.target.value) }, nowIso()))}
        />
      </Field>
      <Field label="Proteinziel">
        <input
          value={plan.proteinTarget ?? ''}
          placeholder="kein automatisches Ziel"
          onChange={event => apply(current => patchHealth(current, { proteinTarget: nullableNumber(event.target.value) }, nowIso()))}
        />
      </Field>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addMeal(current, { name: mealName }, nowIso()))
          setMealName('')
        }}
      >
        <Field label="Wiederholbare Mahlzeit">
          <input value={mealName} onChange={event => setMealName(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Mahlzeit merken</button>
      </form>
      <ul className="run-list">
        {plan.meals.map(meal => (
          <li key={meal.id}>
            <span>{meal.name}{meal.note ? ` · ${meal.note}` : ''}</span>
            <button type="button" className="secondary-button" onClick={() => apply(current => removeMeal(current, meal.id, nowIso()))}>Entfernen</button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addShoppingItem(current, shopText, nowIso()))
          setShopText('')
        }}
      >
        <Field label="Einkauf">
          <input value={shopText} onChange={event => setShopText(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Zur Liste</button>
      </form>
      <ul className="run-list">
        {plan.shopping.map(item => (
          <li key={item.id}>
            <span>{item.text}</span>
            <button type="button" className="secondary-button" onClick={() => apply(current => removeShoppingItem(current, item.id, nowIso()))}>Entfernen</button>
          </li>
        ))}
      </ul>
      <Field label="Meal Prep">
        <textarea rows={2} value={plan.mealPrepNote} onChange={event => apply(current => patchHealth(current, { mealPrepNote: event.target.value }, nowIso()))} />
      </Field>
      <Field label="Bulk-Notiz">
        <textarea rows={2} value={plan.bulkNote} placeholder="kein automatisches Gewichtsziel" onChange={event => apply(current => patchHealth(current, { bulkNote: event.target.value }, nowIso()))} />
      </Field>
      <h4>Gewicht</h4>
      <p>{trend.comparable ? `Gewichtsdifferenz ${trend.delta} kg zwischen erstem und letztem Messpunkt.` : 'Zu wenig Gewichtspunkte für einen Vergleich.'}</p>
      <form
        onSubmit={event => {
          event.preventDefault()
          const value = nullableNumber(weight)
          if (value == null) return
          apply(current => addWeightPoint(current, { date, value }, nowIso()))
          setWeight('')
        }}
      >
        <Field label="Gewicht, kg">
          <input value={weight} onChange={event => setWeight(event.target.value)} />
        </Field>
        <Field label="Messdatum">
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Messpunkt speichern</button>
      </form>
      <h4>Pflege</h4>
      <Field label="Skincare">
        <textarea rows={2} value={plan.skincareNote} placeholder="nur bestätigte Produkte" onChange={event => apply(current => patchHealth(current, { skincareNote: event.target.value }, nowIso()))} />
      </Field>
      <label className="run-check">
        <input
          type="checkbox"
          checked={plan.whiteningOptional}
          onChange={event => apply(current => patchHealth(current, { whiteningOptional: event.target.checked }, nowIso()))}
        />
        Whitening als optionaler Kur-Schritt
      </label>
      <p className="prog-sub">Keine medizinische Vorgabe.</p>
      <Field label="Haare">
        <input value={plan.hairNote} onChange={event => apply(current => patchHealth(current, { hairNote: event.target.value }, nowIso()))} />
      </Field>
      <Field label="Zähne">
        <input value={plan.teethNote} onChange={event => apply(current => patchHealth(current, { teethNote: event.target.value }, nowIso()))} />
      </Field>
      <Field label="Nächste Pflegehandlung">
        <input value={plan.careNextAction} onChange={event => apply(current => patchHealth(current, { careNextAction: event.target.value }, nowIso()))} />
      </Field>
      <Field label="Pflegetermin">
        <input type="date" value={plan.careAppointment} onChange={event => apply(current => patchHealth(current, { careAppointment: event.target.value }, nowIso()))} />
      </Field>
      <Field label="Pflegekosten, Notiz">
        <input value={plan.careCostNote} placeholder="unbekannt" onChange={event => apply(current => patchHealth(current, { careCostNote: event.target.value }, nowIso()))} />
      </Field>
      <h4>Supplements</h4>
      <p className="prog-sub">Nur eigene Angaben. Keine Wechselwirkung und keine Dosisvorgabe.</p>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addSupplement(current, { product, amount, stock }, nowIso()))
          setProduct('')
          setAmount('')
          setStock('')
        }}
      >
        <Field label="Produkt">
          <input value={product} onChange={event => setProduct(event.target.value)} />
        </Field>
        <Field label="Menge">
          <input value={amount} placeholder="offen" onChange={event => setAmount(event.target.value)} />
        </Field>
        <Field label="Bestand">
          <input value={stock} placeholder="offen" onChange={event => setStock(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Supplement eintragen</button>
      </form>
      <ul className="run-list">
        {plan.supplements.map(item => (
          <li key={item.id}>
            <strong>{item.product}</strong>
            <Field label={`Menge ${item.product}`}>
              <input value={item.amount} placeholder="offen" onChange={event => apply(current => patchSupplement(current, item.id, { amount: event.target.value }, nowIso()))} />
            </Field>
            <Field label={`Bestand ${item.product}`}>
              <input value={item.stock} placeholder="offen" onChange={event => apply(current => patchSupplement(current, item.id, { stock: event.target.value }, nowIso()))} />
            </Field>
            <button type="button" className="secondary-button" onClick={() => apply(current => removeSupplement(current, item.id, nowIso()))}>Entfernen</button>
          </li>
        ))}
      </ul>
      <h4>Arzt und Rezept</h4>
      <Field label="Vorrat oder Rezeptbedarf">
        <textarea
          rows={2}
          value={plan.prescriptionNote}
          placeholder="keine Dosisänderung"
          onChange={event => apply(current => patchHealth(current, { prescriptionNote: event.target.value }, nowIso()))}
        />
      </Field>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addVisit(current, { title: visitTitle }, nowIso()))
          setVisitTitle('')
        }}
      >
        <Field label="Arztbesuch">
          <input value={visitTitle} onChange={event => setVisitTitle(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Besuch merken</button>
      </form>
      <ul className="run-list">
        {plan.visits.map(visit => (
          <li key={visit.id}>
            <strong>{visit.title}</strong>
            <Field label={`Termin ${visit.title}`}>
              <input type="date" value={visit.date} onChange={event => apply(current => patchVisit(current, visit.id, { date: event.target.value }, nowIso()))} />
            </Field>
            <Field label={`Unterlagen ${visit.title}`}>
              <input value={visit.documents} placeholder="offen" onChange={event => apply(current => patchVisit(current, visit.id, { documents: event.target.value }, nowIso()))} />
            </Field>
            <Field label={`Follow-up ${visit.title}`}>
              <input value={visit.followUp} placeholder="offen" onChange={event => apply(current => patchVisit(current, visit.id, { followUp: event.target.value }, nowIso()))} />
            </Field>
            <button type="button" className="secondary-button" onClick={() => apply(current => removeVisit(current, visit.id, nowIso()))}>Entfernen</button>
          </li>
        ))}
      </ul>
      {run.lifeRequirements.map(item => (
        <label key={item.id} className="run-check">
          <input
            type="checkbox"
            checked={item.active}
            onChange={event => apply(current => patchRequirement(current, item.id, event.target.checked, item.note, nowIso()))}
          />
          {item.label}{item.active ? '' : ' · nicht hervorgehoben'}
        </label>
      ))}
    </>
  )
}

function PreferenceBlock({ run, apply }: { run: LifeOsState['run']; apply: Apply }) {
  const [kind, setKind] = useState<PreferenceKind>('preference')
  const [text, setText] = useState('')
  return (
    <>
      <form
        onSubmit={event => {
          event.preventDefault()
          apply(current => addPreference(current, { kind, text }, nowIso()))
          setText('')
        }}
      >
        <Field label="Art">
          <select value={kind} onChange={event => setKind(event.target.value as PreferenceKind)}>
            <option value="fact">Fakt</option>
            <option value="preference">Präferenz</option>
            <option value="hypothesis">Hypothese</option>
          </select>
        </Field>
        <Field label="Text">
          <input value={text} onChange={event => setText(event.target.value)} />
        </Field>
        <button type="submit" className="secondary-button">Speichern</button>
      </form>
      <ul className="run-list">
        {run.preferences.map(item => (
          <li key={item.id}>
            <strong>{preferenceKindLabel(item.kind)}</strong>
            <span>{item.text}</span>
            <span>Quelle: {item.source} · {item.at}</span>
            <button type="button" className="secondary-button" onClick={() => apply(current => patchPreference(current, item.id, { enabled: !item.enabled }, nowIso()))}>
              {item.enabled ? 'Deaktivieren' : 'Aktivieren'}
            </button>
            <button type="button" className="secondary-button" onClick={() => apply(current => deletePreference(current, item.id, nowIso()))}>Löschen</button>
          </li>
        ))}
      </ul>
    </>
  )
}
