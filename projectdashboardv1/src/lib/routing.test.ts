import { describe, expect, it } from 'vitest'
import { isProgressHubView, viewFromHash, VIEW_LABELS } from './routing'

describe('progress hub routes', () => {
  it('keeps plan, check-in and labor reachable after navbar removal', () => {
    expect(viewFromHash('#/plan')).toBe('plan')
    expect(viewFromHash('#/checkin')).toBe('checkin')
    expect(viewFromHash('#/labor')).toBe('dashboardPlus')
    expect(isProgressHubView('plan')).toBe(true)
    expect(isProgressHubView('checkin')).toBe(true)
    expect(isProgressHubView('dashboardPlus')).toBe(true)
    expect(isProgressHubView('today')).toBe(false)
    expect(VIEW_LABELS.plan).toBe('Plan')
    expect(VIEW_LABELS.checkin).toBe('Check-in')
    expect(viewFromHash('#/verlauf')).toBe('progress')
    expect(viewFromHash('#/heute')).toBe('today')
    expect(isProgressHubView('progress')).toBe(true)
  })
})
