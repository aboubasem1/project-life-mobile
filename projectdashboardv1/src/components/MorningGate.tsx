import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  Coffee,
  Crown,
  Droplets,
  Flame,
  Heart,
  Mic,
  Moon,
  Pause,
  Pill,
  Play,
  RotateCcw,
  Settings,
  Snowflake,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'
import {
  HEAD_MOODS,
  HEAD_SLEEP_PRESETS,
  HEAD_SLEEP_QUALITY,
} from '../lib/dailyFlow'
import {
  CHECKIN_QUESTION_IDS,
  checkinResolution,
  createTimerState,
  formatRitualClock,
  gratitudeStatements,
  morningRitualMeta,
  speakGerman,
  nextCheckinQuestion,
  completeRitualTimer,
  pauseRitualTimer,
  playRitualChime,
  resetRitualTimer,
  ritualRuleFor,
  startRitualTimer,
  timerRemainingMs,
  type CheckinQuestionId,
  type MorningGateMed,
  type MorningRitualConfig,
  type MorningRitualStepId,
  type RitualTimerState,
  type ShakeRitualStatus,
} from '../lib/morningGate'
import { listenGerman, speechMatchesStatement, speechSupport } from '../lib/voiceRitual'
import { releaseScreenWakeLock, requestScreenWakeLock } from '../lib/wakeLock'

type TimerPhase = 'idle' | 'countdown' | 'running' | 'paused' | 'done'

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  return reduced
}

