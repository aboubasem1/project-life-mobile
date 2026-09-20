import { useState, type FormEvent, type ReactNode } from 'react'
import {
  Check,
  ClipboardCheck,
  Droplets,
  Leaf,
  LockKeyhole,
  Moon,
  NotebookPen,
  Plus,
  RotateCcw,
  MonitorOff,
  Trash2,
  Wind,
  X,
} from 'lucide-react'
import {
  EVENING_GATE_STEP_IDS,
  createEveningGateState,
  finishEveningGate,
  markEveningGateStepDone,
  nextEveningGateStep,
  restartEveningGate,
  type EveningGateState,
  type EveningGateStepId,
} from '../lib/eveningGate'

const STEP_LABELS: Record<EveningGateStepId, string> = {
  windDown: 'Runterkommen',
  shower: 'Duschen',
  breathing: 'Atmung',
  prepare: 'Vorbereitung',
  preRoll: 'Vordrehen',
  memo: 'Memo',
  noScreen: 'No Screen',
}

function GateCard({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="morning-gate__card evening-gate__card">
      <div className="morning-gate__icon" aria-hidden="true">{icon}</div>
      <span className="eyebrow">{eyebrow}</span>
      <h2 id="evening-gate-title">{title}</h2>
      {children}
    </section>
  )
}

