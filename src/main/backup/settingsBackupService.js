import crypto from 'crypto'
import { projectStore } from '../store/projectStore.js'
import { runbookStore } from '../store/runbookStore.js'
import { instanceTagStore } from '../store/instanceTagStore.js'
import { credentialVault } from '../vault/credentialVault.js'
import { appSettingsStore } from '../store/appSettingsStore.js'

const ENVELOPE_FORMAT = 'remotely-backup'
const ENVELOPE_VERSION = 1
const PAYLOAD_SCHEMA = 'remotely.backup.v1'

const SCRYPT_KEY_LENGTH = 32 // AES-256
const SALT_LENGTH = 16
const IV_LENGTH = 12 // recommended for GCM

function encryptWithPassword(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

function decryptWithPassword(envelope, password) {
  if (envelope?.format !== ENVELOPE_FORMAT) {
    throw new Error('This file is not a recognized Remotely backup.')
  }
  const salt = Buffer.from(envelope.salt, 'base64')
  const key = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  const iv = Buffer.from(envelope.iv, 'base64')
  const authTag = Buffer.from(envelope.authTag, 'base64')
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    // GCM's auth tag check fails for a wrong key (wrong password) or a
    // tampered/corrupted file — both collapse to the same message since
    // there's no way to tell them apart from the ciphertext alone.
    throw new Error('Incorrect password, or the backup file is corrupted.')
  }
}

/**
 * Bundles every project, its AWS credentials, runbooks, instance tags, and
 * agent mode settings into one password-encrypted file, so it can be moved
 * to another device. safeStorage ties its encryption to this OS user/
 * machine, so secrets are decrypted here and re-encrypted with the given
 * password (AES-256-GCM, scrypt-derived key) instead of copied as-is.
 */
export const settingsBackupService = {
  async exportAll(password) {
    const [projects, runbooks, instanceTags, vault, appSettings] = await Promise.all([
      projectStore.exportAll(),
      runbookStore.exportAll(),
      instanceTagStore.exportAll(),
      credentialVault.exportAll(),
      appSettingsStore.exportAll()
    ])

    const payload = {
      schema: PAYLOAD_SCHEMA,
      exportedAt: new Date().toISOString(),
      projects,
      runbooks,
      instanceTags,
      vault,
      appSettings
    }

    return encryptWithPassword(JSON.stringify(payload), password)
  },

  async importAll(envelope, password) {
    const plaintext = decryptWithPassword(envelope, password)
    let payload
    try {
      payload = JSON.parse(plaintext)
    } catch {
      throw new Error('This file is not a recognized Remotely backup.')
    }
    if (payload.schema !== PAYLOAD_SCHEMA) {
      throw new Error('This file is not a recognized Remotely backup.')
    }

    await Promise.all([
      projectStore.replaceAll(payload.projects ?? []),
      runbookStore.replaceAll(payload.runbooks ?? []),
      instanceTagStore.replaceAll(payload.instanceTags ?? []),
      credentialVault.replaceAll(payload.vault ?? {}),
      appSettingsStore.replaceAll(payload.appSettings ?? {})
    ])

    return {
      projectCount: (payload.projects ?? []).length,
      runbookCount: (payload.runbooks ?? []).length
    }
  }
}