function RitualTimer({
  seconds,
  label,
  onComplete,
}: {
  seconds: number
  label: string
  onComplete: () => void
}) {
  const [left, setLeft] = useState(seconds)
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const [count, setCount] = useState(3)
  const [pulse, setPulse] = useState(0)
  const doneRef = useRef(false)
  const wakeRef = useRef<Awaited<ReturnType<typeof requestScreenWakeLock>>>(null)
  const armed = phase === 'countdown' || phase === 'running'

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!armed) {
        await releaseScreenWakeLock(wakeRef.current)
        wakeRef.current = null
        return
      }
      const sentinel = await requestScreenWakeLock()
      if (cancelled) {
        await releaseScreenWakeLock(sentinel)
        return
      }
      wakeRef.current = sentinel
    }
    void sync()
    return () => {
      cancelled = true
      void releaseScreenWakeLock(wakeRef.current)
      wakeRef.current = null
    }
  }, [armed])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (navigator.vibrate) navigator.vibrate(40)
    const timer = window.setInterval(() => {
      setCount(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          if (navigator.vibrate) navigator.vibrate([80, 40, 80])
          playRitualChime('done')
          setPhase('running')
          return 0
        }
        if (navigator.vibrate) navigator.vibrate(40)
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => {
      setLeft(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          setPhase('done')
          if (!doneRef.current) {
            doneRef.current = true
            playRitualChime('done')
            if (navigator.vibrate) navigator.vibrate([80, 40, 80])
            window.setTimeout(onComplete, 0)
          }
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, onComplete])

  const startCountdown = () => {
    setLeft(seconds)
    setCount(3)
    setPulse(current => current + 1)
    setPhase('countdown')
  }

  let status: string
  let action: string
  switch (phase) {
    case 'idle':
      status = 'Bereit — starte manuell'
      action = 'Start'
      break
    case 'countdown':
      status = 'Gleich geht’s los'
      action = 'Abbrechen'
      break
    case 'running':
      status = label
      action = 'Pause'
      break
    case 'paused':
      status = 'Pause'
      action = 'Weiter'
      break
    case 'done':
      status = 'Fertig'
      action = 'Fertig'
      break
    default: {
      const _exhaustive: never = phase
      return _exhaustive
    }
  }

  return (
    <div className="morning-timer">
      {phase === 'countdown' ? (
        <strong key={`${count}-${pulse}`} className="morning-timer__count" aria-live="assertive">{count}</strong>
      ) : (
        <strong className="morning-timer__clock">{formatRitualClock(left)}</strong>
      )}
      <span>{status}</span>
      <button
        type="button"
        className="primary-button morning-gate__cta"
        onClick={() => {
          if (phase === 'idle') startCountdown()
          else if (phase === 'countdown') {
            setPhase('idle')
            setCount(3)
          } else if (phase === 'running') setPhase('paused')
          else if (phase === 'paused') setPhase('running')
        }}
        disabled={phase === 'done'}
      >
        {phase === 'running' ? <Pause size={17} /> : <Play size={17} />}
        {action}
      </button>
    </div>
  )
}

function ChoiceStack({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[]
  selected?: string
  onSelect: (value: string) => void
}) {
  return (
    <div className="mg-choices" role="listbox">
      {options.map(option => (
        <button
          type="button"
          key={option}
          className={selected === option ? 'mg-choice is-selected' : 'mg-choice'}
          aria-pressed={selected === option}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export type MorningWeightView = {
  todayKg: number | null
  imported: boolean
  sourceLabel: string | null
  deltaLabel: string | null
  goalKg: number | null
  startKg: number | null
  progress: number | null
  remainingLabel: string | null
  trendLabel: string | null
  consistencyLabel: string | null
  points: number[]
}

export type MorningDailyItem = {
  id: string
  label: string
  done: boolean
  skipped?: boolean
}

export function MorningGate({
  step,
  finale,
  stepIndex,
  stepCount,
  steps,
  doneSteps,
  skippedSteps,
  name,
  medications,
  supplements,
  dailies,
  proteinShake,
  shakeStatus,
  gratitudeLines,
  gratitudeCursor,
  commitment,
  goals,
  weight,
  coldSeconds,
  coldTimer,
  winnerLine,
  mood,
  sleepQuality,
  sleepDuration,
  dreamed,
  suggestedSleep,
  checkinSkipped,
  config,
  anchors,
  anchorsDone,
  pushups,
  ko,
  selfcareChecked,
  summary,
  onHeadRecovery,
  onSkipCheckin,
  onToggleMed,
  onSelectDose,
  onSkipMed,
  onConfirmAllPendingMeds,
  onToggleSupplement,
  onSkipSupplement,
  onConfirmAllSupplements,
  onShakeChoice,
  onToggleDaily,
  onSkipDaily,
  onGratitudeResult,
  onConfirmCommitment,
  onEditCommitment,
  onConfirmWeight,
  onCompleteWeight,
  onSetColdSeconds,
  onColdTimer,
  onConfirmColdShower,
  onConfirmWinner,
  onPickEnergy,
  onCompleteTimer,
  onSetPushups,
  onSetKo,
  onToggleSelfcare,
  onCompleteStep,
  onSkipStep,
  onBack,
  canBack,
  onExit,
  onOpenSettings,
  onClosePreview,
  onStartDay,
  onSkipToday,
  onReopenStep,
}: {
  step: MorningRitualStepId
  finale: boolean
  stepIndex: number
  stepCount: number
  steps: Array<{ id: MorningRitualStepId; label: string }>
  doneSteps: MorningRitualStepId[]
  skippedSteps: MorningRitualStepId[]
  name: string
  medications: Array<MorningGateMed & { doseOptions: string[]; selectedDose?: string }>
  supplements: Array<{ id: string; name: string; detail?: string; taken: boolean; skipped: boolean }>
  dailies: MorningDailyItem[]
  proteinShake: boolean
  shakeStatus: ShakeRitualStatus
  gratitudeLines: string[]
  gratitudeCursor: number
  commitment: { text: string; imported: boolean; ambiguous: boolean; title?: string }
  goals: Array<{ id: string; title: string }>
  weight: MorningWeightView
  coldSeconds: number
  coldTimer: RitualTimerState | null
  winnerLine: string
  mood: string
  sleepQuality: string
  sleepDuration: string
  dreamed?: boolean
  suggestedSleep?: string
  checkinSkipped: CheckinQuestionId[]
  config: MorningRitualConfig
  anchors: string[]
  anchorsDone: boolean[]
  pushups: number
  ko: number
  selfcareChecked: string[]
  summary: { completed: string[]; skipped: string[]; health: string[] }
  onHeadRecovery: (patch: { mood?: string; sleepQuality?: string; sleepDuration?: string; dreamed?: boolean }) => void
  onSkipCheckin: (id: CheckinQuestionId) => void
  onToggleMed: (id: string) => void
  onSelectDose: (id: string, dose: string) => void
  onSkipMed: (id: string) => void
  onConfirmAllPendingMeds: () => void
  onToggleSupplement: (id: string) => void
  onSkipSupplement: (id: string) => void
  onConfirmAllSupplements: () => void
  onShakeChoice: (choice: 'taken' | 'later' | 'skipped') => void
  onToggleDaily: (id: string) => void
  onSkipDaily: (id: string) => void
  onGratitudeResult: (index: number, outcome: 'confirmed' | 'skipped') => void
  onConfirmCommitment: (text?: string) => void
  onEditCommitment: (text: string) => void
  onConfirmWeight: (kg: number, mode: 'import' | 'manual') => boolean
  onCompleteWeight: () => void
  onSetColdSeconds: (seconds: number) => void
  onColdTimer: (timer: RitualTimerState) => void
  onConfirmColdShower: () => void
  onConfirmWinner: () => void
  onPickEnergy: (energy: 'low' | 'okay' | 'high') => void
  onCompleteTimer: (step: 'prayer') => void
  onSetPushups: (value: number) => void
  onSetKo: (value: number) => void
  onToggleSelfcare: (id: string) => void
  onCompleteStep: (step: MorningRitualStepId) => void
  onSkipStep: (step: MorningRitualStepId) => void
  onBack: () => void
  canBack: boolean
  onExit: () => void
  onOpenSettings: () => void
  onClosePreview?: () => void
  onStartDay: () => void
  onSkipToday: () => void
  onReopenStep: (step: MorningRitualStepId) => void
}) {
  const reduced = useReducedMotion()
  const lockRef = useRef(false)
  const [checkinCursor, setCheckinCursor] = useState<CheckinQuestionId | null>(null)
  const [sleepEditing, setSleepEditing] = useState(false)
  const [weightDraft, setWeightDraft] = useState(() => (
    weight.todayKg != null ? String(weight.todayKg).replace('.', ',') : ''
  ))
  const [weightReveal, setWeightReveal] = useState<number | null>(null)
  const [weightCorrecting, setWeightCorrecting] = useState(false)
  const [gratitudeDraft, setGratitudeDraft] = useState('')
  const [gratitudeTyping, setGratitudeTyping] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceNote, setVoiceNote] = useState('')
  const [commitmentEditing, setCommitmentEditing] = useState(false)
  const [commitmentDraft, setCommitmentDraft] = useState(commitment.text)
  const [essentialsCursor, setEssentialsCursor] = useState(0)
  const [showerConfirmed, setShowerConfirmed] = useState(false)
  const [customSeconds, setCustomSeconds] = useState(String(coldSeconds))
  const [now, setNow] = useState(() => Date.now())
  const listenRef = useRef<{ stop: () => void } | null>(null)
  const timerRef = useRef(onColdTimer)
  const lines = gratitudeLines.length > 0 ? gratitudeLines : gratitudeStatements(config.gratitudeText)
  const support = speechSupport()

  const guard = (action: () => void) => {
    if (lockRef.current) return
    lockRef.current = true
    action()
    window.setTimeout(() => {
      lockRef.current = false
    }, reduced ? 0 : 280)
  }

  useEffect(() => {
    timerRef.current = onColdTimer
  }, [onColdTimer])

  const timer = coldTimer && coldTimer.durationSec === coldSeconds
    ? coldTimer
    : createTimerState(coldSeconds)
  const remainingMs = timerRemainingMs(timer, now)
  const timerDone = remainingMs <= 0 && (timer.accumulatedMs > 0 || timer.running)

  useEffect(() => {
    if (step !== 'coldShower' || !timer.running) return
    const tick = () => {
      const currentNow = Date.now()
      setNow(currentNow)
      if (timerRemainingMs(timer, currentNow) <= 0) {
        timerRef.current(completeRitualTimer(timer))
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    const onVisible = () => tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [step, timer])

  useEffect(() => () => {
    listenRef.current?.stop()
  }, [])

  const derivedQuestion = nextCheckinQuestion({
    mood,
    sleepQuality,
    sleepDuration,
    dreamed,
    skipped: checkinSkipped,
  })
  const question = checkinCursor ?? derivedQuestion

  const medsLeft = medications.filter(item => !item.taken && !item.skipped)
  const supplementsLeft = supplements.filter(item => !item.taken && !item.skipped)
  const dailiesLeft = dailies.filter(item => !item.done && !item.skipped)
  const shakeSettled = proteinShake || shakeStatus === 'taken' || shakeStatus === 'later' || shakeStatus === 'skipped'
  const sections = [
    medsLeft.length > 0,
    supplementsLeft.length > 0,
    !shakeSettled,
    dailiesLeft.length > 0,
  ]
  const activeSection = sections.findIndex((open, index) => open && index >= essentialsCursor)
  const sectionIndex = activeSection === -1 ? essentialsCursor : activeSection

  const meta = morningRitualMeta(step, config)
  const passed = steps.filter(item => doneSteps.includes(item.id) || skippedSteps.includes(item.id)).length
  const progress = finale ? 1 : stepCount === 0 ? 0 : Math.min(1, (passed + 0.35) / stepCount)
  const coldPresets = [30, 60, 90, 120]

  const skipCurrent = () => {
    if (finale) return
    if (step === 'headRecovery' && question) {
      onSkipCheckin(question)
      setCheckinCursor(null)
      return
    }
    if (step === 'medsShake') {
      if (sectionIndex === 0 && medsLeft[0]) onSkipMed(medsLeft[0].id)
      else if (sectionIndex === 1 && supplementsLeft[0]) onSkipSupplement(supplementsLeft[0].id)
      else if (sectionIndex === 2) onShakeChoice('skipped')
      else if (sectionIndex === 3 && dailiesLeft[0]) onSkipDaily(dailiesLeft[0].id)
      else onSkipStep(step)
      return
    }
    if (step === 'gratitude') {
      onGratitudeResult(Math.min(lines.length - 1, Math.max(0, gratitudeCursor)), 'skipped')
      return
    }
    onSkipStep(step)
  }

  const statementIndex = Math.min(lines.length - 1, Math.max(0, gratitudeCursor))
  const statement = lines[statementIndex] ?? ''

  const speakLine = () => {
    if (!support.synthesis) {
      setVoiceNote('Vorlesen ist hier nicht verfügbar. Du kannst den Satz selbst sprechen oder bestätigen.')
      return
    }
    speakGerman(statement, () => undefined)
  }

  useEffect(() => {
    if (step !== 'gratitude' || !statement || reduced || !support.synthesis) return undefined
    return speakGerman(statement, () => undefined)
  }, [step, statement, reduced, support.synthesis])

  const startListen = () => {
    setVoiceNote('')
    const session = listenGerman({
      onTranscript: (transcript, final) => {
        if (!final && transcript) setVoiceNote(transcript)
        if (final || speechMatchesStatement(transcript, statement)) {
          if (speechMatchesStatement(transcript, statement)) {
            setListening(false)
            listenRef.current?.stop()
            if (navigator.vibrate) navigator.vibrate(30)
            playRitualChime('done')
            guard(() => onGratitudeResult(statementIndex, 'confirmed'))
          } else if (final) {
            setVoiceNote('Fast. Du kannst es wiederholen, bestätigen oder eintippen.')
          }
        }
      },
      onError: message => {
        setListening(false)
        setVoiceNote(message)
      },
      onEnd: () => setListening(false),
    })
    if (!session) {
      setVoiceNote('Spracherkennung ist auf diesem Gerät nicht verfügbar.')
      return
    }
    listenRef.current = session
    setListening(true)
  }

  const innerBack = () => {
    if (step === 'headRecovery' && question) {
      const index = CHECKIN_QUESTION_IDS.indexOf(question)
      if (index > 0) {
        setCheckinCursor(CHECKIN_QUESTION_IDS[index - 1])
        return
      }
    }
    if (step === 'medsShake' && sectionIndex > 0) {
      setEssentialsCursor(sectionIndex - 1)
      return
    }
    if (canBack) onBack()
  }

  const questionTitle = (() => {
    if (finale) return 'Bereit für deinen Tag.'
    if (step === 'headRecovery') {
      switch (question) {
        case 'mood':
          return 'Wie fühlst du dich heute?'
        case 'recovery':
          return 'Wie erholt fühlst du dich?'
        case 'sleep':
          return 'Wie lange hast du geschlafen?'
        case 'dream':
          return 'Geträumt?'
        case null:
          return 'Stimmung & Erholung'
        default: {
          const _exhaustive: never = question
          return _exhaustive
        }
      }
    }
    if (step === 'weight') return weightReveal != null ? 'Dein Gewicht' : 'Zeit für deinen Body Check.'
    if (step === 'gratitude') return 'Dankbarkeit'
    if (step === 'commitment') return 'Dein Satz für heute'
    if (step === 'medsShake') return 'Morning Essentials'
    if (step === 'coldShower' || step === 'winnerPose') return 'Winner Mode'
    return meta.label
  })()

  const choose = (commit: () => void) => {
    window.setTimeout(commit, reduced ? 0 : 180)
  }

  const answerCheckin = (patch: { mood?: string; sleepQuality?: string; sleepDuration?: string; dreamed?: boolean }) => {
    setCheckinCursor(null)
    onHeadRecovery(patch)
  }

  const stage = (() => {
    if (finale) {
      return (
        <div className="mg-q">
          <p>{name.trim() ? `${name.trim()}, dein Morgen ist festgehalten.` : 'Dein Morgen ist festgehalten.'}</p>
          <div className="mg-summary">
            <div>
              <span>Erledigt</span>
              <strong>{summary.completed.length === 0 ? 'Nichts abgeschlossen' : summary.completed.join(' · ')}</strong>
            </div>
            <div>
              <span>Übersprungen</span>
              <strong>{summary.skipped.length === 0 ? 'Nichts übersprungen' : summary.skipped.join(' · ')}</strong>
            </div>
            <div>
              <span>Bestätigt</span>
              <strong>{summary.health.length === 0 ? 'Keine Gesundheitsaktion bestätigt' : summary.health.join(' · ')}</strong>
            </div>
          </div>
          {skippedSteps.length > 0 && (
            <div className="mg-choices">
              {skippedSteps.map(id => (
                <button type="button" key={id} className="mg-choice" onClick={() => onReopenStep(id)}>
                  {morningRitualMeta(id, config).label} nachholen
                </button>
              ))}
            </div>
          )}
          <button type="button" className="primary-button morning-gate__cta" onClick={onStartDay}>
            Tag starten
          </button>
          <button type="button" className="text-button" onClick={onSkipToday}>Heute aussetzen</button>
        </div>
      )
    }

    switch (step) {
      case 'headRecovery':
        if (!question) {
          const resolution = checkinResolution({ mood, sleepQuality, sleepDuration, dreamed, skipped: checkinSkipped })
          return (
            <div className="mg-q">
              <p>{resolution === 'completed' ? 'Check-in gespeichert.' : 'Ein Teil bleibt offen. Nichts wurde erfunden.'}</p>
              <button
                type="button"
                className="primary-button morning-gate__cta"
                onClick={() => (resolution === 'skipped' ? onSkipStep('headRecovery') : onCompleteStep('headRecovery'))}
              >
                Weiter
              </button>
            </div>
          )
        }
        if (question === 'mood') {
          return (
            <div className="mg-q" key="mood">
              <ChoiceStack
                options={HEAD_MOODS}
                selected={mood || undefined}
                onSelect={value => choose(() => answerCheckin({ mood: value }))}
              />
            </div>
          )
        }
        if (question === 'recovery') {
          return (
            <div className="mg-q" key="recovery">
              <ChoiceStack
                options={HEAD_SLEEP_QUALITY}
                selected={sleepQuality || undefined}
                onSelect={value => choose(() => answerCheckin({ sleepQuality: value }))}
              />
            </div>
          )
        }
        if (question === 'sleep') {
          const suggestion = suggestedSleep || sleepDuration
          if (suggestion && !sleepEditing) {
            return (
              <div className="mg-q" key="sleep-confirm">
                <p className="mg-kicker">Bereits erfasst{suggestedSleep && suggestedSleep !== sleepDuration ? ' aus Bettzeit und Aufstehen' : ''}</p>
                <strong className="mg-figure">{suggestion}</strong>
                <button type="button" className="primary-button morning-gate__cta" onClick={() => choose(() => answerCheckin({ sleepDuration: suggestion }))}>
                  Stimmt
                </button>
                <button type="button" className="secondary-button" onClick={() => setSleepEditing(true)}>
                  Korrigieren
                </button>
              </div>
            )
          }
          return (
            <div className="mg-q" key="sleep-edit">
              <ChoiceStack
                options={HEAD_SLEEP_PRESETS}
                selected={sleepDuration || undefined}
                onSelect={value => choose(() => answerCheckin({ sleepDuration: value }))}
              />
            </div>
          )
        }
        return (
          <div className="mg-q" key="dream">
            <ChoiceStack
              options={['Ja', 'Nein']}
              selected={dreamed === true ? 'Ja' : dreamed === false ? 'Nein' : undefined}
              onSelect={value => choose(() => answerCheckin({ dreamed: value === 'Ja' }))}
            />
          </div>
        )
      case 'weight': {
        const parsed = Number(weightDraft.replace(',', '.'))
        const valid = Number.isFinite(parsed) && parsed >= 35 && parsed <= 200
        if (weightReveal != null) {
          return (
            <div className="mg-q mg-reveal">
              <strong className="mg-figure">{weightReveal.toFixed(1)} kg</strong>
              {weight.deltaLabel && <p>{weight.deltaLabel}</p>}
              {weight.goalKg != null && weight.progress != null && (
                <div className="mg-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(weight.progress * 100)}>
                  <span style={{ width: `${Math.round(weight.progress * 100)}%` }} />
                </div>
              )}
              <ul className="mg-facts">
                {weight.goalKg != null && <li>Ziel {weight.goalKg.toFixed(1)} kg</li>}
                {weight.remainingLabel && <li>{weight.remainingLabel}</li>}
                {weight.trendLabel && <li>{weight.trendLabel}</li>}
                {weight.consistencyLabel && <li>{weight.consistencyLabel}</li>}
              </ul>
              {weight.points.length > 1 && (
                <div className="mg-bars" aria-hidden="true">
                  {weight.points.map((point, index) => (
                    <span key={`${point}-${index}`} style={{ height: `${Math.max(12, Math.min(100, point))}%` }} />
                  ))}
                </div>
              )}
              <button type="button" className="primary-button morning-gate__cta" onClick={onCompleteWeight}>
                Weiter
              </button>
            </div>
          )
        }
        if (weight.todayKg != null && !weightCorrecting) {
          return (
            <div className="mg-q">
              <p>{weight.imported ? `Übernommen${weight.sourceLabel ? ` · ${weight.sourceLabel}` : ''}.` : 'Heute schon erfasst.'}</p>
              <strong className="mg-figure">{weight.todayKg.toFixed(1)} kg</strong>
              <button
                type="button"
                className="primary-button morning-gate__cta"
                onClick={() => {
                  const ok = onConfirmWeight(weight.todayKg!, 'import')
                  if (ok) setWeightReveal(weight.todayKg)
                }}
              >
                Stimmt
              </button>
              <button type="button" className="secondary-button" onClick={() => {
                setWeightDraft(weight.todayKg != null ? String(weight.todayKg).replace('.', ',') : '')
                setWeightCorrecting(true)
              }}>
                Korrigieren
              </button>
            </div>
          )
        }
        return (
          <div className="mg-q">
            <label className="text-field">
              <span>kg</span>
              <input
                inputMode="decimal"
                value={weightDraft}
                placeholder="z. B. 72,4"
                onChange={event => setWeightDraft(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              disabled={!valid}
              onClick={() => {
                if (!valid) return
                const kg = Math.round(parsed * 10) / 10
                const ok = onConfirmWeight(kg, 'manual')
                if (ok) setWeightReveal(kg)
              }}
            >
              Speichern
            </button>
          </div>
        )
      }
      case 'gratitude':
        return (
          <div className="mg-q mg-voice">
            <p className="mg-kicker">Satz {statementIndex + 1} von {lines.length}</p>
            <blockquote className="morning-gate__script">{statement}</blockquote>
            <button type="button" className={listening ? 'mg-mic is-live' : 'mg-mic'} onClick={startListen} aria-pressed={listening}>
              <Mic size={22} />
              {listening ? 'Ich höre zu' : 'Jetzt sprechen'}
            </button>
            {voiceNote && <p>{voiceNote}</p>}
            {gratitudeTyping ? (
              <label className="text-field">
                <span>Dein Satz</span>
                <input value={gratitudeDraft} onChange={event => setGratitudeDraft(event.target.value)} />
              </label>
            ) : null}
            <div className="morning-gate__row">
              <button type="button" className="secondary-button" onClick={speakLine}>Nochmal hören</button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => guard(() => onGratitudeResult(statementIndex, 'confirmed'))}
              >
                Bestätigen
              </button>
            </div>
            <div className="morning-gate__row">
              <button type="button" className="text-button" onClick={() => setGratitudeTyping(value => !value)}>
                Text eingeben
              </button>
              <button type="button" className="text-button" onClick={startListen}>Erneut versuchen</button>
            </div>
            {gratitudeTyping && gratitudeDraft.trim() && speechMatchesStatement(gratitudeDraft, statement) && (
              <button type="button" className="primary-button morning-gate__cta" onClick={() => guard(() => onGratitudeResult(statementIndex, 'confirmed'))}>
                Eingabe übernehmen
              </button>
            )}
            {gratitudeTyping && gratitudeDraft.trim() && !speechMatchesStatement(gratitudeDraft, statement) && (
              <p>Der Text weicht stark ab. Bestätigen geht trotzdem, ohne ihn als gesprochen zu speichern.</p>
            )}
          </div>
        )
      case 'commitment':
        return (
          <div className="mg-q">
            {commitment.imported && commitment.title && <p className="mg-kicker">Aus deinem Dokument · {commitment.title}</p>}
            {commitment.ambiguous && <p className="mg-kicker">Mehrere Texte gefunden. Dieser Satz kommt aus den Ritual-Einstellungen.</p>}
            {!commitment.imported && !commitment.ambiguous && <p className="mg-kicker">Dein Satz aus den Ritual-Einstellungen.</p>}
            <blockquote className="morning-gate__script">{commitment.text}</blockquote>
            {goals.length > 0 && (
              <ul className="mg-facts">
                {goals.slice(0, 3).map(goal => <li key={goal.id}>{goal.title}</li>)}
              </ul>
            )}
            {commitmentEditing && (
              <label className="text-field">
                <span>Text anpassen</span>
                <textarea rows={4} maxLength={800} value={commitmentDraft} onChange={event => setCommitmentDraft(event.target.value)} />
              </label>
            )}
            <button
              type="button"
              className="primary-button morning-gate__cta"
              onClick={() => guard(() => {
                if (commitmentEditing && commitmentDraft.trim() && commitmentDraft.trim() !== commitment.text) {
                  onEditCommitment(commitmentDraft.trim())
                }
                onConfirmCommitment(commitmentEditing ? commitmentDraft.trim() : undefined)
              })}
            >
              <Heart size={17} />
              Ich gebe heute mein Bestes.
            </button>
            <button type="button" className="text-button" onClick={() => setCommitmentEditing(value => !value)}>
              Text anpassen
            </button>
          </div>
        )
      case 'medsShake': {
        if (sectionIndex === 0 && medsLeft[0]) {
          const med = medsLeft[0]
          const doses = med.doseOptions
          const needsChoice = doses.length > 1
          return (
            <div className="mg-q" key={med.id}>
              <p className="mg-kicker">Medikament</p>
              <h3>{med.name || 'Medikament'}</h3>
              {needsChoice ? (
                <ChoiceStack
                  options={doses}
                  selected={med.selectedDose}
                  onSelect={dose => onSelectDose(med.id, dose)}
                />
              ) : (
                <p>{doses[0] || med.dosage || 'Keine Dosis hinterlegt.'}</p>
              )}
              <button
                type="button"
                className="primary-button morning-gate__cta"
                disabled={needsChoice && !med.selectedDose}
                onClick={() => onToggleMed(med.id)}
              >
                <Check size={17} />
                Eingenommen
              </button>
              {medsLeft.length > 1 && (
                <button type="button" className="secondary-button" onClick={onConfirmAllPendingMeds}>
                  Alle genommen
                </button>
              )}
            </div>
          )
        }
        if (sectionIndex <= 1 && supplementsLeft[0]) {
          const item = supplementsLeft[0]
          return (
            <div className="mg-q" key={item.id}>
              <p className="mg-kicker">Supplement</p>
              <h3>{item.name}</h3>
              {item.detail && <p>{item.detail}</p>}
              <button type="button" className="primary-button morning-gate__cta" onClick={() => onToggleSupplement(item.id)}>
                Genommen
              </button>
              {supplementsLeft.length > 1 && (
                <button type="button" className="secondary-button" onClick={onConfirmAllSupplements}>
                  Alle genommen
                </button>
              )}
            </div>
          )
        }
        if (!shakeSettled) {
          return (
            <div className="mg-q">
              <p className="mg-kicker">{config.shakeMeal.label}</p>
              <ul className="mg-facts">
                <li>{config.shakeMeal.calories} kcal</li>
                <li>{config.shakeMeal.proteinGrams} g Protein</li>
                <li>{config.shakeMeal.fatGrams} g Fett</li>
                <li>{config.shakeMeal.carbsGrams} g Kohlenhydrate</li>
              </ul>
              <button type="button" className="primary-button morning-gate__cta" onClick={() => onShakeChoice('taken')}>
                <Coffee size={17} />
                Shake getrunken
              </button>
              <div className="morning-gate__row">
                <button type="button" className="secondary-button" onClick={() => onShakeChoice('later')}>Noch nicht</button>
                <button type="button" className="secondary-button" onClick={() => onShakeChoice('later')}>Später</button>
              </div>
            </div>
          )
        }
        if (dailiesLeft[0]) {
          const daily = dailiesLeft[0]
          return (
            <div className="mg-q" key={daily.id}>
              <p className="mg-kicker">Daily</p>
              <h3>{daily.label}</h3>
              <button type="button" className="primary-button morning-gate__cta" onClick={() => onToggleDaily(daily.id)}>
                Erledigt
              </button>
            </div>
          )
        }
        return (
          <div className="mg-q">
            <p>Essentials sind durch.</p>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              onClick={() => (shakeStatus === 'taken' || proteinShake ? onCompleteStep('medsShake') : onSkipStep('medsShake'))}
            >
              Weiter
            </button>
          </div>
        )
      }
      case 'coldShower': {
        const displaySeconds = Math.ceil(remainingMs / 1000)
        const radius = 86
        const circumference = 2 * Math.PI * radius
        const fraction = timer.durationSec === 0 ? 0 : 1 - remainingMs / (timer.durationSec * 1000)
        return (
          <div className="mg-q">
            <p className="mg-kicker">Kalte Dusche</p>
            {!timer.running && !timerDone && (
              <div className="mg-presets">
                {coldPresets.map(seconds => (
                  <button
                    type="button"
                    key={seconds}
                    className={coldSeconds === seconds ? 'mg-choice is-selected' : 'mg-choice'}
                    onClick={() => {
                      setCustomSeconds(String(seconds))
                      onSetColdSeconds(seconds)
                    }}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            )}
            {!timer.running && !timerDone && (
              <label className="text-field">
                <span>Eigene Sekunden</span>
                <input
                  inputMode="numeric"
                  value={customSeconds}
                  onChange={event => setCustomSeconds(event.target.value)}
                  onBlur={() => {
                    const next = Number(customSeconds)
                    if (Number.isFinite(next)) onSetColdSeconds(Math.min(600, Math.max(15, Math.round(next))))
                  }}
                />
              </label>
            )}
            <div className="mg-ring" aria-live="polite">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r={radius} />
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, fraction)))}
                />
              </svg>
              <strong>{formatRitualClock(displaySeconds)}</strong>
            </div>
            {timerDone && !showerConfirmed && (
              <>
                <p>Zeit um. Nur bestätigen, wenn du wirklich kalt geduscht hast.</p>
                <button type="button" className="primary-button morning-gate__cta" onClick={() => {
                  setShowerConfirmed(true)
                  onConfirmColdShower()
                }}>
                  Dusche genommen
                </button>
              </>
            )}
            {!timerDone && (
              <div className="morning-gate__row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onColdTimer(timer.running ? pauseRitualTimer(timer, Date.now()) : startRitualTimer(timer, Date.now()))}
                >
                  {timer.running ? <Pause size={17} /> : <Play size={17} />}
                  {timer.running ? 'Pause' : timer.accumulatedMs > 0 ? 'Weiter' : 'Start'}
                </button>
                <button type="button" className="secondary-button" onClick={() => onColdTimer(resetRitualTimer(timer))}>
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>
            )}
          </div>
        )
      }
      case 'winnerPose':
        return (
          <div className="mg-q">
            <p className="mg-kicker">Abschluss</p>
            <blockquote className="morning-gate__script">{winnerLine}</blockquote>
            <button type="button" className="primary-button morning-gate__cta" onClick={() => guard(onConfirmWinner)}>
              <Crown size={17} />
              Winner Mode
            </button>
          </div>
        )
      case 'prayer':
        return (
          <>
            <p>{ritualRuleFor(step, config)}</p>
            <RitualTimer key={config.prayerSeconds} seconds={config.prayerSeconds} label="In Ruhe bleiben" onComplete={() => onCompleteTimer('prayer')} />
          </>
        )
      case 'energy':
        return (
          <ChoiceStack
            options={['Niedrig', 'Okay', 'Gut']}
            onSelect={value => {
              const energy = value === 'Niedrig' ? 'low' : value === 'Gut' ? 'high' : 'okay'
              onPickEnergy(energy)
            }}
          />
        )
      case 'todos':
        return (
          <>
            <p>{ritualRuleFor(step, config)}</p>
            {anchors.length === 0 ? <p className="morning-gate__empty">Noch keine Todos.</p> : (
              <ul className="morning-gate__meds">
                {anchors.map((title, index) => (
                  <li key={`${title}-${index}`}><span>{anchorsDone[index] ? 'Erledigt' : 'Offen'} · {title}</span></li>
                ))}
              </ul>
            )}
            <button type="button" className="primary-button morning-gate__cta" onClick={() => onCompleteStep('todos')}>Gesehen</button>
          </>
        )
      case 'workout':
        return (
          <>
            <p>{ritualRuleFor(step, config)}</p>
            <button type="button" className="morning-rep" onClick={() => onSetPushups(Math.min(config.pushupTarget, pushups + 1))}>
              <strong>{pushups}</strong>
              <span>Pushups von {config.pushupTarget} · KO {ko}/{config.koTarget}</span>
            </button>
            <button type="button" className="primary-button morning-gate__cta" onClick={() => {
              onSetKo(config.koTarget)
              onCompleteStep('workout')
            }}>
              Workout fertig
            </button>
          </>
        )
      case 'postShower':
        return (
            <RitualTimer
            key={config.hotShowerSeconds}
            seconds={config.hotShowerSeconds}
            label="Dusche"
            onComplete={() => onCompleteStep('postShower')}
          />
        )
      case 'selfcare': {
        const nextItem = config.selfcareItems.find(item => !selfcareChecked.includes(item.id))
        return (
          <>
            {nextItem ? <p>{nextItem.label}</p> : <p>Selfcare abgeschlossen.</p>}
            {nextItem && (
              <button type="button" className="primary-button morning-gate__cta" onClick={() => onToggleSelfcare(nextItem.id)}>
                Erledigt
              </button>
            )}
            <button type="button" className="secondary-button" onClick={() => onCompleteStep('selfcare')}>Weiter</button>
          </>
        )
      }
      case 'letsGo':
        return (
          <button type="button" className="primary-button morning-gate__cta morning-gate__cta--go" onClick={() => onCompleteStep('letsGo')}>
            LETS GO
          </button>
        )
      default: {
        const _exhaustive: never = step
        return _exhaustive
      }
    }
  })()

  const multi = step === 'headRecovery' || step === 'medsShake' || step === 'gratitude'

  return (
    <div className="morning-gate" role="dialog" aria-modal="true" aria-labelledby="morning-gate-title">
      <div className="morning-gate__orbs" aria-hidden="true">
        <span className="morning-gate__orb morning-gate__orb--one" />
        <span className="morning-gate__orb morning-gate__orb--two" />
      </div>
      <div className="morning-gate__shell">
        <header className="morning-gate__top">
          <div>
            <span className="morning-gate__kicker">{finale ? 'Abschluss' : meta.label}</span>
            <p>{finale ? 'Morgen festgehalten' : `Schritt ${Math.min(stepCount, stepIndex + 1)} von ${stepCount}`}</p>
          </div>
          <div className="morning-gate__top-actions">
            <button type="button" className="icon-button" onClick={innerBack} disabled={!canBack && !(step === 'headRecovery' && question && CHECKIN_QUESTION_IDS.indexOf(question) > 0) && !(step === 'medsShake' && sectionIndex > 0)} aria-label="Zurück">
              <ChevronLeft size={18} />
            </button>
            {onClosePreview && (
              <button type="button" className="icon-button" onClick={onClosePreview} aria-label="Vorschau schließen">
                <X size={18} />
              </button>
            )}
            <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Einstellungen öffnen">
              <Settings size={18} />
            </button>
          </div>
        </header>
        <div className="mg-progress" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <section className="morning-gate__card" key={finale ? 'finale' : step}>
          <div className="morning-gate__icon" aria-hidden="true">
            {step === 'headRecovery' ? <Moon size={26} /> : step === 'weight' ? <Flame size={26} /> : step === 'gratitude' ? <Sparkles size={26} /> : step === 'commitment' ? <Heart size={26} /> : step === 'medsShake' ? <Pill size={26} /> : step === 'coldShower' ? <Snowflake size={26} /> : step === 'winnerPose' ? <Crown size={26} /> : step === 'selfcare' ? <Sun size={26} /> : step === 'postShower' ? <Droplets size={26} /> : <Check size={26} />}
          </div>
          <h2 id="morning-gate-title">{questionTitle}</h2>
          {stage}
        </section>
        {!finale && (
          <div className="mg-nav">
            <button type="button" className="text-button morning-gate__skip" onClick={skipCurrent}>
              Überspringen
            </button>
            {multi && (
              <button type="button" className="text-button" onClick={() => onSkipStep(step)}>
                Schritt überspringen
              </button>
            )}
            <button type="button" className="text-button" onClick={onExit}>
              Später fortsetzen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
