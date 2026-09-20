import type { LifeAreaKey } from './areas'
import type { ConvertResult } from './domain'
import { nowIso } from './store'

export type BridgeTask = {
  id: string
  title: string
  tag: string
  time: string
  done: boolean
  priority: 'p1' | 'p2' | 'p3' | 'p4'
  plannedMinutes?: number
  actualMinutes?: number
  lifeArea?: LifeAreaKey
}

export type BridgeGoal = {
  id: string
  title: string
  timeframe: 'Jahr' | 'Quartal' | 'Monat' | 'Woche'
  percent: number
  dueDate: string
  color: string
  description?: string
  outcome?: string
  lifeArea?: LifeAreaKey
}

export type BridgeBoard = {
  id: string
  label: string
  count: number
  tasks: BridgeTask[]
  lastActivityAt?: string
}

export type BridgeState = {
  focusTodos: BridgeTask[]
  boards: BridgeBoard[]
  goals: BridgeGoal[]
}

export function applyConvertToDashboard(dashboard: BridgeState, result: ConvertResult, today: string): BridgeState {
  if (result.task) {
    const task: BridgeTask = {
      id: result.task.id,
      title: result.task.title,
      tag: '',
      time: '',
      done: false,
      priority: 'p3',
      lifeArea: result.task.lifeArea,
    }
    if (result.task.projectId && dashboard.boards.some(board => board.id === result.task?.projectId)) {
      return {
        ...dashboard,
        boards: dashboard.boards.map(board => (
          board.id === result.task?.projectId
            ? {
              ...board,
              tasks: [...board.tasks, task],
              count: board.tasks.filter(item => !item.done).length + 1,
              lastActivityAt: nowIso(),
            }
            : board
        )),
      }
    }
    return { ...dashboard, focusTodos: [...dashboard.focusTodos, task] }
  }

  if (result.goal) {
    const goal: BridgeGoal = {
      id: result.goal.id,
      title: result.goal.title,
      timeframe: 'Monat',
      percent: 0,
      dueDate: today,
      color: 'var(--accent)',
      lifeArea: result.goal.lifeArea,
    }
    return { ...dashboard, goals: [...dashboard.goals, goal] }
  }

  return dashboard
}
