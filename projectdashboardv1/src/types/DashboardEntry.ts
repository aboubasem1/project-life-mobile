import type { LucideIcon } from 'lucide-react'
import {
  Snowflake, GlassWater, Dumbbell, Activity,
  Timer, Zap, Heart, Target, Crown, BookOpen, Users,
} from 'lucide-react'

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
  proteinReached: boolean
  caloriesReached: boolean
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
  proteinReached: false,
  caloriesReached: false,
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
  icon: LucideIcon
  color: string
  group: 'habits' | 'mindset' | 'evening'
}

export const HABITS: HabitMeta[] = [
  { key: 'coldShower',     label: 'COLD SHOWER',   icon: Snowflake,  color: '#4facfe', group: 'habits'  },
  { key: 'proteinShake',   label: 'PROTEIN SHAKE', icon: GlassWater, color: '#34c759', group: 'habits'  },
  { key: 'pushupsDone',    label: '50 PUSHUPS',    icon: Dumbbell,   color: '#ff9500', group: 'habits'  },
  { key: 'squatsDone',     label: '50 SQUATS',     icon: Activity,   color: '#ff3b30', group: 'habits'  },
  { key: 'wallsitDone',    label: '50s WALLSIT',   icon: Timer,      color: '#667eea', group: 'habits'  },
  { key: 'plankDone',      label: '50s PLANK',     icon: Zap,        color: '#f5576c', group: 'habits'  },
  { key: 'gratitudeDone',  label: 'DANKBARKEIT',   icon: Heart,      color: '#00d084', group: 'mindset' },
  { key: 'focusDone',      label: 'DEEP FOCUS',    icon: Target,     color: '#0071e3', group: 'mindset' },
  { key: 'winnerModeDone', label: 'WINNER MODE',   icon: Crown,      color: '#ffd60a', group: 'mindset' },
  { key: 'journalDone',    label: 'JOURNAL',       icon: BookOpen,   color: '#8b5cf6', group: 'evening' },
  { key: 'familyTimeDone', label: 'FAMILIENZEIT',  icon: Users,      color: '#ec4899', group: 'evening' },
]
