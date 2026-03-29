export interface DashboardEntry {
  id?: string
  date: string        // YYYY-MM-DD
  userId?: string

  // Morning
  mood: string
  sleepQuality: string
  sleepDuration: string
  meditationMinutes: number

  // Habits
  coldShower: boolean
  proteinShake: boolean
  pushupsDone: boolean
  squatsDone: boolean
  wallsitDone: boolean
  plankDone: boolean

  // Mindset
  gratitudeDone: boolean
  focusDone: boolean
  winnerModeDone: boolean

  // Evening
  proteinGrams: number
  calories: number
  tasksDone: number
  journalDone: boolean
  journalText: string
  familyTimeDone: boolean

  // Extended (new)
  weightKg: number
  waterLiters: number
  deepWorkHours: number

  // Computed
  dailyScore: number
}

export const createDefaultEntry = (date: string): DashboardEntry => ({
  date,
  mood: '',
  sleepQuality: '',
  sleepDuration: '',
  meditationMinutes: 0,
  coldShower: false,
  proteinShake: false,
  pushupsDone: false,
  squatsDone: false,
  wallsitDone: false,
  plankDone: false,
  gratitudeDone: false,
  focusDone: false,
  winnerModeDone: false,
  proteinGrams: 0,
  calories: 0,
  tasksDone: 0,
  journalDone: false,
  journalText: '',
  familyTimeDone: false,
  weightKg: 0,
  waterLiters: 0,
  deepWorkHours: 0,
  dailyScore: 0,
})

export type HabitKey = keyof Pick<DashboardEntry,
  'coldShower' | 'proteinShake' | 'pushupsDone' | 'squatsDone' |
  'wallsitDone' | 'plankDone' | 'gratitudeDone' | 'focusDone' |
  'winnerModeDone' | 'journalDone' | 'familyTimeDone'
>

export interface HabitMeta {
  key: HabitKey
  label: string
  emoji: string
  color: string
  group: 'habits' | 'mindset' | 'evening'
}

export const HABITS: HabitMeta[] = [
  { key: 'coldShower',    label: 'COLD SHOWER',    emoji: '❄️',  color: '#4facfe', group: 'habits'  },
  { key: 'proteinShake',  label: 'PROTEIN SHAKE',  emoji: '🥤',  color: '#34c759', group: 'habits'  },
  { key: 'pushupsDone',   label: '50 PUSHUPS',     emoji: '💪',  color: '#ff9500', group: 'habits'  },
  { key: 'squatsDone',    label: '50 SQUATS',      emoji: '🦵',  color: '#ff3b30', group: 'habits'  },
  { key: 'wallsitDone',   label: '50s WALLSIT',    emoji: '🏋️', color: '#667eea', group: 'habits'  },
  { key: 'plankDone',     label: '50s PLANK',      emoji: '📍',  color: '#f5576c', group: 'habits'  },
  { key: 'gratitudeDone', label: 'DANKBARKEIT',    emoji: '🙏',  color: '#00d084', group: 'mindset' },
  { key: 'focusDone',     label: 'DEEP FOCUS',     emoji: '🎯',  color: '#0071e3', group: 'mindset' },
  { key: 'winnerModeDone',label: 'WINNER MODE',    emoji: '👑',  color: '#ffd60a', group: 'mindset' },
  { key: 'journalDone',   label: 'JOURNAL',        emoji: '📔',  color: '#8b5cf6', group: 'evening' },
  { key: 'familyTimeDone',label: 'FAMILIENZEIT',   emoji: '👨‍👩‍👧', color: '#ec4899', group: 'evening' },
]
