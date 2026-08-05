/** Hash routing for Life OS views — no router dependency. */

export type AppView = 'today' | 'plan' | 'checkin' | 'progress' | 'dashboardPlus'

export type AppActionKind = 'focus' | 'checkin' | 'note' | 'plan' | 'add-task' | 'today'

export type AppAction = {
  kind: AppActionKind
  minutes?: number
  title?: string
}

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

const ACTION_TO_VIEW: Record<AppActionKind, AppView> = {
  focus: 'today',
  checkin: 'checkin',
  note: 'today',
  plan: 'plan',
  'add-task': 'plan',
  today: 'today',
}

function splitHash(hash: string): { path: string; query: string } {
  const raw = hash.replace(/^#/, '').trim()
  const qIndex = raw.indexOf('?')
  if (qIndex < 0) {
    const path = raw.startsWith('/') ? raw : `/${raw}`
    return { path, query: '' }
  }
  const pathPart = raw.slice(0, qIndex)
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  return { path, query: raw.slice(qIndex + 1) }
}

export function hashPathOnly(hash = window.location.hash): string {
  const { path } = splitHash(hash)
  const normalized = path.replace(/\/$/, '') || '/'
  return `#${normalized === '/' ? '/heute' : normalized}`
}

export function viewFromHash(hash = window.location.hash): AppView {
  const { path } = splitHash(hash)
  const normalized = path.replace(/\/$/, '') || '/'
  return HASH_TO_VIEW[normalized] ?? HASH_TO_VIEW[path] ?? 'today'
}

export function hashFromView(view: AppView): string {
  return VIEW_TO_HASH[view]
}

export function navigateHash(view: AppView, replace = false): void {
  const next = hashFromView(view)
  if (hashPathOnly(window.location.hash) === next && !window.location.hash.includes('?')) return
  if (replace) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  else window.location.hash = next
}

function parseActionParams(params: URLSearchParams): AppAction | null {
  const raw = (params.get('action') ?? params.get('a') ?? '').trim().toLowerCase()
  if (!raw) return null

  const kind: AppActionKind | null =
    raw === 'focus' || raw === 'fokus' ? 'focus'
      : raw === 'checkin' || raw === 'check-in' ? 'checkin'
        : raw === 'note' || raw === 'notiz' || raw === 'notes' ? 'note'
          : raw === 'plan' ? 'plan'
            : raw === 'add-task' || raw === 'task' || raw === 'aufgabe' ? 'add-task'
              : raw === 'today' || raw === 'heute' ? 'today'
                : null

  if (!kind) return null

  const minutesRaw = Number(params.get('min') ?? params.get('minutes') ?? '')
  const minutes = Number.isFinite(minutesRaw) && minutesRaw >= 5
    ? Math.min(120, Math.max(5, Math.round(minutesRaw)))
    : undefined
  const title = (params.get('title') ?? params.get('t') ?? '').trim() || undefined

  return { kind, minutes, title }
}

/** Read action from hash query (`#/heute?action=focus`) and/or search (`?action=focus#/heute`). */
export function peekAppAction(
  hash = window.location.hash,
  search = window.location.search,
): AppAction | null {
  const { query } = splitHash(hash)
  return parseActionParams(new URLSearchParams(query))
    ?? parseActionParams(new URLSearchParams(search.startsWith('?') ? search.slice(1) : search))
}

export function viewForAction(action: AppAction): AppView {
  return ACTION_TO_VIEW[action.kind]
}

/** Parse action once, then strip it from the URL so refresh does not re-fire. */
export function takeAppActionFromLocation(): AppAction | null {
  const action = peekAppAction()
  if (!action) return null

  const view = viewForAction(action)
  const nextHash = hashFromView(view)
  const params = new URLSearchParams(window.location.search.startsWith('?')
    ? window.location.search.slice(1)
    : window.location.search)
  params.delete('action')
  params.delete('a')
  params.delete('min')
  params.delete('minutes')
  params.delete('title')
  params.delete('t')
  const nextSearch = params.toString()
  const url = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`
  window.history.replaceState(null, '', url)
  return action
}

/** Absolute deep-link URLs for Shortcuts / Automations. */
export function buildActionUrl(kind: AppActionKind, opts?: { minutes?: number; title?: string }): string {
  const view = ACTION_TO_VIEW[kind]
  const base = `${window.location.origin}${window.location.pathname}`
  const params = new URLSearchParams()
  params.set('action', kind === 'add-task' ? 'add-task' : kind)
  if (opts?.minutes) params.set('min', String(opts.minutes))
  if (opts?.title) params.set('title', opts.title)
  return `${base}${hashFromView(view)}?${params.toString()}`
}

export const SHORTCUT_RECIPES: Array<{ label: string; kind: AppActionKind; hint: string }> = [
  { label: 'Heute öffnen', kind: 'today', hint: 'Kurzbefehl → URL öffnen' },
  { label: 'Fokus starten', kind: 'focus', hint: 'Optional: &min=25' },
  { label: 'Check-in', kind: 'checkin', hint: 'Abend-Automation' },
  { label: 'Kurznotiz', kind: 'note', hint: 'Springt zum Merkzettel' },
  { label: 'Plan / Aufgabe', kind: 'add-task', hint: 'Neue Aufgabe anlegen' },
]
