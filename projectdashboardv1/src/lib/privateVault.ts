export const PRIVATE_VAULT_KEY = 'life-os-private-vault-v1'

const VAULT_VERSION = 1
const PBKDF2_ITERATIONS = 250_000
const ADDITIONAL_DATA = new TextEncoder().encode('life-os-private-vault-v1')

export type PrivateNote = {
  id: string
  text: string
  createdAt: string
  updatedAt: string
}

export type PrivateVaultEnvelope = {
  version: 1
  salt: string
  iv: string
  ciphertext: string
  updatedAt: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function deriveVaultKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function normalizeNotes(raw: unknown): PrivateNote[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<PrivateNote>
      const id = typeof record.id === 'string' ? record.id : ''
      const text = typeof record.text === 'string' ? record.text.trim().slice(0, 10_000) : ''
      if (!id || !text) return null
      const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString()
      const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : createdAt
      return { id, text, createdAt, updatedAt }
    })
    .filter((item): item is PrivateNote => Boolean(item))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function normalizePrivateVaultEnvelope(raw: unknown): PrivateVaultEnvelope | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<PrivateVaultEnvelope>
  if (
    record.version !== VAULT_VERSION
    || typeof record.salt !== 'string'
    || typeof record.iv !== 'string'
    || typeof record.ciphertext !== 'string'
    || typeof record.updatedAt !== 'string'
  ) return null
  return {
    version: VAULT_VERSION,
    salt: record.salt,
    iv: record.iv,
    ciphertext: record.ciphertext,
    updatedAt: record.updatedAt,
  }
}

export function createPrivateNote(text: string, at = new Date()): PrivateNote {
  const timestamp = at.toISOString()
  return {
    id: crypto.randomUUID(),
    text: text.trim().slice(0, 10_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export async function encryptPrivateVault(
  passcode: string,
  notes: PrivateNote[],
  at = new Date(),
): Promise<PrivateVaultEnvelope> {
  if (!crypto?.subtle) throw new Error('Verschlüsselung wird auf diesem Gerät nicht unterstützt.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveVaultKey(passcode, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify({ notes: normalizeNotes(notes) }))
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(ADDITIONAL_DATA),
    },
    key,
    asArrayBuffer(plaintext),
  )
  return {
    version: VAULT_VERSION,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: at.toISOString(),
  }
}

export async function decryptPrivateVault(
  passcode: string,
  rawEnvelope: unknown,
): Promise<PrivateNote[]> {
  const envelope = normalizePrivateVaultEnvelope(rawEnvelope)
  if (!envelope) throw new Error('Privater Bereich ist beschädigt oder nicht lesbar.')
  try {
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const ciphertext = base64ToBytes(envelope.ciphertext)
    const key = await deriveVaultKey(passcode, salt)
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: asArrayBuffer(iv),
        additionalData: asArrayBuffer(ADDITIONAL_DATA),
      },
      key,
      asArrayBuffer(ciphertext),
    )
    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as { notes?: unknown }
    return normalizeNotes(payload.notes)
  } catch {
    throw new Error('Passcode falsch oder privater Bereich nicht lesbar.')
  }
}

export function loadPrivateVaultEnvelope(): PrivateVaultEnvelope | null {
  try {
    return normalizePrivateVaultEnvelope(JSON.parse(localStorage.getItem(PRIVATE_VAULT_KEY) ?? 'null'))
  } catch {
    return null
  }
}

export function savePrivateVaultEnvelope(envelope: PrivateVaultEnvelope): void {
  localStorage.setItem(PRIVATE_VAULT_KEY, JSON.stringify(envelope))
}

export function mergePrivateVaultEnvelopes(left: unknown, right: unknown): PrivateVaultEnvelope | null {
  const local = normalizePrivateVaultEnvelope(left)
  const remote = normalizePrivateVaultEnvelope(right)
  if (!local) return remote
  if (!remote) return local
  return remote.updatedAt >= local.updatedAt ? remote : local
}
