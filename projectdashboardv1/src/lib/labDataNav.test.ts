import { describe, expect, it } from 'vitest'
import {
  LAB_DATA_AREAS,
  LAB_DATA_GROUPS,
  isLabDataSection,
  labDataAreaById,
} from './labDataNav'
import {
  hashFromLabDataSection,
  labDataSectionFromHash,
  viewFromHash,
} from './routing'

describe('lab data navigation', () => {
  it('keeps a single source of truth for areas and groups', () => {
    expect(LAB_DATA_AREAS).toHaveLength(9)
    expect(LAB_DATA_GROUPS.map(group => group.id)).toEqual(['focus', 'growth', 'org'])
    expect(LAB_DATA_GROUPS.flatMap(group => group.sectionIds).sort()).toEqual(
      [...LAB_DATA_AREAS.map(area => area.id)].sort(),
    )
    expect(labDataAreaById('todos').quickAction?.id).toBe('capture-task')
    expect(labDataAreaById('shopping').quickAction?.id).toBe('capture-shopping')
    expect(isLabDataSection('todos')).toBe(true)
    expect(isLabDataSection('unknown')).toBe(false)
  })

  it('supports deep links for each Daten area', () => {
    expect(viewFromHash('#/lab/daten/todos')).toBe('dashboardPlus')
    expect(labDataSectionFromHash('#/lab/daten/todos')).toBe('todos')
    expect(labDataSectionFromHash('#/lab/daten/shopping')).toBe('shopping')
    expect(hashFromLabDataSection('goals')).toBe('#/lab/daten/goals')
    expect(viewFromHash('#/labor/medis')).toBe('today')
  })
})
