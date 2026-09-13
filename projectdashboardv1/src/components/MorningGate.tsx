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
  speakGerman,
  type MorningGateMed,
  type MorningRitualConfig,
  type MorningRitualStepId,
  type MorningSelfcareItem,
} from '../lib/morningGate'
import { releaseScreenWakeLock, requestScreenWakeLock } from '../lib/wakeLock'

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
  const [running, setRunning] = useState(false)
  const doneRef = useRef(false)
  const wakeRef = useRef<Awaited<ReturnType<typeof requestScreenWakeLock>>>(null)

  useEffect(() => {
    setLeft(seconds)
    setRunning(false)
    doneRef.current = false
  }, [seconds])

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!running) {
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
  }, [running])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setLeft(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          setRunning(false)
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
  }, [running, onComplete])

  return (
    <div className="morning-timer">
      <strong className="morning-timer__clock">{formatRitualClock(left)}</strong>
      <span>{running ? label : 'Timer bereit'}</span>
      <button
        type="button"
        className="primary-button morning-gate__cta"
        onClick={() => setRunning(current => !current)}
        disabled={left === 0}
      >
        {running ? <Pause size={17} /> : <Play size={17} />}
        {running ? 'Pause' : left === 0 ? 'Fertig' : 'Start'}
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
  const meta = morningRitualMeta(step)
  const [readDone, setReadDone] = useState(false)
  const [reading, setReading] = useState(false)
  const [showerPhase, setShowerPhase] = useState<'hot' | 'cold'>('hot')
  const [workoutPhase, setWorkoutPhase] = useState<'pushups' | 'ko'>('pushups')
  const stopSpeechRef = useRef<(() => void) | null>(null)
  const allMedsTaken = medications.length === 0 || medications.every(item => item.taken)
  const medsReady = allMedsTaken && proteinShake
  const selfcareItems = config.selfcareItems
  const selfcareReady = selfcareItems.length === 0
    || selfcareItems.every(item => selfcareChecked.includes(item.id))

  useEffect(() => {
    setReadDone(false)
    setReading(false)
    setShowerPhase('hot')
    setWorkoutPhase('pushups')
    stopSpeechRef.current?.()
    stopSpeechRef.current = null
  }, [step])

  useEffect(() => () => {
    stopSpeechRef.current?.()
  }, [])

  useEffect(() => {
    if (step !== 'letsGo') return
    playRitualChime('alarm')
    if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 200])
    const repeat = window.setInterval(() => playRitualChime('alarm'), 2200)
    return () => window.clearInterval(repeat)
  }, [step])

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
                ? `${name.trim()}, erst einnehmen. Dann der Proteinshake.`
                : 'Erst die Einnahme, dann der Proteinshake.'}
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
            <span className="eyebrow">{readDone ? 'Fertig vorgelesen' : reading ? 'Wird vorgelesen…' : 'Text anhören'}</span>
            <h2 id="morning-gate-title">Dankbarkeit</h2>
            <blockquote className="morning-gate__script">{gratitudeText}</blockquote>
            <button
              type="button"
              className="primary-button morning-gate__cta"
              disabled={reading && !readDone}
              onClick={() => {
                if (!readDone) {
                  setReading(true)
                  stopSpeechRef.current = speakGerman(gratitudeText, () => {
                    setReadDone(true)
                    setReading(false)
                  })
                  return
                }
                onCompleteGratitude()
                onCompleteStep('gratitude')
              }}
            >
              <Heart size={17} />
              {readDone ? 'Weiter' : reading ? 'Bitte zuhören' : 'Vorlesen'}
            </button>
          </>
        )}

        {step === 'coldShower' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Snowflake size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Cold Shower</h2>
            <p>Drei Minuten kalt. Atmen. Bleib stehen.</p>
            <RitualTimer
              seconds={config.coldSeconds}
              label="Kalt bleiben"
              onComplete={() => onCompleteTimer('coldShower')}
            />
          </>
        )}

        {step === 'winnerPose' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Crown size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Winner Mode</h2>
            <p>Drei Minuten Pose. Brust offen, Blick fest.</p>
            <RitualTimer
              seconds={config.winnerSeconds}
              label="Pose halten"
              onComplete={() => onCompleteTimer('winnerPose')}
            />
          </>
        )}

        {step === 'prayer' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Heart size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Gebet</h2>
            <p>Sieben Minuten. Danach öffnet sich Heute.</p>
            <RitualTimer
              seconds={config.prayerSeconds}
              label="In Ruhe bleiben"
              onComplete={() => onCompleteTimer('prayer')}
            />
          </>
        )}

        {step === 'energy' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Flame size={26} /></div>
            <span className="eyebrow">{meta.hint}</span>
            <h2 id="morning-gate-title">Energie</h2>
            <p>Kurz einchecken, dann die Todos.</p>
            <div className="energy-grid">
              {([
                { value: 'low', label: 'Niedrig', description: 'Nur das Wichtigste' },
                { value: 'okay', label: 'Okay', description: 'Machbar und ruhig' },
                { value: 'high', label: 'Gut', description: 'Platz für Fokus' },
              ] as const).map(option => (
                <button
                  type="button"
                  key={option.value}
                  className="energy-option"
                  onClick={() => onPickEnergy(option.value)}
                >
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
            <p>Schau die Anker einmal an. Danach kommt Workout.</p>
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
            <button type="button" className="primary-button morning-gate__cta" onClick={() => onCompleteStep('todos')}>
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
            <p>
              {workoutPhase === 'pushups'
                ? 'Jedes Tippen zählt eine Wiederholung.'
                : 'Kurz und hart. Danach nur eine kurze Kaltdusche.'}
            </p>
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
                disabled={workoutPhase === 'pushups' ? pushups < config.pushupTarget : ko < config.koTarget}
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
                {workoutPhase === 'pushups' ? 'Weiter zu KO' : 'Workout fertig'}
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
            <p>
              {showerPhase === 'hot'
                ? 'Einmal heiß nach dem Sport.'
                : 'Nur kurz kalt — nach dem Workout nicht zu lange.'}
            </p>
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
            <p>Haken setzen. Die Liste kannst du in den Einstellungen erweitern.</p>
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
              disabled={!selfcareReady}
              onClick={() => onCompleteStep('selfcare')}
            >
              <Check size={17} />
              {selfcareReady ? 'LETS GO' : 'Alles abhaken'}
            </button>
          </>
        )}

        {step === 'letsGo' && (
          <>
            <div className="morning-gate__icon" aria-hidden="true"><Flame size={26} /></div>
            <span className="eyebrow">Ready zur Arbeit</span>
            <h2 id="morning-gate-title">LETS GO</h2>
            <p>Du bist durch. Tür zu, raus, arbeiten.</p>
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

      {(step !== 'gratitude' || readDone) && (
        <button type="button" className="text-button morning-gate__skip" onClick={onSkipToday}>
          Ritual heute überspringen
        </button>
      )}
    </div>
  )
}
