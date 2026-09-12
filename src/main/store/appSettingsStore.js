import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.enc')

/** Small encrypted-at-rest store for app-wide (non-per-project) secrets, e.g. the agent mode API key. */
export const appSettingsStore = {
  async get() {
    try {
      const raw = await fs.readFile(SETTINGS_FILE)
      return JSON.parse(safeStorage.decryptString(raw))
    } catch (err) {
      if (err.code === 'ENOENT') return {}
      throw err
    }
  },

  async update(patch) {
    const current = await appSettingsStore.get()
    const next = { ...current, ...patch }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level credential encryption is not available on this machine')
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(next))
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
    await fs.writeFile(SETTINGS_FILE, encrypted, { mode: 0o600 })
    return next
  },

  /** Decrypted settings, for building a password-encrypted backup bundle. */
  async exportAll() {
    return appSettingsStore.get()
  },

  /** Overwrites (not merges) the settings with the given plaintext object. */
  async replaceAll(settings) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level credential encryption is not available on this machine')
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(settings))
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
    await fs.writeFile(SETTINGS_FILE, encrypted, { mode: 0o600 })
    return settings
  }
}
