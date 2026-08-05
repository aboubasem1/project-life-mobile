import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function loadLocalEnvFiles(): void {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'projectdashboardv1', '.env.local'),
    path.join(process.cwd(), '..', '.env.local'),
  ]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    try {
      const text = readFileSync(file, 'utf8')
      for (const rawLine of text.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq <= 0) continue
        const key = line.slice(0, eq).trim()
        const value = line.slice(eq + 1).trim()
        if (!key.startsWith('UPSTASH_')) continue
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      /* ignore */
    }
  }
}

loadLocalEnvFiles()

export type SyncSnapshot = {
  revision: number
  updatedAt: string
  entries: unknown[]
  settings?: unknown
  dashboardPlus?: unknown
  xp?: unknown
  quickNote?: unknown
}

export type SyncRoom = {
  roomId: string
  deviceTokens: string[]
  pairCode: string | null
  pairCodeExpiresAt: number | null
  snapshot: SyncSnapshot | null
  createdAt: string
  updatedAt: string
}

type SyncStoreFile = {
  rooms: Record<string, SyncRoom>
  pairIndex: Record<string, string>
}

const MEMORY_KEY = '__lifeOsSyncStore'
const LOCAL_FILE = path.join(process.cwd(), 'projectdashboardv1', '.data', 'life-os-sync.json')
const MAX_SNAPSHOT_CHARS = 1_400_000

function memoryStore(): SyncStoreFile {
  const g = globalThis as typeof globalThis & { [MEMORY_KEY]?: SyncStoreFile }
  if (!g[MEMORY_KEY]) {
    g[MEMORY_KEY] = { rooms: {}, pairIndex: {} }
  }
  return g[MEMORY_KEY]!
}

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashFetch(command: unknown[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash nicht konfiguriert')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!response.ok) {
    throw new Error(`Upstash Fehler (${response.status})`)
  }
  const payload = await response.json() as { result?: unknown; error?: string }
  if (payload.error) throw new Error(payload.error)
  return payload.result
}

async function readLocalFile(): Promise<SyncStoreFile> {
  try {
    const raw = await readFile(LOCAL_FILE, 'utf8')
    const parsed = JSON.parse(raw) as SyncStoreFile
    return {
      rooms: parsed.rooms ?? {},
      pairIndex: parsed.pairIndex ?? {},
    }
  } catch {
    return { rooms: {}, pairIndex: {} }
  }
}

async function writeLocalFile(store: SyncStoreFile): Promise<void> {
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true })
  await writeFile(LOCAL_FILE, JSON.stringify(store), 'utf8')
}

export async function getRoom(roomId: string): Promise<SyncRoom | null> {
  if (hasUpstash()) {
    const raw = await upstashFetch(['GET', `lifeos:sync:room:${roomId}`])
    if (typeof raw !== 'string' || !raw) return null
    return JSON.parse(raw) as SyncRoom
  }
  if (process.env.VERCEL) {
    // Ephemeral fallback so API still responds with a clear error path via nulls
    return memoryStore().rooms[roomId] ?? null
  }
  const store = await readLocalFile()
  return store.rooms[roomId] ?? null
}

export async function getRoomIdByPairCode(pairCode: string): Promise<string | null> {
  if (hasUpstash()) {
    const raw = await upstashFetch(['GET', `lifeos:sync:pair:${pairCode}`])
    return typeof raw === 'string' && raw ? raw : null
  }
  if (process.env.VERCEL) {
    return memoryStore().pairIndex[pairCode] ?? null
  }
  const store = await readLocalFile()
  return store.pairIndex[pairCode] ?? null
}

export async function saveRoom(room: SyncRoom, previousPairCode?: string | null): Promise<void> {
  if (room.snapshot) {
    const size = JSON.stringify(room.snapshot).length
    if (size > MAX_SNAPSHOT_CHARS) {
      throw new Error('Sync-Daten zu groß. Bitte ältere Einträge per Backup aufräumen.')
    }
  }

  if (hasUpstash()) {
    await upstashFetch(['SET', `lifeos:sync:room:${room.roomId}`, JSON.stringify(room)])
    if (previousPairCode && previousPairCode !== room.pairCode) {
      await upstashFetch(['DEL', `lifeos:sync:pair:${previousPairCode}`])
    }
    if (room.pairCode && room.pairCodeExpiresAt) {
      const ttlSeconds = Math.max(1, Math.ceil((room.pairCodeExpiresAt - Date.now()) / 1000))
      await upstashFetch(['SET', `lifeos:sync:pair:${room.pairCode}`, room.roomId, 'EX', ttlSeconds])
    }
    return
  }

  if (process.env.VERCEL) {
    const store = memoryStore()
    if (previousPairCode && previousPairCode !== room.pairCode) {
      delete store.pairIndex[previousPairCode]
    }
    store.rooms[room.roomId] = room
    if (room.pairCode) store.pairIndex[room.pairCode] = room.roomId
    return
  }

  const store = await readLocalFile()
  if (previousPairCode && previousPairCode !== room.pairCode) {
    delete store.pairIndex[previousPairCode]
  }
  // drop expired pair codes
  for (const [code, id] of Object.entries(store.pairIndex)) {
    const other = store.rooms[id]
    if (!other?.pairCode || !other.pairCodeExpiresAt || other.pairCodeExpiresAt < Date.now()) {
      if (other) {
        other.pairCode = null
        other.pairCodeExpiresAt = null
      }
      delete store.pairIndex[code]
    }
  }
  store.rooms[room.roomId] = room
  if (room.pairCode) store.pairIndex[room.pairCode] = room.roomId
  await writeLocalFile(store)
}

export function syncStorageMode(): 'upstash' | 'file' | 'memory' {
  if (hasUpstash()) return 'upstash'
  if (process.env.VERCEL) return 'memory'
  return 'file'
}
