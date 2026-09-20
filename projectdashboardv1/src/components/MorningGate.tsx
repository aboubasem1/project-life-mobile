import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Coffee,
  Crown,
  Droplets,
  Flame,
  Heart,
  Pause,
  Pill,
  Play,
  Settings,
  Snowflake,
  Sparkles,
  Sun,
} from 'lucide-react'
import {
  formatRitualClock,
  morningRitualMeta,
  playRitualChime,
  ritualRuleFor,
  type MorningGateMed,
  type MorningRitualConfig,
  type MorningRitualStepId,
  type MorningSelfcareItem,
} from '../lib/morningGate'
import { releaseScreenWakeLock, requestScreenWakeLock } from '../lib/wakeLock'

type TimerPhase = 'idle' | 'countdown' | 'running' | 'paused' | 'done'

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
    setLeft(seconds)
    setPhase('idle')
    setCount(3)
    setPulse(0)
    doneRef.current = false
  }, [seconds])

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
        <strong
          key={`${count}-${pulse}`}
          className="morning-timer__count"
          aria-live="assertive"
        >
          {count}
        </strong>
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
          }
          else if (phase === 'running') setPhase('paused')
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

function CheckRow({
  done,
  label,
  detail,
  onToggle,
}: {
  done: boolean
  label: string
  detail?: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={done ? 'morning-gate__med is-taken' : 'morning-gate__med'}
      onClick={onToggle}
      aria-pressed={done}
    >
      <span className="morning-gate__check" aria-hidden="true">
        {done ? <Check size={16} strokeWidth={2.6} /> : <span />}
      </span>
      <span>
        <strong>{label}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </button>
  )
}