export function EveningGate({
  initialState,
  onPersist,
  onCaptureMemo,
  onOpenPrivateNotes,
  onFinish,
  onClose,
  inactive = false,
}: {
  initialState?: EveningGateState
  onPersist: (state: EveningGateState) => void
  onCaptureMemo: (text: string) => void
  onOpenPrivateNotes: (text: string, onSaved: () => void) => void
  onFinish: (state: EveningGateState) => void
  onClose: () => void
  inactive?: boolean
}) {
  const [draft, setDraft] = useState(() => createEveningGateState(initialState))
  const [memoText, setMemoText] = useState('')
  const [preparationLabel, setPreparationLabel] = useState('')
  const step = nextEveningGateStep(draft)
  const stepIndex = step ? EVENING_GATE_STEP_IDS.indexOf(step) : EVENING_GATE_STEP_IDS.length - 1

  const saveDraft = (next: EveningGateState) => {
    const withStart = next.startedAt ? next : { ...next, startedAt: new Date().toISOString() }
    setDraft(withStart)
    onPersist(withStart)
    return withStart
  }

  const completeStep = (current: EveningGateState, currentStep: EveningGateStepId) => {
    saveDraft(markEveningGateStepDone(current, currentStep))
  }

  const completeMemo = (captured: boolean) => {
    const next = { ...draft, memoCaptured: captured || draft.memoCaptured }
    completeStep(next, 'memo')
  }

  const togglePreparation = (id: string) => {
    saveDraft({
      ...draft,
      preparationItems: draft.preparationItems.map(item => (
        item.id === id ? { ...item, done: !item.done } : item
      )),
    })
  }

  const addPreparation = (event: FormEvent) => {
    event.preventDefault()
    const label = preparationLabel.trim()
    if (!label) return
    saveDraft({
      ...draft,
      preparationItems: [
        ...draft.preparationItems,
        { id: crypto.randomUUID(), label: label.slice(0, 80), done: false },
      ],
    })
    setPreparationLabel('')
  }

  const removePreparation = (id: string) => {
    saveDraft({
      ...draft,
      preparationItems: draft.preparationItems.filter(item => item.id !== id),
    })
  }

  const completed = Boolean(draft.completedAt)
  const preparationReady = draft.preparationItems.length > 0
    && draft.preparationItems.every(item => item.done)

  let card: ReactNode
  if (completed) {
    card = (
      <GateCard icon={<Moon size={26} />} eyebrow="Feierabend" title="Abend abgeschlossen">
        <p>Alles für morgen ist vorbereitet. Der letzte Schritt bleibt jetzt: Display aus und Ruhe rein.</p>
        <div className="evening-gate__summary">
          <span><Check size={16} /> {EVENING_GATE_STEP_IDS.length} Schritte abgeschlossen</span>
          {draft.memoCaptured && <span><LockKeyhole size={16} /> Memo gespeichert</span>}
        </div>
        <button type="button" className="primary-button morning-gate__cta" onClick={onClose}>
          Fertig
        </button>
        <button
          type="button"
          className="text-button evening-gate__restart"
          onClick={() => saveDraft(restartEveningGate(draft))}
        >
          <RotateCcw size={15} /> Heute erneut durchgehen
        </button>
      </GateCard>
    )
  } else {
    switch (step) {
      case 'windDown':
        card = (
          <GateCard icon={<Moon size={26} />} eyebrow="Abendmodus" title="Runterkommen">
            <p>Der Tag ist vorbei. Licht ruhiger, Tempo raus, offene Gedanken dürfen für heute liegen bleiben.</p>
            <button type="button" className="primary-button morning-gate__cta" onClick={() => completeStep(draft, 'windDown')}>
              <Moon size={17} /> Abendmodus starten
            </button>
          </GateCard>
        )
        break
      case 'shower':
        card = (
          <GateCard icon={<Droplets size={26} />} eyebrow="Reset" title="Duschen">
            <p>Einmal frisch machen und den Tag körperlich abschließen.</p>
            <button type="button" className="primary-button morning-gate__cta" onClick={() => completeStep(draft, 'shower')}>
              <Check size={17} /> Geduscht · weiter
            </button>
          </GateCard>
        )
        break
      case 'breathing':
        card = (
          <GateCard icon={<Wind size={26} />} eyebrow="3 ruhige Runden" title="Wim-Hof-Atmung">
            <p>Starte deine vertraute Atemroutine und bestätige hier jede abgeschlossene Runde.</p>
            <div className="evening-gate__rounds" aria-live="polite">
              <strong>{draft.breathingRounds}<small>/3</small></strong>
              <span>Runden abgeschlossen</span>
            </div>
            <p className="evening-gate__safety">Nur sitzend oder liegend. Nie im Wasser, unter der Dusche oder beim Fahren.</p>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              onClick={() => {
                const rounds = Math.min(3, draft.breathingRounds + 1)
                const next = { ...draft, breathingRounds: rounds }
                if (rounds === 3) completeStep(next, 'breathing')
                else saveDraft(next)
              }}
            >
              <Wind size={17} /> {draft.breathingRounds >= 2 ? 'Dritte Runde fertig · weiter' : 'Runde fertig'}
            </button>
          </GateCard>
        )
        break
      case 'prepare':
        card = (
          <GateCard icon={<ClipboardCheck size={26} />} eyebrow="Morgen leichter machen" title="Vorbereitungsliste">
            <p>Alles, was morgens Reibung spart, jetzt kurz bereitstellen.</p>
            <ul className="morning-gate__meds evening-gate__prep-list">
              {draft.preparationItems.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.done ? 'morning-gate__med is-taken' : 'morning-gate__med'}
                    onClick={() => togglePreparation(item.id)}
                    aria-pressed={item.done}
                  >
                    <span className="morning-gate__check" aria-hidden="true">
                      {item.done ? <Check size={13} strokeWidth={2.8} /> : <span />}
                    </span>
                    <span><strong>{item.label}</strong></span>
                  </button>
                  <button type="button" className="icon-button" onClick={() => removePreparation(item.id)} aria-label={`${item.label} entfernen`}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <form className="evening-gate__prep-add" onSubmit={addPreparation}>
              <input
                value={preparationLabel}
                onChange={event => setPreparationLabel(event.target.value)}
                maxLength={80}
                placeholder="Eigenen Punkt hinzufügen"
              />
              <button type="submit" className="icon-button" disabled={!preparationLabel.trim()} aria-label="Punkt hinzufügen">
                <Plus size={17} />
              </button>
            </form>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              disabled={!preparationReady}
              onClick={() => completeStep(draft, 'prepare')}
            >
              <Check size={17} /> Alles vorbereitet · weiter
            </button>
          </GateCard>
        )
        break
      case 'preRoll':
        card = (
          <GateCard icon={<Leaf size={26} />} eyebrow="Für morgen" title="Vordrehen">
            <p>Was für morgen bereitliegen soll, jetzt vorbereiten und anschließend weglegen.</p>
            <button type="button" className="primary-button morning-gate__cta" onClick={() => completeStep(draft, 'preRoll')}>
              <Check size={17} /> Vorbereitet · weiter
            </button>
          </GateCard>
        )
        break
      case 'memo':
        card = (
          <GateCard icon={<NotebookPen size={26} />} eyebrow="Kopf leeren" title="Abend-Memo">
            <p>Was soll Life OS behalten, damit du es nicht mit ins Bett nehmen musst?</p>
            <textarea
              className="evening-gate__memo"
              value={memoText}
              onChange={event => setMemoText(event.target.value)}
              maxLength={2_000}
              rows={5}
              placeholder="Gedanke, Erinnerung, Entscheidung…"
              autoFocus
            />
            <div className="evening-gate__memo-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!memoText.trim()}
                onClick={() => {
                  onCaptureMemo(memoText.trim())
                  setMemoText('')
                  completeMemo(true)
                }}
              >
                <NotebookPen size={16} /> Universal Memo
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!memoText.trim()}
                onClick={() => onOpenPrivateNotes(memoText.trim(), () => {
                  setMemoText('')
                  completeMemo(true)
                })}
              >
                <LockKeyhole size={16} /> Privat speichern
              </button>
            </div>
            <button type="button" className="text-button evening-gate__without" onClick={() => completeMemo(false)}>
              Ohne Memo weiter
            </button>
          </GateCard>
        )
        break
      case 'noScreen':
        card = (
          <GateCard icon={<MonitorOff size={26} />} eyebrow="Letzter Schritt" title="No Screen">
            <p>Alles ist festgehalten. Schließe jetzt den Tag – danach Display aus und Handy weg.</p>
            <button
              type="button"
              className="primary-button morning-gate__cta evening-gate__finish"
              onClick={() => {
                const next = finishEveningGate(draft)
                setDraft(next)
                onFinish(next)
              }}
            >
              <MonitorOff size={18} /> Tag schließen · No Screen
            </button>
          </GateCard>
        )
        break
      default:
        card = null
    }
  }

  return (
    <div
      className="morning-gate evening-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evening-gate-title"
      aria-hidden={inactive || undefined}
      inert={inactive || undefined}
    >
      <div className="morning-gate__orbs" aria-hidden="true">
        <span className="morning-gate__orb morning-gate__orb--one" />
        <span className="morning-gate__orb morning-gate__orb--two" />
      </div>
      <header className="morning-gate__top">
        <div>
          <span className="morning-gate__kicker">Evening Gate {completed ? '7/7' : `${stepIndex + 1}/7`}</span>
          <p>{completed ? 'Tag bewusst abgeschlossen' : `Schritt ${stepIndex + 1} von 7 · ${step ? STEP_LABELS[step] : ''}`}</p>
        </div>
        <div className="morning-gate__top-actions">
          <button type="button" className="icon-button" onClick={onClose} aria-label="Abendroutine schließen">
            <X size={18} />
          </button>
        </div>
      </header>
      <ol className="morning-gate__dots" aria-label="Abendfortschritt">
        {EVENING_GATE_STEP_IDS.map((item, index) => (
          <li
            key={item}
            className={item === step ? 'is-current' : draft.done.includes(item) || (completed && index <= stepIndex) ? 'is-done' : undefined}
          />
        ))}
      </ol>
      {card}
    </div>
  )
}
