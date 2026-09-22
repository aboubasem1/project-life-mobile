/** Single source of truth for Lab → Daten areas, grouping, and quick actions. */

import {
  BarChart3,
  BookOpen,
  CreditCard,
  LayoutGrid,
  ListTodo,
  Package,
  Pill,
  ShoppingCart,
  Target,
  type LucideIcon,
} from 'lucide-react'

export const LAB_DATA_SECTION_IDS = [
  'overview',
  'todos',
  'lists',
  'stock',
  'medications',
  'goals',
  'shopping',
  'stats',
  'finance',
] as const

export type LabDataSection = (typeof LAB_DATA_SECTION_IDS)[number]

export type LabDataQuickAction =
  | 'capture-task'
  | 'capture-stock'
  | 'capture-med-log'
  | 'capture-goal'
  | 'capture-shopping'
  | 'capture-finance'
  | 'capture-list'

export type LabDataArea = {
  id: LabDataSection
  label: string
  hint: string
  icon: LucideIcon
  group: 'focus' | 'growth' | 'org'
  quickAction?: {
    id: LabDataQuickAction
    label: string
  }
}

export const LAB_DATA_AREAS: LabDataArea[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    hint: 'Heute im Kern',
    icon: LayoutGrid,
    group: 'focus',
  },
  {
    id: 'todos',
    label: 'Todos',
    hint: 'Offene Aufgaben',
    icon: ListTodo,
    group: 'focus',
    quickAction: { id: 'capture-task', label: 'Neue Aufgabe' },
  },
  {
    id: 'stock',
    label: 'Bestände',
    hint: 'Supplements',
    icon: Package,
    group: 'focus',
    quickAction: { id: 'capture-stock', label: 'Bestand erfassen' },
  },
  {
    id: 'medications',
    label: 'Medis',
    hint: 'Einnahme',
    icon: Pill,
    group: 'focus',
    quickAction: { id: 'capture-med-log', label: 'Einnahme' },
  },
  {
    id: 'goals',
    label: 'Ziele',
    hint: 'Fortschritt',
    icon: Target,
    group: 'growth',
    quickAction: { id: 'capture-goal', label: 'Fortschritt' },
  },
  {
    id: 'stats',
    label: 'Stats',
    hint: 'Woche',
    icon: BarChart3,
    group: 'growth',
  },
  {
    id: 'shopping',
    label: 'Kaufliste',
    hint: 'Offene Artikel',
    icon: ShoppingCart,
    group: 'org',
    quickAction: { id: 'capture-shopping', label: 'Artikel' },
  },
  {
    id: 'finance',
    label: 'Finanzen',
    hint: 'Fixkosten',
    icon: CreditCard,
    group: 'org',
    quickAction: { id: 'capture-finance', label: 'Eintrag' },
  },
  {
    id: 'lists',
    label: 'Listen',
    hint: 'Packen und Merken',
    icon: BookOpen,
    group: 'org',
    quickAction: { id: 'capture-list', label: 'Neue Liste' },
  },
]

export const LAB_DATA_GROUPS: Array<{
  id: LabDataArea['group']
  label: string
  sectionIds: LabDataSection[]
}> = [
  {
    id: 'focus',
    label: 'Heute im Fokus',
    sectionIds: ['overview', 'todos', 'medications', 'stock'],
  },
  {
    id: 'growth',
    label: 'Entwicklung',
    sectionIds: ['goals', 'stats'],
  },
  {
    id: 'org',
    label: 'Organisation',
    sectionIds: ['shopping', 'finance', 'lists'],
  },
]

export const LAB_DATA_SECTION_KEY = 'life-os-lab-data-section'

const SECTION_SET = new Set<string>(LAB_DATA_SECTION_IDS)

export function isLabDataSection(value: string | null | undefined): value is LabDataSection {
  return Boolean(value && SECTION_SET.has(value))
}

export function labDataAreaById(id: LabDataSection): LabDataArea {
  return LAB_DATA_AREAS.find(area => area.id === id) ?? LAB_DATA_AREAS[0]
}

export function readStoredLabDataSection(): LabDataSection | undefined {
  try {
    const raw = localStorage.getItem(LAB_DATA_SECTION_KEY)
    return isLabDataSection(raw) ? raw : undefined
  } catch {
    return undefined
  }
}

export function storeLabDataSection(section: LabDataSection): void {
  try {
    localStorage.setItem(LAB_DATA_SECTION_KEY, section)
  } catch {
    // ignore quota / private mode
  }
}

export function contextLineForSection(
  section: LabDataSection,
  counts: Partial<Record<LabDataSection, string | number>>,
): string {
  const value = counts[section]
  if (value === undefined || value === '') return labDataAreaById(section).hint
  return String(value)
}
