import { describe, expect, it } from 'vitest'
import { hashFromView, isProgressHubView, viewFromHash, VIEW_LABELS } from './routing'

describe('progress hub routes', () => {
  it('uses Lab as the single home for overview, data and plan', () => {
    expect(viewFromHash('#/plan')).toBe('plan')
    expect(viewFromHash('#/lab/plan')).toBe('plan')
    expect(viewFromHash('#/checkin')).toBe('progress')
    expect(viewFromHash('#/labor')).toBe('dashboardPlus')
    expect(viewFromHash('#/lab/daten')).toBe('dashboardPlus')
    expect(isProgressHubView('plan')).toBe(true)
    expect(isProgressHubView('checkin')).toBe(false)
    expect(isProgressHubView('dashboardPlus')).toBe(true)
    expect(isProgressHubView('today')).toBe(false)
    expect(VIEW_LABELS.plan).toBe('Lab · Plan')
    expect(VIEW_LABELS.checkin).toBe('Lab')
    expect(VIEW_LABELS.progress).toBe('Lab')
    expect(hashFromView('progress')).toBe('#/lab')
    expect(viewFromHash('#/verlauf')).toBe('progress')
    expect(viewFromHash('#/lab')).toBe('progress')
    expect(viewFromHash('#/heute')).toBe('today')
    expect(isProgressHubView('progress')).toBe(true)
  })
})
