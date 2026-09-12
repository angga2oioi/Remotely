import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

const VAULT_FILE = path.join(app.getPath('userData'), 'vault.json')

async function readVaultFile() {
  try {
    const raw = await fs.readFile(VAULT_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

async function writeVaultFile(data) {
  await fs.mkdir(path.dirname(VAULT_FILE), { recursive: true })
  await fs.writeFile(VAULT_FILE, JSON.stringify(data), { mode: 0o600 })
}

/**
 * Encrypted-at-rest storage for AWS credential profiles.
 * Uses Electron's OS-backed safeStorage (DPAPI/Keychain/libsecret) so
 * plaintext secrets never touch disk.
 */
export const credentialVault = {
  async listProfiles() {
    const store = await readVaultFile()
    return Object.keys(store)
  },

  async saveProfile(name, credentials) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level credential encryption is not available on this machine')
    }
    const store = await readVaultFile()
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials))
    store[name] = encrypted.toString('base64')
    await writeVaultFile(store)
    return true
  },

  async getProfile(name) {
    const store = await readVaultFile()
    const encoded = store[name]
    if (!encoded) return null
    const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'))
    return JSON.parse(decrypted)
  },

  async deleteProfile(name) {
    const store = await readVaultFile()
    delete store[name]
    await writeVaultFile(store)
    return true
  },

  /**
   * Decrypts every stored profile — used only to build a password-encrypted
   * backup bundle for moving to another device. safeStorage ties its
   * encryption to this OS user/machine, so the raw vault.json contents are
   * never portable as-is; the backup re-encrypts with a user password instead.
   */
  async exportAll() {
    const store = await readVaultFile()
    const result = {}
    for (const [name, encoded] of Object.entries(store)) {
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'))
      result[name] = JSON.parse(decrypted)
    }
    return result
  },

  /** Replaces the entire vault with the given plaintext profiles, encrypting each via safeStorage. */
  async replaceAll(profiles) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level credential encryption is not available on this machine')
    }
    const store = {}
    for (const [name, credentials] of Object.entries(profiles)) {
      store[name] = safeStorage.encryptString(JSON.stringify(credentials)).toString('base64')
    }
    await writeVaultFile(store)
    return true
  }
}
