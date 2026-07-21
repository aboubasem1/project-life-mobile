/** Hash routing for Life OS views — no router dependency. */

export type AppView = 'today' | 'plan' | 'checkin' | 'progress' | 'dashboardPlus'

const HASH_TO_VIEW: Record<string, AppView> = {
  '': 'today',
  '/': 'today',
  '/heute': 'today',
  '/today': 'today',
  '/plan': 'plan',
  '/checkin': 'checkin',
  '/check-in': 'checkin',
  '/verlauf': 'progress',
  '/progress': 'progress',
  '/labor': 'dashboardPlus',
  '/dashboard': 'dashboardPlus',
  '/dashboard-plus': 'dashboardPlus',
}

const VIEW_TO_HASH: Record<AppView, string> = {
  today: '#/heute',
  plan: '#/plan',
  checkin: '#/checkin',
  progress: '#/verlauf',
  dashboardPlus: '#/labor',
}

export function viewFromHash(hash = window.location.hash): AppView {
  const raw = hash.replace(/^#/, '').trim()
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return HASH_TO_VIEW[path] ?? HASH_TO_VIEW[path.replace(/\/$/, '')] ?? 'today'
}

export function hashFromView(view: AppView): string {
  return VIEW_TO_HASH[view]
}

export function navigateHash(view: AppView, replace = false): void {
  const next = hashFromView(view)
  if (window.location.hash === next) return
  if (replace) window.history.replaceState(null, '', next)
  else window.location.hash = next
}
