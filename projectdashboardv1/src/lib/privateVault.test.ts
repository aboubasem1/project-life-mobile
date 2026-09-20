import { describe, expect, it } from 'vitest'
import {
  createPrivateNote,
  decryptPrivateVault,
  encryptPrivateVault,
  mergePrivateVaultEnvelopes,
} from './privateVault'

describe('private vault', () => {
  it('encrypts and decrypts notes with the correct passcode', async () => {
    const note = createPrivateNote('Nur für mich', new Date('2026-09-20T21:00:00Z'))
    const envelope = await encryptPrivateVault('482901', [note], new Date('2026-09-20T21:01:00Z'))

    expect(envelope.ciphertext).not.toContain('Nur für mich')
    await expect(decryptPrivateVault('482901', envelope)).resolves.toEqual([note])
  })

  it('rejects a wrong passcode', async () => {
    const envelope = await encryptPrivateVault('482901', [createPrivateNote('Geheim')])
    await expect(decryptPrivateVault('000000', envelope)).rejects.toThrow('Passcode falsch')
  })

  it('keeps the newest encrypted envelope during sync', async () => {
    const older = await encryptPrivateVault('482901', [], new Date('2026-09-20T20:00:00Z'))
    const newer = await encryptPrivateVault('482901', [], new Date('2026-09-20T21:00:00Z'))
    expect(mergePrivateVaultEnvelopes(older, newer)?.updatedAt).toBe('2026-09-20T21:00:00.000Z')
  })
})

