import { describe, expect, it } from 'vitest'
import { emptyLifeOsState, mergeLifeOsState, normalizeLifeOsState } from '../lifeos/store'
import {
  addAsset,
  addExperiment,
  addMeal,
  addSupplement,
  addVisit,
  addGoal,
  addTask,
  applyReviewDecision,
  attachTranscript,
  blockActive,
  completeActive,
  contributionDetail,
  contributionMargin,
  delegateTask,
  isOverdue,
  localPriority,
  promoteGoal,
  rescheduleTask,
  shrinkTask,
  importReel,
  initialGenerationalRun,
  normalizeGenerationalRun,
  patchAsset,
  patchExperiment,
  patchHealth,
  patchVisit,
  pauseActive,
  releaseReel,
  RUN_PROJECT_ID,
  saveWeekDecision,
  setEnergyMode,
  setExperimentLimit,
  setExperimentStatus,
  sleepDurationMinutes,
  startNext,
  todayBoard,
  weightTrend,
} from './logic'
import { mergeLifeOsSnapshots } from '../../../../server/lifeos-merge'

const NOW = '2026-10-11T12:00:00.000Z'
const LATER = '2026-10-11T13:00:00.000Z'

describe('generational run', () => {
  it('opens one Generational Run project across repeated init', () => {
    const first = normalizeGenerationalRun(initialGenerationalRun())
    const second = normalizeGenerationalRun(JSON.parse(JSON.stringify(first)))
    const ids = second.portfolio.filter(item => item.id === RUN_PROJECT_ID)
    expect(ids).toHaveLength(1)
    expect(second.assets.filter(asset => asset.id === 'draft-coolpod')).toHaveLength(1)
    expect(second.portfolio.some(item => item.name.includes('0→100'))).toBe(false)
    expect(second.assets.every(asset => asset.confirmed === false && asset.metricValue === null && asset.revenue === null)).toBe(true)
  })

  it('keeps task start, pause and complete after a reload', () => {
    let run = addTask(initialGenerationalRun(), {
      title: 'Angebot schicken',
      nextStep: 'Drei Sätze an den Kontakt',
      minutes: 25,
      energy: 'okay',
      result: 'Nachricht ist raus',
      kind: 'revenue',
    }, NOW, 'task-1')
    run = startNext(run, NOW).run
    expect(run.session).toEqual({ taskId: 'task-1', phase: 'running' })
    run = pauseActive(run, LATER)
    expect(run.tasks[0]?.status).toBe('paused')
    run = normalizeGenerationalRun(JSON.parse(JSON.stringify(run)))
    expect(run.session?.phase).toBe('paused')
    run = startNext(run, LATER).run
    run = completeActive(run, LATER)
    run = normalizeGenerationalRun(JSON.parse(JSON.stringify(run)))
    expect(run.tasks[0]?.status).toBe('done')
    expect(run.session).toBeNull()
  })

  it('keeps appointments and prescribed items visible in low energy', () => {
    let run = addTask(initialGenerationalRun(), {
      title: 'Großes Angebot',
      energy: 'high',
      kind: 'revenue',
    }, NOW, 'big')
    run = addTask(run, { title: 'Kurze Nachfrage', energy: 'low', kind: 'revenue' }, NOW, 'small')
    run = addTask(run, { title: 'Einnahme', kind: 'prescribed' }, NOW, 'med')
    run = addTask(run, { title: 'Arzt', kind: 'appointment' }, NOW, 'visit')
    run = setEnergyMode(run, 'low', NOW)
    const board = todayBoard(run)
    expect(board.primary.map(task => task.id)).toEqual(['small'])
    expect(board.protectedItems.map(task => task.id).sort()).toEqual(['med', 'visit'])
    expect(run.tasks).toHaveLength(4)
  })

  it('requires a conscious limit change before a third revenue experiment', () => {
    let run = initialGenerationalRun()
    run = addExperiment(run, blankExperiment('A'), NOW, 'a')
    run = addExperiment(run, blankExperiment('B'), NOW, 'b')
    run = addExperiment(run, blankExperiment('C'), NOW, 'c')
    run = setExperimentStatus(run, 'a', 'active', NOW).run
    run = setExperimentStatus(run, 'b', 'active', NOW).run
    const blocked = setExperimentStatus(run, 'c', 'active', NOW)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.limit).toBe(2)
    run = setExperimentLimit(blocked.run, 3, LATER)
    expect(run.capacityNote).toContain('Aufmerksamkeit')
    const opened = setExperimentStatus(run, 'c', 'active', LATER)
    expect(opened.ok).toBe(true)
  })

  it('keeps a goal split and unknown asset metrics', () => {
    let run = addGoal(initialGenerationalRun(), { level: 'big', title: 'Angebot steht', result: 'Ein Käufer kann bestellen' }, NOW, 'big')
    run = addGoal(run, { level: 'mid', parentId: 'big', title: 'Seite fertig', result: 'Preis und Umfang stehen' }, NOW, 'mid')
    run = addGoal(run, { level: 'task', parentId: 'mid', title: 'Preis eintragen', result: 'Zahl ist gespeichert' }, NOW, 'next')
    run = patchAsset(run, 'draft-coolpod', { metricValue: null, revenue: null, url: null }, NOW)
    run = addAsset(run, 'Eigener Entwurf', NOW, 'own')
    const stored = normalizeGenerationalRun(JSON.parse(JSON.stringify({ ...run, assets: run.assets.map(asset => asset.id === 'draft-coolpod' ? { ...asset, metricValue: undefined, revenue: undefined } : asset) })))
    expect(stored.goals.map(goal => goal.id)).toEqual(['big', 'mid', 'next'])
    expect(stored.goals.find(goal => goal.id === 'next')?.parentId).toBe('mid')
    expect(stored.assets.find(asset => asset.id === 'draft-coolpod')?.metricValue).toBeNull()
    expect(stored.assets.find(asset => asset.id === 'draft-coolpod')?.revenue).toBeNull()
    expect(contributionMargin(stored.finance)).toBeNull()
  })

  it('stores one weekly decision', () => {
    const run = saveWeekDecision(saveWeekDecision(initialGenerationalRun(), 'continue', '', NOW), 'pause', 'zu viel parallel', LATER)
    expect(run.reviews).toHaveLength(1)
    expect(run.reviews[0]?.decision).toBe('pause')
    expect(run.reviews[0]?.summary).toContain('Deckungsbeitrag')
  })

  it('releases a reel once and keeps the blocked transcript retry', () => {
    let run = initialGenerationalRun()
    const text = importReel(run, { fileName: 'notiz.txt', byteSize: 20, text: 'Erste Zeile\nZweite Zeile', now: NOW, id: 'reel-1' })
    run = text.run
    expect(text.error).toBeUndefined()
    expect(run.reels[0]?.status).toBe('review')
    const first = releaseReel(run, 'reel-1', NOW, 'knowledge-1')
    const second = releaseReel(first.run, 'reel-1', LATER, 'knowledge-2')
    expect(first.created).toBe(true)
    expect(first.knowledge?.id).toBe('knowledge-1')
    expect(second.created).toBe(false)
    expect(second.run.reels[0]?.knowledgeId).toBe('knowledge-1')

    const blocked = importReel(initialGenerationalRun(), { fileName: 'clip.mp4', byteSize: 1000, now: NOW, id: 'clip' })
    expect(blocked.error).toContain('Transkription')
    expect(blocked.run.reels[0]?.transcriptBlocked).toBe(true)
    const retried = importReel(blocked.run, { fileName: 'clip.mp4', byteSize: 1000, text: 'Gesagt um 00:12', now: LATER, existingJobId: 'clip' })
    expect(retried.run.reels).toHaveLength(1)
    expect(retried.run.reels[0]?.status).toBe('review')
    expect(retried.run.reels[0]?.transcriptBlocked).toBe(false)

    const huge = importReel(initialGenerationalRun(), { fileName: 'clip.mp4', byteSize: 26 * 1024 * 1024, now: NOW })
    expect(huge.error).toContain('25 MB')
    expect(huge.run.reels).toHaveLength(0)
    const zip = importReel(initialGenerationalRun(), { fileName: 'archiv.zip', byteSize: 10, now: NOW })
    expect(zip.error).toContain('nicht unterstützt')
  })

  it('offers a prepared fallback when the active task is blocked', () => {
    let run = addTask(initialGenerationalRun(), { title: 'Anruf', kind: 'revenue', energy: 'okay' }, NOW, 'main')
    run = addTask(run, { title: 'Liste kürzen', kind: 'support', energy: 'low' }, NOW, 'spare')
    run = startNext(run, NOW).run
    const blocked = blockActive(run, 'Keine Antwort', LATER)
    expect(blocked.fallback?.id).toBe('spare')
    expect(blocked.run.tasks.find(task => task.id === 'main')?.fallbackTaskId).toBe('spare')
  })

  it('reschedules, shrinks and delegates an overdue task without dropping it', () => {
    let run = addTask(initialGenerationalRun(), {
      title: 'Follow-up',
      due: '2026-10-01',
      minutes: 40,
      kind: 'revenue',
      energy: 'high',
    }, NOW, 'late')
    expect(isOverdue(run.tasks[0]!, '2026-10-11')).toBe(true)
    run = shrinkTask(run, 'late', NOW)
    expect(run.tasks[0]?.minutes).toBe(20)
    run = rescheduleTask(run, 'late', '2026-10-12', NOW)
    expect(run.tasks[0]?.due).toBe('2026-10-12')
    expect(isOverdue(run.tasks[0]!, '2026-10-11')).toBe(false)
    run = delegateTask(run, 'late', LATER, 'brief-1')
    expect(run.tasks.find(task => task.id === 'late')?.status).toBe('paused')
    expect(run.delegations.map(item => item.id)).toEqual(['brief-1'])
  })

  it('prefers the earlier due task and keeps a partial margin', () => {
    let run = addTask(initialGenerationalRun(), { title: 'Später', due: '2026-10-20', kind: 'revenue', energy: 'low' }, NOW, 'later')
    run = addTask(run, { title: 'Früher', due: '2026-10-12', kind: 'support', energy: 'low' }, NOW, 'sooner')
    expect(localPriority(run).taskId).toBe('sooner')
    const detail = contributionDetail({
      ...run.finance,
      paidIn: 100,
      variableCosts: 30,
      platformFees: 5,
    })
    expect(detail).toEqual({ value: 65, partial: true })
    expect(contributionMargin({ ...run.finance, paidIn: 100, shipping: null })).toBeNull()
  })

  it('pauses active experiments only for an explicit pause decision', () => {
    let run = addExperiment(initialGenerationalRun(), blankExperiment('A'), NOW, 'a')
    run = setExperimentStatus(run, 'a', 'active', NOW).run
    const changed = applyReviewDecision(run, 'change', '', NOW)
    expect(changed.experiments[0]?.status).toBe('active')
    expect(changed.experiments[0]?.offer).toBe('A')
    expect(changed.capacityNote).toContain('eine Variable')
    const paused = applyReviewDecision(run, 'pause', '', LATER)
    expect(paused.experiments[0]?.status).toBe('paused')
    expect(paused.reviews[0]?.decision).toBe('pause')
  })

  it('turns one goal task into one runnable task and accepts a pasted transcript', () => {
    let run = addGoal(initialGenerationalRun(), { level: 'task', title: 'Preis eintragen', result: 'Zahl steht' }, NOW, 'goal-task')
    run = promoteGoal(run, 'goal-task', NOW, 'from-goal')
    run = promoteGoal(run, 'goal-task', LATER, 'from-goal-2')
    expect(run.tasks.filter(task => task.goalId === 'goal-task')).toHaveLength(1)
    const blocked = importReel(run, { fileName: 'clip.mp4', byteSize: 1000, now: NOW, id: 'clip' })
    const pasted = attachTranscript(blocked.run, 'clip', 'Gesprochener Satz', LATER)
    expect(pasted.run.reels[0]?.status).toBe('review')
    expect(pasted.run.reels[0]?.transcriptBlocked).toBe(false)
    const released = releaseReel(pasted.run, 'clip', LATER, 'knowledge-clip')
    expect(attachTranscript(released.run, 'clip', 'Noch ein Satz', LATER).error).toContain('freigegeben')
  })

  it('keeps experiment bounds and health notes empty until entered', () => {
    const created = addExperiment(initialGenerationalRun(), blankExperiment('Angebot'), NOW, 'exp')
    expect(created.experiments[0]).toMatchObject({
      budgetLimit: null,
      timeBudgetMin: null,
      durationDays: null,
      metricsNote: '',
      offer: 'Angebot',
    })
    const bounded = patchExperiment(created, 'exp', { budgetLimit: 40, metricsNote: 'eine Antwort' }, LATER)
    expect(bounded.experiments[0]?.budgetLimit).toBe(40)
    expect(bounded.experiments[0]?.offer).toBe('Angebot')
    expect(bounded.experiments[0]?.status).toBe('idea')

    const stored = normalizeGenerationalRun({ healthPlan: { movementSessionsPerWeek: 3, sleepScore: 90 } })
    expect(stored.healthPlan.sleepStart).toBeNull()
    expect(stored.healthPlan.meals).toEqual([])
    expect(stored.healthPlan.supplements).toEqual([])
    expect(stored.healthPlan.whiteningOptional).toBe(false)
    expect(stored.healthPlan.calorieTarget).toBeNull()
    expect('sleepScore' in stored.healthPlan).toBe(false)

    const slept = patchHealth(stored, { sleepStart: '23:30', sleepEnd: '07:00', sleepRecovery: 'müde' }, NOW)
    expect(sleepDurationMinutes(slept.healthPlan.sleepStart, slept.healthPlan.sleepEnd)).toBe(450)
    expect(sleepDurationMinutes('23:30', null)).toBeNull()

    const noted = addSupplement(slept, { product: 'Eigenes Produkt' }, NOW, 'sup')
    expect(noted.healthPlan.supplements).toEqual([{ id: 'sup', product: 'Eigenes Produkt', amount: '', stock: '' }])
    const meal = addMeal(noted, { name: 'Wiederholung' }, NOW, 'meal')
    expect(meal.healthPlan.meals).toEqual([{ id: 'meal', name: 'Wiederholung', note: '' }])
    expect(meal.healthPlan.calorieTarget).toBeNull()
    const visit = addVisit(meal, { title: 'Kontrolle' }, NOW, 'visit')
    const dated = patchVisit(visit, 'visit', { date: '2026-10-20' }, LATER)
    expect(dated.healthPlan.visits[0]).toMatchObject({ title: 'Kontrolle', date: '2026-10-20', documents: '', followUp: '' })
  })

  it('does not invent a weight trend from one point', () => {
    expect(weightTrend([])).toEqual({ comparable: false })
    expect(weightTrend([{ id: 'w', date: '2026-10-01', unit: 'kg', value: 80 }])).toEqual({ comparable: false })
  })

  it('survives life-os merge without dropping the newer workspace', () => {
    const older = emptyLifeOsState()
    const newer = normalizeLifeOsState({
      ...older,
      run: addTask(older.run, { title: 'Bleibt', kind: 'support', energy: 'low' }, LATER, 'keep'),
    })
    const merged = mergeLifeOsState(newer, older)
    expect(merged.run.tasks.map(task => task.id)).toEqual(['keep'])
    const remote = mergeLifeOsSnapshots(
      { run: { updatedAt: LATER, tasks: [{ id: 'keep' }] } },
      { run: { updatedAt: NOW, tasks: [] } },
    ) as { run: { tasks: Array<{ id: string }> } }
    expect(remote.run.tasks.map(task => task.id)).toEqual(['keep'])
  })
})

function blankExperiment(offer: string) {
  return {
    offer,
    buyers: 'Bestehende Kontakte',
    hypothesis: 'Jemand zahlt diese Woche',
    success: 'Eine bezahlte Bestellung',
    abort: 'Keine Antwort nach dem Testfenster',
    nextAction: 'Zehn Kontakte auswählen',
    basis: 'Noch keine Messung',
    uncertainty: 'Nachfrage unbekannt',
  }
}
