#!/usr/bin/env node
/**
 * LifeOS Reel batch importer (Node 20+, no npm dependencies).
 * Reads a fully local folder (Windows iCloud export or VPS sync), streams videos
 * via existing authenticated LifeOS storage/reel endpoints, and lets the existing
 * Postgres worker do all transcribing, OCR, classification and reviewing.
 * Does not read Apple credentials and never deletes the original media.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, mkdir, readdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const TYPES = new Map([['.mp4', 'video/mp4'], ['.mov', 'video/quicktime'], ['.m4v', 'video/x-m4v'], ['.webm', 'video/webm']])
const MAX_VIDEO_BYTES = 512 * 1024 * 1024 // Matches LifeOS storage-api.ts
const STATE_FILE = '.lifeos-reel-batch-state.json'
const sleep = ms => new Promise(r => setTimeout(r, ms))

export function parseArgs(argv) {
  const opts = { dir: '', watch: false, dryRun: false, maxPerRun: 25, pollSeconds: 300, readyAgeSeconds: 180 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--watch') opts.watch = true
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (['--dir', '--max-per-run', '--poll-seconds', '--ready-age-seconds'].includes(arg)) {
      if (!argv[i + 1]) throw Error(`Missing value: ${arg}`)
      const name = ({ '--dir': 'dir', '--max-per-run': 'maxPerRun', '--poll-seconds': 'pollSeconds', '--ready-age-seconds': 'readyAgeSeconds' })[arg]
      opts[name] = arg === '--dir' ? argv[++i] : Number(argv[++i])
    } else throw Error(`Unknown argument: ${arg}`)
  }
  if (!opts.help && !opts.dir) throw Error('Use --dir <fully-downloaded-video-folder>')
  if (![opts.maxPerRun, opts.pollSeconds, opts.readyAgeSeconds].every(Number.isSafeInteger)
      || opts.maxPerRun < 1 || opts.maxPerRun > 400 || opts.pollSeconds < 10 || opts.readyAgeSeconds < 0) {
    throw Error('Invalid limits: --max-per-run 1..400, --poll-seconds >=10, --ready-age-seconds >=0')
  }
  return opts
}

export function credentials(env = process.env) {
  const input = (env.LIFEOS_URL ?? '').trim().replace(/\/$/, '')
  let url
  try { url = new URL(input) } catch { throw Error('Set LIFEOS_URL to the HTTPS URL of your LifeOS server.') }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw Error('LIFEOS_URL must be an HTTPS origin without path, query, or credentials.')
  }
  if (!env.LIFEOS_ROOM_ID?.trim() || !env.LIFEOS_DEVICE_TOKEN?.trim()) {
    throw Error('Set LIFEOS_ROOM_ID and LIFEOS_DEVICE_TOKEN from your paired LifeOS account. Never commit them.')
  }
  return { origin: url.origin, room: env.LIFEOS_ROOM_ID.trim(), token: env.LIFEOS_DEVICE_TOKEN.trim() }
}

export async function listVideos(folder) {
  const videos = []
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const path = join(directory, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) await walk(path)
      else if (e.isFile() && TYPES.has(extname(e.name).toLowerCase())) videos.push(path)
    }
  }
  await walk(folder)
  return videos.sort((a,b) => a.localeCompare(b))
}

async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function loadState(statePath) {
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'))
    return { completed: state.completed && typeof state.completed === 'object' ? state.completed : {}, pending: state.pending && typeof state.pending === 'object' ? state.pending : {} }
  } catch (err) {
    if (err.code === 'ENOENT') return { completed: {}, pending: {} }
    throw new Error(`State file is unreadable. Refusing to reset and duplicate uploads: ${err.message}`)
  }
}

async function persistState(statePath, state) {
  await mkdir(dirname(statePath), { recursive: true })
  const temp = `${statePath}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 })
  await rename(temp, statePath)
}

function requestHeaders(auth) {
  return { Authorization: `Bearer ${auth.token}`, 'X-Life-Os-Room': auth.room }
}

async function checkedResponse(url, init, stage) {
  const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(10 * 60_000) })
  if (!response.ok) {
    const txt = await response.text().catch(() => '')
    const error = new Error(`${stage}: HTTP ${response.status} ${txt.slice(0, 300)}`)
    error.status = response.status
    throw error
  }
  return response
}

async function postJson(auth, path, data) {
  const response = await checkedResponse(`${auth.origin}${path}`, {
    method: 'POST',
    headers: { ...requestHeaders(auth), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, path)
  return response.json()
}

async function uploadStream(auth, url, headers, path, size) {
  const target = new URL(url, auth.origin)
  // The current LifeOS backend returns same-origin proxy or signed local URLs.
  // Refuse untrusted upload hosts to prevent accidental video disclosure.
  if (target.origin !== auth.origin || !['https:', 'http:'].includes(target.protocol)) {
    throw Error('Storage returned an unexpected cross-origin upload URL; refusing to send the video.')
  }
  return checkedResponse(target.href, {
    method: 'PUT',
    headers: { ...headers, ...requestHeaders(auth), 'Content-Length': String(size) },
    body: createReadStream(path),
    duplex: 'half',
  }, 'video upload')
}

async function attempt(fn, stage) {
  let last
  for (let n = 0; n < 3; n++) {
    try { return await fn() } catch (err) {
      last = err
      // No automatic retry for auth or invalid uploads.
      if ((err.status && ![408, 429, 500, 502, 503, 504].includes(err.status)) || n === 2) break
      await sleep(1000 * (2 ** n))
    }
  }
  throw new Error(`${stage}: ${last?.message ?? 'unknown error'}`)
}

async function importOne(auth, path, size, checksum, state, statePath) {
  let pending = state.pending[checksum]
  // Presigned URLs can expire before the next run if upload was interrupted.
  if (pending && !pending.uploaded && (!pending.createdAt || Date.now() - Date.parse(pending.createdAt) > 8 * 60_000)) {
    delete state.pending[checksum]
    await persistState(statePath, state)
    pending = undefined
  }
  const name = basename(path)
  const contentType = TYPES.get(extname(name).toLowerCase())
  if (!pending) {
    const presigned = await attempt(() => postJson(auth, '/api/storage/presign-upload', {
      category: 'media', fileName: name, contentType, sizeBytes: size, checksumSha256: checksum,
    }), 'presign')
    pending = { objectId: presigned.objectId, storageKey: presigned.storageKey,
      uploadUrl: presigned.uploadUrl, uploadHeaders: presigned.uploadHeaders, uploaded: false, sizeBytes: size, fileName: name, contentType, createdAt: new Date().toISOString() }
    state.pending[checksum] = pending
    await persistState(statePath, state)
  }
  if (pending.sizeBytes !== size) throw Error('File size changed since presign; move source to a stable folder and retry.')
  if (!pending.uploaded) {
    await attempt(() => uploadStream(auth, pending.uploadUrl, pending.uploadHeaders ?? {}, path, size), 'upload')
    pending.uploaded = true
    await persistState(statePath, state)
  }
  await attempt(() => postJson(auth, '/api/storage/complete', {
    objectId: pending.objectId, storageKey: pending.storageKey,
    fileName: pending.fileName, contentType: pending.contentType, sizeBytes: pending.sizeBytes,
  }), 'complete')
  const registered = await attempt(() => postJson(auth, '/api/reels/register', {
    objectId: pending.objectId, checksumSha256: checksum, lifeAreas: [],
  }), 'register')
  state.completed[checksum] = { reelId: registered.reel?.id ?? null,
    duplicate: Boolean(registered.duplicate), registeredAt: new Date().toISOString(), fileName: name }
  delete state.pending[checksum]
  await persistState(statePath, state)
  return state.completed[checksum]
}

export async function runBatch(opts, env = process.env, logger = console) {
  const folder = await realpath(resolve(opts.dir))
  if (!(await stat(folder)).isDirectory()) throw Error('Not a folder: ' + folder)
  const statePath = join(folder, STATE_FILE)
  const state = await loadState(statePath)
  const paths = await listVideos(folder)
  const ready = []
  for (const path of paths) {
    const info = await lstat(path)
    if (info.size <= 0 || info.size > MAX_VIDEO_BYTES) continue
    // Files being downloaded/synced often have a fresh mtime. Avoid partial copies.
    if (Date.now() - info.mtimeMs < opts.readyAgeSeconds * 1000) continue
    ready.push({ path, size: info.size, mtimeMs: info.mtimeMs })
  }
  logger.log(`[LifeOS] found ${paths.length} video(s), ${ready.length} ready by age/size checks; dryRun=${opts.dryRun}`)
  if (opts.dryRun) return { found: paths.length, ready: ready.length, uploaded: 0, skipped: 0, failed: 0 }
  const auth = credentials(env)
  let uploaded = 0, skipped = 0, failed = 0, attempted = 0
  for (const file of ready) {
    if (attempted >= opts.maxPerRun) break
    try {
      const checksum = await hashFile(file.path)
      const after = await stat(file.path)
      if (after.size !== file.size || after.mtimeMs !== file.mtimeMs) {
        logger.warn(`[LifeOS] changing file skipped: ${basename(file.path)}`)
        continue
      }
      if (state.completed[checksum]) { skipped++; continue }
      attempted++
      const result = await importOne(auth, file.path, file.size, checksum, state, statePath)
      uploaded++
      logger.log(`[LifeOS] ${uploaded}/${opts.maxPerRun} queued: ${basename(file.path)} reel=${result.reelId} duplicate=${result.duplicate}`)
    } catch (err) {
      failed++
      // Never print credentials or the full upload URL.
      logger.error(`[LifeOS] failed: ${basename(file.path)} (${err.message})`)
    }
  }
  logger.log(`[LifeOS] run complete: queued=${uploaded}, previously imported=${skipped}, failed=${failed}`)
  return { found: paths.length, ready: ready.length, uploaded, skipped, failed }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log('Usage: node reel-batch-import.mjs --dir <local video folder> [--dry-run] [--max-per-run 25] [--watch] [--poll-seconds 300] [--ready-age-seconds 180]')
    return
  }
  do {
    const result = await runBatch(opts)
    if (!opts.watch) { if (result.failed) process.exitCode = 1; break }
    await sleep(opts.pollSeconds * 1000)
  } while (true)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(err => { console.error(`[LifeOS] ${err.message}`); process.exitCode = 1 })
}
