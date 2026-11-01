import { describe, expect, it } from 'vitest'
import {
  deviceRoleFromWidth,
  homeView,
  PHONE_MAX_WIDTH_PX,
  resolveLaunchView,
  surfaceOpensMorningGate,
  surfacesByPlacement,
  viewForSurface,
} from './deviceRole'

function ids(role: 'phone' | 'desktop', placement: 'primary' | 'secondary') {
  return surfacesByPlacement(role, placement).map(surface => surface.id)
}

describe('device role', () => {
  it('treats the existing 860px layout breakpoint as the phone', () => {
    expect(PHONE_MAX_WIDTH_PX).toBe(860)
    expect(deviceRoleFromWidth(390)).toBe('phone')
    expect(deviceRoleFromWidth(860)).toBe('phone')
    expect(deviceRoleFromWidth(861)).toBe('desktop')
    expect(deviceRoleFromWidth(1280)).toBe('desktop')
  })

  it('lands the desktop on the overview and keeps tracking secondary', () => {
    expect(homeView('desktop')).toBe('progress')
    expect(surfaceOpensMorningGate('desktop')).toBe(false)
    expect(ids('desktop', 'primary')).toEqual([
      'overview',
      'knowledge',
      'arrangement',
      'files',
      'settings',
    ])
    expect(ids('desktop', 'secondary')).toEqual(['tracking', 'run'])
    expect(surfacesByPlacement('desktop', 'primary').map(surface => surface.label)).toEqual([
      'Übersicht',
      'Wissen',
      'Anordnung',
      'Dateien',
      'Einstellungen',
    ])
  })

  it('lands the phone on tracking and keeps the desk surfaces secondary', () => {
    expect(homeView('phone')).toBe('today')
    expect(surfaceOpensMorningGate('phone')).toBe(true)
    expect(ids('phone', 'primary')).toEqual(['tracking'])
    expect(ids('phone', 'secondary')).toEqual([
      'overview',
      'knowledge',
      'arrangement',
      'files',
      'settings',
      'run',
    ])
  })

  it('maps surfaces onto the existing views', () => {
    expect(viewForSurface('overview')).toBe('progress')
    expect(viewForSurface('knowledge')).toBe('knowledge')
    expect(viewForSurface('arrangement')).toBe('dashboardPlus')
    expect(viewForSurface('files')).toBe('inbox')
    expect(viewForSurface('tracking')).toBe('today')
    expect(viewForSurface('run')).toBe('run')
    expect(viewForSurface('settings')).toBeNull()
  })

  it('uses the role only when the address has no explicit view', () => {
    expect(resolveLaunchView('desktop', '')).toBe('progress')
    expect(resolveLaunchView('desktop', '#')).toBe('progress')
    expect(resolveLaunchView('desktop', '#/')).toBe('progress')
    expect(resolveLaunchView('phone', '')).toBe('today')
    expect(resolveLaunchView('phone', '/')).toBe('today')
    expect(resolveLaunchView('desktop', '#/heute')).toBe('today')
    expect(resolveLaunchView('phone', '#/lab')).toBe('progress')
    expect(resolveLaunchView('phone', '#/knowledge')).toBe('knowledge')
    expect(resolveLaunchView('desktop', '#/wissen')).toBe('knowledge')
  })
})
