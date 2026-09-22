/** Hash routing for Life OS views — no router dependency. */

export type AppView =
  | 'today'
  | 'plan'
  | 'checkin'
  | 'progress'
  | 'dashboardPlus'
  | 'inbox'
  | 'project'
  | 'goal'
  | 'knowledge'
  | 'decisions'
  | 'reviews'
  | 'signals'
  | 'insights'
  | 'integrations'

export type AppActionKind = 'focus' | 'checkin' | 'note' | 'plan' | 'add-task' | 'today' | 'log' | 'capture'

export type AppActionEnergy = 'low' | 'okay' | 'high'

export type AppAction = {
  kind: AppActionKind
  minutes?: number
  title?: string
  /** Raw Quick-Add string, e.g. "180g protein" */
  text?: string
  protein?: number
  calories?: number
  water?: number
  steps?: number
  weight?: number
  energy?: AppActionEnergy
  habit?: string
}

const HASH_TO_VIEW: Record<string, AppView> = {
  '': 'today',
  '/': 'today',
  '/heute': 'today',
  '/today': 'today',
  '/plan': 'plan',
  '/lab/plan': 'plan',
  '/checkin': 'progress',
  '/check-in': 'progress',
  '/lab': 'progress',
  '/verlauf': 'progress',
  '/progress': 'progress',
  '/lab/daten': 'dashboardPlus',
  '/labor': 'dashboardPlus',
  '/dashboard': 'dashboardPlus',
  '/dashboard-plus': 'dashboardPlus',
  '/inbox': 'inbox',
  '/project': 'project',
  '/goal': 'goal',
  '/knowledge': 'knowledge',
  '/wissen': 'knowledge',
  '/decisions': 'decisions',
  '/entscheidungen': 'decisions',
  '/reviews': 'reviews',
  '/signals': 'signals',
  '/signale': 'signals',
  '/insights': 'insights',
  '/integrations': 'integrations',
}

const VIEW_TO_HASH: Record<AppView, string> = {
  today: '#/heute',
  plan: '#/lab/plan',
  checkin: '#/lab',
  progress: '#/lab',
  dashboardPlus: '#/lab/daten',
  inbox: '#/inbox',
  project: '#/project',
  goal: '#/goal',
  knowledge: '#/knowledge',
  decisions: '#/decisions',
  reviews: '#/reviews',
  signals: '#/signals',
  insights: '#/insights',
  integrations: '#/integrations',
}

const ACTION_TO_VIEW: Record<AppActionKind, AppView> = {
  focus: 'today',
  checkin: 'today',
  note: 'today',
  plan: 'plan',
  'add-task': 'plan',
  today: 'today',
  log: 'today',
  capture: 'inbox',
}

export const VIEW_LABELS: Record<AppView, string> = {
  today: 'Heute',
  plan: 'Lab · Plan',
  checkin: 'Lab',
  progress: 'Lab',
  dashboardPlus: 'Lab · Daten',
  inbox: 'Inbox',
  project: 'Projekt',
  goal: 'Ziel',
  knowledge: 'Wissen',
  decisions: 'Entscheidungen',
  reviews: 'Reviews',
  signals: 'Signale',
  insights: 'Insights',
  integrations: 'Integrationen',
}

export function entityIdFromHash(hash = window.location.hash): string | undefined {
  const { query } = splitHash(hash)
  const id = new URLSearchParams(query).get('id')?.trim()
  return id || undefined
}

export function navigateHashWithId(view: AppView, id?: string, replace = false): void {
  const base = hashFromView(view)
  const next = id ? `${base}?id=${encodeURIComponent(id)}` : base
  if (replace) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  else window.location.hash = next
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

export const PROGRESS_HUB_VIEWS: AppView[] = ['progress', 'dashboardPlus', 'plan']

export function isProgressHubView(view: AppView): boolean {
  return view === 'progress' || view === 'dashboardPlus' || view === 'plan'
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
                : raw === 'log' || raw === 'quick' || raw === 'metric' ? 'log'
              : raw === 'capture' || raw === 'inbox' ? 'capture'
                  : null

  if (!kind) return null

  const minutesRaw = Number(params.get('min') ?? params.get('minutes') ?? '')
  const minutes = Number.isFinite(minutesRaw) && minutesRaw >= 5
    ? Math.min(120, Math.max(5, Math.round(minutesRaw)))
    : undefined
  const title = (params.get('title') ?? params.get('t') ?? '').trim() || undefined
  const text = (params.get('text') ?? params.get('q') ?? '').trim() || undefined
  const energyRaw = (params.get('energy') ?? '').trim().toLowerCase()
  const energy: AppActionEnergy | undefined =
    energyRaw === 'low' || energyRaw === 'okay' || energyRaw === 'high' ? energyRaw : undefined

  return {
    kind,
    minutes,
    title,
    text,
    protein: optionalNumber(params.get('protein') ?? params.get('p')),
    calories: optionalNumber(params.get('kcal') ?? params.get('calories')),
    water: optionalNumber(params.get('water') ?? params.get('l')),
    steps: optionalNumber(params.get('steps')),
    weight: optionalNumber(params.get('kg') ?? params.get('weight')),
    energy,
    habit: (params.get('habit') ?? '').trim() || undefined,
  }
}

function optionalNumber(raw: string | null): number | undefined {
  if (!raw) return undefined
  const value = Number(String(raw).replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
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
  params.delete('text')
  params.delete('q')
  params.delete('protein')
  params.delete('p')
  params.delete('kcal')
  params.delete('calories')
  params.delete('water')
  params.delete('l')
  params.delete('steps')
  params.delete('kg')
  params.delete('weight')
  params.delete('energy')
  params.delete('habit')
  const nextSearch = params.toString()
  const url = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`
  window.history.replaceState(null, '', url)
  return action
}

/** Absolute deep-link URLs for Shortcuts / Automations. */
export function buildActionUrl(
  kind: AppActionKind,
  opts?: { minutes?: number; title?: string; text?: string },
): string {
  const view = ACTION_TO_VIEW[kind]
  const base = `${window.location.origin}${window.location.pathname}`
  const params = new URLSearchParams()
  params.set('action', kind === 'add-task' ? 'add-task' : kind)
  if (opts?.minutes) params.set('min', String(opts.minutes))
  if (opts?.title) params.set('title', opts.title)
  if (opts?.text) params.set('text', opts.text)
  return `${base}${hashFromView(view)}?${params.toString()}`
}

export const SHORTCUT_RECIPES: Array<{ label: string; kind: AppActionKind; hint: string; text?: string }> = [
  { label: 'Heute öffnen', kind: 'today', hint: 'Kurzbefehl → URL öffnen' },
  { label: 'Fokus starten', kind: 'focus', hint: 'Optional: &min=25' },
  { label: 'Routine Check-in', kind: 'checkin', hint: 'Öffnet Morning- oder Evening Gate' },
  { label: 'Kurznotiz', kind: 'note', hint: 'Kurzbefehl / Brille: &text= durch Diktat ersetzen', text: 'DEIN TEXT' },
  { label: 'Aufgabe anlegen', kind: 'add-task', hint: '&title=Creatine holen' },
  { label: 'Protein loggen', kind: 'log', hint: 'Schreibt ins Heute-Protokoll', text: '180g protein' },
  { label: 'Capture in Inbox', kind: 'capture', hint: 'Erst erfassen, später sortieren', text: 'DEIN TEXT' },
]