export function MorningGate({
  step,
  stepIndex,
  stepCount,
  name,
  medications,
  proteinShake,
  gratitudeText,
  config,
  anchors,
  anchorsDone,
  pushups,
  ko,
  selfcareChecked,
  onToggleMed,
  onConfirmAllMeds,
  onToggleProtein,
  onCompleteGratitude,
  onPickEnergy,
  onCompleteTimer,
  onSetPushups,
  onSetKo,
  onToggleSelfcare,
  onCompleteStep,
  onSkipToday,
  onOpenSettings,
}: {
  step: MorningRitualStepId
  stepIndex: number
  stepCount: number
  name: string
  medications: MorningGateMed[]
  proteinShake: boolean
  gratitudeText: string
  config: MorningRitualConfig
  anchors: string[]
  anchorsDone: boolean[]
  pushups: number
  ko: number
  selfcareChecked: string[]
  onToggleMed: (id: string) => void
  onConfirmAllMeds: () => void
  onToggleProtein: () => void
  onCompleteGratitude: () => void
  onPickEnergy: (energy: 'low' | 'okay' | 'high') => void
  onCompleteTimer: (step: 'coldShower' | 'winnerPose' | 'prayer') => void
  onSetPushups: (value: number) => void
  onSetKo: (value: number) => void
  onToggleSelfcare: (id: string) => void
  onCompleteStep: (step: MorningRitualStepId) => void
  onSkipToday: () => void
  onOpenSettings: () => void
}) {
  const meta = morningRitualMeta(step, config)
  const rule = ritualRuleFor(step, config)
  const [readDone, setReadDone] = useState(false)
  const [showerPhase, setShowerPhase] = useState<'hot' | 'cold'>('hot')
  const [workoutPhase, setWorkoutPhase] = useState<'pushups' | 'ko'>('pushups')
  const allMedsTaken = medications.length === 0 || medications.every(item => item.taken)
  const medsReady = allMedsTaken && proteinShake
  const selfcareItems = config.selfcareItems
  const selfcareReady = selfcareItems.length === 0
    || selfcareItems.every(item => selfcareChecked.includes(item.id))

  useEffect(() => {
    setReadDone(false)
    setShowerPhase('hot')
    setWorkoutPhase('pushups')
  }, [step])

  useEffect(() => {
    if (step !== 'letsGo') return
    playRitualChime('alarm')
    if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 200])
    const repeat = window.setInterval(() => playRitualChime('alarm'), 2200)
    return () => window.clearInterval(repeat)
  }, [step])

  const coldMin = Math.max(1, Math.round(config.coldSeconds / 60))
  const winnerMin = Math.max(1, Math.round(config.winnerSeconds / 60))
  const prayerMin = Math.max(1, Math.round(config.prayerSeconds / 60))

  const confirmMeds = () => {
    if (!allMedsTaken) onConfirmAllMeds()
    if (!proteinShake) onToggleProtein()
    onCompleteStep('medsShake')
  }

  return (
    <div className="morning-gate" role="dialog" aria-modal="true" aria-labelledby="morning-gate-title">
      <div className="morning-gate__orbs" aria-hidden="true">
        <span className="morning-gate__orb morning-gate__orb--one" />
        <span className="morning-gate__orb morning-gate__orb--two" />
      </div>

      <header className="morning-gate__top">
        <div>
          <span className="eyebrow">Morgen-Ritual</span>
          <p>Schritt {stepIndex + 1} von {stepCount} · {meta.label}</p>
        </div>
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Einstellungen öffnen">
          <Settings size={18} />
        </button>
      </header>

      <section className="morning-gate__card" key={step}>
        {step === 'medsShake' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Pill size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Medikamente + Shake</h2>
            <p>
              {name.trim()
                ? `${name.trim()}, ${rule.charAt(0).toLowerCase()}${rule.slice(1)}`
                : rule}
            </p>
            <ul className="morning-gate__meds">
              {medications.length === 0 ? (
                <li><p className="morning-gate__empty">Keine Medikamente im Labor — Shake reicht.</p></li>
              ) : medications.map(item => (
                <li key={item.id}>
                  <CheckRow
                    done={item.taken}
                    label={item.name || 'Medikament'}
                    detail={[item.dosage, item.time].filter(Boolean).join(' · ') || 'Tippen zum Bestätigen'}
                    onToggle={() => onToggleMed(item.id)}
                  />
                </li>
              ))}
              <li>
                <CheckRow
                  done={proteinShake}
                  label="Proteinshake"
                  detail="Jetzt trinken"
                  onToggle={onToggleProtein}
                />
              </li>
            </ul>
            <button type="button" className="primary-button morning-gate__cta" onClick={confirmMeds}>
              <Coffee size={17} />
              {medsReady ? 'Weiter' : 'Alles bestätigt · weiter'}
            </button>
          </>
        )}

        {step === 'gratitude' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Sparkles size={26} /></div>
            <span className="eyebrow">{readDone ? 'Laut gelesen' : 'Laut vorlesen'}</span>
            <h2 id="morning-gate-title">Dankbarkeit</h2>
            <p>{rule}</p>
            <blockquote className="morning-gate__script">{gratitudeText}</blockquote>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              onClick={() => {
                if (!readDone) {
                  setReadDone(true)
                  return
                }
                onCompleteGratitude()
                onCompleteStep('gratitude')
              }}
            >
              <Heart size={17} />
              {readDone ? 'Weiter' : 'Laut gelesen'}
            </button>
          </>
        )}

        {step === 'coldShower' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Snowflake size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Cold Shower</h2>
            <p>{coldMin} {coldMin === 1 ? 'Minute' : 'Minuten'} kalt. {rule}</p>
            <RitualTimer
              seconds={config.coldSeconds}
              label="Kalt bleiben"
              onComplete={() => {
                onCompleteTimer('coldShower')
              }}
            />
          </>
        )}

        {step === 'winnerPose' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Crown size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Winner Mode</h2>
            <p>{winnerMin} {winnerMin === 1 ? 'Minute' : 'Minuten'} Pose. {rule}</p>
            <RitualTimer
              seconds={config.winnerSeconds}
              label="Pose halten"
              onComplete={() => {
                onCompleteTimer('winnerPose')
              }}
            />
          </>
        )}

        {step === 'prayer' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Heart size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Gebet</h2>
            <p>{prayerMin} {prayerMin === 1 ? 'Minute' : 'Minuten'}. {rule}</p>
            <RitualTimer
              seconds={config.prayerSeconds}
              label="In Ruhe bleiben"
              onComplete={() => {
                onCompleteTimer('prayer')
              }}
            />
          </>
        )}

        {step === 'energy' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Flame size={26} /></div>
            <span className="eyebrow">Kurz einchecken</span>
            <h2 id="morning-gate-title">Wie ist deine Energie heute?</h2>
            <p>{rule}</p>
            <div className="energy-grid">
              {([
                { value: 'low', label: 'Niedrig', description: 'Wir reduzieren heute aufs Wichtigste' },
                { value: 'okay', label: 'Okay', description: 'Ein ruhiger, machbarer Tag' },
                { value: 'high', label: 'Gut', description: 'Platz für tieferen Fokus' },
              ] as const).map(option => (
                <button
                  type="button"
                  key={option.value}
                  className="energy-option"
                  onClick={() => onPickEnergy(option.value)}
                >
                  <span className={`energy-dot energy-dot--${option.value}`} />
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'todos' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Check size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Heute zählt</h2>
            <p>{rule}</p>
            {anchors.length === 0 ? (
              <p className="morning-gate__empty">Noch keine Todos — du kannst sie gleich auf Heute anlegen.</p>
            ) : (
              <ul className="morning-gate__meds">
                {anchors.map((title, index) => (
                  <li key={`${title}-${index}`}>
                    <div className={anchorsDone[index] ? 'morning-gate__med is-taken' : 'morning-gate__med'}>
                      <span className="morning-gate__check">{anchorsDone[index] ? <Check size={16} /> : <span />}</span>
                      <span><strong>{title}</strong></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="primary-button morning-gate__cta" onClick={() => {
              onCompleteStep('todos')
            }}>
              <Check size={17} />
              Gesehen · Workout
            </button>
          </>
        )}

        {step === 'workout' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Flame size={26} /></div>
            <span className="eyebrow">{workoutPhase === 'pushups' ? 'Rep-Zähler' : 'Finisher'}</span>
            <h2 id="morning-gate-title">{workoutPhase === 'pushups' ? '50 Pushups' : 'KO'}</h2>
            <p>{rule}</p>
            <button
              type="button"
              className="morning-rep"
              onClick={() => {
                if (workoutPhase === 'pushups') onSetPushups(Math.min(config.pushupTarget, pushups + 1))
                else onSetKo(Math.min(config.koTarget, ko + 1))
              }}
            >
              <strong>{workoutPhase === 'pushups' ? pushups : ko}</strong>
              <span>von {workoutPhase === 'pushups' ? config.pushupTarget : config.koTarget}</span>
            </button>
            <div className="morning-gate__row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (workoutPhase === 'pushups') onSetPushups(Math.max(0, pushups - 1))
                  else onSetKo(Math.max(0, ko - 1))
                }}
              >
                −1
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (workoutPhase === 'pushups') {
                    if (pushups < config.pushupTarget) onSetPushups(config.pushupTarget)
                    setWorkoutPhase('ko')
                    return
                  }
                  if (ko < config.koTarget) onSetKo(config.koTarget)
                  onCompleteStep('workout')
                }}
              >
                {workoutPhase === 'pushups'
                  ? (pushups < config.pushupTarget ? 'Rest als gemacht' : 'Weiter zu KO')
                  : (ko < config.koTarget ? 'Rest als gemacht' : 'Workout fertig')}
              </button>
            </div>
          </>
        )}

        {step === 'postShower' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true">
              {showerPhase === 'hot' ? <Droplets size={26} /> : <Snowflake size={26} />}
            </div>
            <span className="eyebrow">{showerPhase === 'hot' ? 'Heiß' : 'Kurz kalt'}</span>
            <h2 id="morning-gate-title">{showerPhase === 'hot' ? 'Heiß duschen' : 'Kurze Kälte'}</h2>
            <p>{rule}</p>
            <RitualTimer
              key={showerPhase}
              seconds={showerPhase === 'hot' ? config.hotShowerSeconds : config.coldRinseSeconds}
              label={showerPhase === 'hot' ? 'Heiß' : 'Kurz kalt'}
              onComplete={() => {
                if (showerPhase === 'hot') {
                  setShowerPhase('cold')
                  return
                }
                onCompleteStep('postShower')
              }}
            />
          </>
        )}

        {step === 'selfcare' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Sun size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Selfcare</h2>
            <p>{rule}</p>
            <ul className="morning-gate__meds">
              {selfcareItems.map((item: MorningSelfcareItem) => (
                <li key={item.id}>
                  <CheckRow
                    done={selfcareChecked.includes(item.id)}
                    label={item.label}
                    onToggle={() => onToggleSelfcare(item.id)}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              onClick={() => {
                onCompleteStep('selfcare')
              }}
            >
              <Check size={17} />
              {selfcareReady ? 'Weiter' : 'Alles bestätigt'}
            </button>
          </>
        )}

        {step === 'letsGo' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Flame size={26} /></div>
            <span className="eyebrow">Ready zur Arbeit</span>
            <h2 id="morning-gate-title">LETS GO</h2>
            <p>{rule}</p>
            <button
              type="button"
              className="primary-button morning-gate__cta morning-gate__cta--go"
              onClick={() => onCompleteStep('letsGo')}
            >
              LETS GO
            </button>
          </>
        )}
      </section>

      <button type="button" className="text-button morning-gate__skip" onClick={onSkipToday}>
        Ritual heute überspringen
      </button>
    </div>
  )
}
