import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Pause, Play, Plus } from 'lucide-react'
import {
  defaultHabitKind,
  formatClock,
  habitLogFor,
  habitProgressLabel,
  isHabitComplete,
  patchHabitLog,
  type HabitKindGoals,
} from '../lib/habitKinds'
import { playRitualChime } from '../lib/morningGate'
import { releaseScreenWakeLock, requestScreenWakeLock } from '../lib/wakeLock'
import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'

function CompactTimer({
  seconds,
  elapsed,
  onTick,
  onComplete,
}: {
  seconds: number
  elapsed: number
  onTick: (elapsed: number) => void
  onComplete: () => void
}) {
  const [running, setRunning] = useState(false)
  const [localElapsed, setLocalElapsed] = useState(elapsed)
  const doneRef = useRef(false)
  const elapsedRef = useRef(elapsed)
  const lastPersistRef = useRef(elapsed)
  const onTickRef = useRef(onTick)
  const onCompleteRef = useRef(onComplete)
  const wakeRef = useRef<Awaited<ReturnType<typeof requestScreenWakeLock>>>(null)
  const left = Math.max(0, seconds - localElapsed)
  elapsedRef.current = localElapsed
  onTickRef.current = onTick
  onCompleteRef.current = onComplete

  useEffect(() => {
    setLocalElapsed(elapsed)
    elapsedRef.current = elapsed
    lastPersistRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    doneRef.current = left === 0
  }, [left])

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!running || seconds < 60) {
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
  }, [running, seconds])

  useEffect(() => {
    if (!running || left === 0) return
    const timer = window.setInterval(() => {
      const next = Math.min(seconds, elapsedRef.current + 1)
      setLocalElapsed(next)
      elapsedRef.current = next
      if (next === seconds || next - lastPersistRef.current >= 15) {
        lastPersistRef.current = next
        onTickRef.current(next)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, left, seconds])

  useEffect(() => {
    if (left > 0 || doneRef.current) return
    doneRef.current = true
    setRunning(false)
    playRitualChime('done')
    onCompleteRef.current()
  }, [left])

  return (
    <div className="habit-kind__timer">
      <strong>{formatClock(left)}</strong>
      <button
        type="button"
        className="habit-kind__chip"
        onClick={() => {
          if (left === 0) {
            doneRef.current = false
            setLocalElapsed(0)
            lastPersistRef.current = 0
            onTickRef.current(0)
            return
          }
          if (running) {
            lastPersistRef.current = elapsedRef.current
            onTickRef.current(elapsedRef.current)
          }
          setRunning(current => !current)
        }}
      >
        {left === 0 ? <Check size={14} /> : running ? <Pause size={14} /> : <Play size={14} />}
        {left === 0 ? 'Zurück' : running ? 'Pause' : 'Start'}
      </button>
      {left > 0 && (
        <button
          type="button"
          className="habit-kind__chip"
          onClick={() => {
            setRunning(false)
            setLocalElapsed(seconds)
            onCompleteRef.current()
          }}
        >
          Fertig
        </button>
      )}
    </div>
  )
}

export function HabitKindControls({
  habitKey,
  entry,
  goals,
  onUpdate,
}: {
  habitKey: HabitKey
  entry: DashboardEntry
  goals: HabitKindGoals
  onUpdate: (patch: Partial<DashboardEntry>) => void
}) {
  const config = defaultHabitKind(habitKey, goals)
  const log = habitLogFor(entry, habitKey)
  const done = isHabitComplete(entry, habitKey, config)
  const step = config.unit === 'g' || config.unit === 'Wdh' ? 10 : 1

  const apply = (patch: Parameters<typeof patchHabitLog>[2]) => {
    onUpdate(patchHabitLog(entry, habitKey, patch, config))
  }

  switch (config.kind) {
    case 'toggle':
      return (
        <button
          type="button"
          className="habit-kind__chip"
          aria-pressed={done}
          onClick={() => onUpdate({ [habitKey]: !done } as Partial<DashboardEntry>)}
        >
          {done ? <Check size={14} /> : <Plus size={14} />}
          {done ? 'Erledigt' : 'Offen'}
        </button>
      )
    case 'amount':
      return (
        <div className="habit-kind__amount">
          <button
            type="button"
            className="habit-kind__chip"
            aria-label="Weniger"
            onClick={() => apply({ value: Math.max(0, (log.value ?? 0) - step) })}
          >
            <Minus size={14} />
          </button>
          <span>{habitProgressLabel(entry, habitKey, config)}</span>
          <button
            type="button"
            className="habit-kind__chip"
            aria-label="Mehr"
            onClick={() => apply({ value: Math.min(config.target, (log.value ?? 0) + step) })}
          >
            <Plus size={14} />
          </button>
          {(log.value ?? 0) < config.target && (
            <button
              type="button"
              className="habit-kind__chip"
              onClick={() => apply({ value: config.target })}
            >
              Ziel
            </button>
          )}
        </div>
      )
    case 'timer':
      return (
        <CompactTimer
          seconds={config.target}
          elapsed={log.elapsed ?? 0}
          onTick={elapsed => apply({ elapsed })}
          onComplete={() => apply({ elapsed: config.target })}
        />
      )
    case 'steps':
      return (
        <div className="habit-kind__steps">
          <ul>
            {config.steps.map(item => {
              const checked = log.checked?.includes(item.id) ?? false
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={checked ? 'habit-kind__step is-on' : 'habit-kind__step'}
                    onClick={() => {
                      const next = checked
                        ? (log.checked ?? []).filter(id => id !== item.id)
                        : [...(log.checked ?? []), item.id]
                      apply({ checked: next })
                    }}
                  >
                    {checked ? <Check size={14} /> : <span />}
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )
    default: {
      const _exhaustive: never = config.kind
      return _exhaustive
    }
  }
}
