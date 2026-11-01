/** Which job a viewport has. Same app, same stores — only the landing and the primary nav change. */

import { viewFromHash, type AppView } from './routing'

/** Matches the CSS breakpoint that swaps the sidebar for the phone nav. */
export const PHONE_MAX_WIDTH_PX = 860

export type DeviceRole = 'phone' | 'desktop'

export type DeviceSurface =
  | 'tracking'
  | 'overview'
  | 'knowledge'
  | 'arrangement'
  | 'files'
  | 'settings'
  | 'run'

export type SurfacePlacement = 'primary' | 'secondary'

export type DeviceSurfaceSpec = {
  id: DeviceSurface
  label: string
  placement: SurfacePlacement
}

const DESKTOP_SURFACES: readonly DeviceSurfaceSpec[] = [
  { id: 'overview', label: 'Übersicht', placement: 'primary' },
  { id: 'knowledge', label: 'Wissen', placement: 'primary' },
  { id: 'arrangement', label: 'Anordnung', placement: 'primary' },
  { id: 'files', label: 'Dateien', placement: 'primary' },
  { id: 'settings', label: 'Einstellungen', placement: 'primary' },
  { id: 'tracking', label: 'Heute', placement: 'secondary' },
  { id: 'run', label: 'Run', placement: 'secondary' },
]

const PHONE_SURFACES: readonly DeviceSurfaceSpec[] = [
  { id: 'tracking', label: 'Heute', placement: 'primary' },
  { id: 'overview', label: 'Übersicht', placement: 'secondary' },
  { id: 'knowledge', label: 'Wissen', placement: 'secondary' },
  { id: 'arrangement', label: 'Anordnung', placement: 'secondary' },
  { id: 'files', label: 'Dateien', placement: 'secondary' },
  { id: 'settings', label: 'Einstellungen', placement: 'secondary' },
  { id: 'run', label: 'Run', placement: 'secondary' },
]

export function deviceRoleFromWidth(width: number): DeviceRole {
  return width <= PHONE_MAX_WIDTH_PX ? 'phone' : 'desktop'
}

export function readDeviceRole(): DeviceRole {
  if (typeof window === 'undefined') return 'desktop'
  return deviceRoleFromWidth(window.innerWidth)
}

export function surfacesFor(role: DeviceRole): readonly DeviceSurfaceSpec[] {
  switch (role) {
    case 'desktop':
      return DESKTOP_SURFACES
    case 'phone':
      return PHONE_SURFACES
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

export function surfacesByPlacement(role: DeviceRole, placement: SurfacePlacement): DeviceSurfaceSpec[] {
  return surfacesFor(role).filter(surface => surface.placement === placement)
}

export function homeView(role: DeviceRole): AppView {
  switch (role) {
    case 'desktop':
      return 'progress'
    case 'phone':
      return 'today'
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

/** The phone writes tracking snapshots. The desktop reads them and must not echo one back. */
export function devicePushesSnapshots(role: DeviceRole): boolean {
  switch (role) {
    case 'phone':
      return true
    case 'desktop':
      return false
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

/** Phone opens on the morning ritual. Desktop opens on the overview. */
export function surfaceOpensMorningGate(role: DeviceRole): boolean {
  switch (role) {
    case 'phone':
      return true
    case 'desktop':
      return false
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

/** Existing view for a surface. Settings stays a modal, not a route. */
export function viewForSurface(surface: DeviceSurface): AppView | null {
  switch (surface) {
    case 'tracking':
      return 'today'
    case 'overview':
      return 'progress'
    case 'knowledge':
      return 'knowledge'
    case 'arrangement':
      return 'dashboardPlus'
    case 'files':
      return 'inbox'
    case 'run':
      return 'run'
    case 'settings':
      return null
    default: {
      const _exhaustive: never = surface
      return _exhaustive
    }
  }
}

function isBareLanding(hash: string): boolean {
  const raw = hash.replace(/^#/, '').trim()
  return raw === '' || raw === '/'
}

/** Empty address follows the role. An explicit hash keeps its view. */
export function resolveLaunchView(role: DeviceRole, hash: string): AppView {
  if (isBareLanding(hash)) return homeView(role)
  const withHash = hash.startsWith('#') ? hash : `#${hash}`
  return viewFromHash(withHash)
}
