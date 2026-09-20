import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LIFE_OS_CHANGE_EVENT,
  LIFE_OS_KEY,
  applyConvertResult,
  archiveCapture,
  classifyCapture,
  convertCapture,
  createCapture,
  createReviewDraft,
  inboxCaptures,
  loadLifeOsState,
  patchLifeOsState,
  recordActivity,
  recordSignal,
  saveLifeOsState,
  type Capture,
  type CaptureTargetType,
  type LifeAreaKey,
  type LifeOsState,
  type Review,
  type ReviewType,
} from '../lib/lifeos'

export function useLifeOs() {
  const [state, setState] = useState<LifeOsState>(() => loadLifeOsState())

  useEffect(() => {
    const reload = () => setState(loadLifeOsState())
    window.addEventListener(LIFE_OS_CHANGE_EVENT, reload)
    const onStorage = (event: StorageEvent) => {
      if (event.key === LIFE_OS_KEY || event.key === null) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(LIFE_OS_CHANGE_EVENT, reload)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const commit = useCallback((updater: (current: LifeOsState) => LifeOsState) => {
    const next = patchLifeOsState(updater)
    setState(next)
    return next
  }, [])

  const captureQuick = useCallback((raw: string, extras?: { url?: string; fileName?: string; fileKind?: Capture['fileKind']; fileDataUrl?: string }) => {
    const capture = createCapture({ raw, ...extras })
    commit(current => ({
      ...current,
      captures: [capture, ...current.captures],
      events: [...current.events, {
        id: capture.id,
        type: 'capture.created',
        entityKind: 'capture',
        entityId: capture.id,
        payload: { title: capture.title },
        createdAt: capture.createdAt,
      }],
    }))
    return capture
  }, [commit])

  const updateCapture = useCallback((id: string, patch: Partial<Capture>) => {
    commit(current => ({
      ...current,
      captures: current.captures.map(item => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item),
    }))
  }, [commit])

  const classify = useCallback((id: string, targetType: CaptureTargetType, links?: { projectId?: string; goalId?: string; lifeArea?: LifeAreaKey | null }) => {
    commit(current => ({
      ...current,
      captures: current.captures.map(item => item.id === id ? classifyCapture(item, targetType, links) : item),
    }))
  }, [commit])

  const convert = useCallback((id: string): ReturnType<typeof convertCapture> | null => {
    let result: ReturnType<typeof convertCapture> | null = null
    commit(current => {
      const capture = current.captures.find(item => item.id === id)
      if (!capture) return current
      result = convertCapture(capture)
      return applyConvertResult(current, result)
    })
    return result
  }, [commit])

  const archive = useCallback((id: string) => {
    commit(current => ({
      ...current,
      captures: current.captures.map(item => item.id === id ? archiveCapture(item) : item),
    }))
  }, [commit])

  const removeCapture = useCallback((id: string) => {
    commit(current => ({
      ...current,
      captures: current.captures.filter(item => item.id !== id),
    }))
  }, [commit])

  const addSignal = useCallback((input: { type: string; value: number; unit?: string }) => {
    const signal = recordSignal({ ...input, source: 'manual' })
    commit(current => ({
      ...current,
      signals: [...current.signals, signal],
      events: [...current.events, {
        id: signal.id,
        type: 'signal.recorded',
        entityKind: 'signal',
        entityId: signal.id,
        payload: { type: signal.type, value: String(signal.value) },
        createdAt: signal.createdAt,
      }],
    }))
    return signal
  }, [commit])

  const addActivity = useCallback((input: Parameters<typeof recordActivity>[0]) => {
    const activity = recordActivity(input)
    commit(current => ({ ...current, activities: [...current.activities, activity] }))
    return activity
  }, [commit])

  const saveReview = useCallback((review: Review) => {
    commit(current => ({
      ...current,
      reviews: current.reviews.some(item => item.id === review.id)
        ? current.reviews.map(item => item.id === review.id ? review : item)
        : [...current.reviews, review],
      events: review.completedAt
        ? [...current.events, {
          id: `${review.id}-completed`,
          type: 'review.completed',
          entityKind: 'review',
          entityId: review.id,
          payload: { type: review.type },
          createdAt: review.completedAt,
        }]
        : current.events,
    }))
  }, [commit])

  const inbox = useMemo(() => inboxCaptures(state), [state])

  return {
    state,
    inbox,
    inboxCount: inbox.length,
    commit,
    setState: (next: LifeOsState) => {
      saveLifeOsState(next)
      setState(next)
    },
    captureQuick,
    updateCapture,
    classify,
    convert,
    archive,
    removeCapture,
    addSignal,
    addActivity,
    saveReview,
    createReviewDraft,
    reviewTypes: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as ReviewType[],
  }
}
