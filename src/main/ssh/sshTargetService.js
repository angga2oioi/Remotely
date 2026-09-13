import crypto from 'crypto'
import { credentialVault } from '../vault/credentialVault.js'

/**
 * For 'ssh'-type projects, the vault entry (normally AWS credentials) holds
 * a manually curated list of targets instead: { targets: [...] }. Reuses
 * the same encrypted-at-rest storage as AWS credentials since a host/user
 * list is just as sensitive a map of your infrastructure.
 */

// Never send a raw passphrase back to the renderer — same treatment as
// Agent Mode's API key. Callers that need it (running a command) read the
// full profile from credentialVault directly, not through list().
function redact(target) {
  const { passphrase, ...rest } = target
  return { ...rest, hasPassphrase: Boolean(passphrase) }
}

export const sshTargetService = {
  async list(projectId) {
    const profile = await credentialVault.getProfile(projectId)
    return (profile?.targets ?? []).map(redact)
  },

  async add(projectId, { name, host, port, username, privateKeyPath, passphrase }) {
    const profile = (await credentialVault.getProfile(projectId)) ?? { targets: [] }
    const target = {
      id: crypto.randomUUID(),
      name,
      host,
      port: port || 22,
      username,
      privateKeyPath,
      passphrase: passphrase || undefined
    }
    profile.targets = [...(profile.targets ?? []), target]
    await credentialVault.saveProfile(projectId, profile)
    return redact(target)
  },

  // A blank/omitted passphrase in `patch` keeps the existing one — pass an
  // explicit empty string to clear it.
  async update(projectId, targetId, patch) {
    const profile = await credentialVault.getProfile(projectId)
    if (!profile) throw new Error('Unknown project')
    profile.targets = (profile.targets ?? []).map((t) => {
      if (t.id !== targetId) return t
      const next = { ...t, ...patch }
      if (patch.passphrase === undefined) next.passphrase = t.passphrase
      return next
    })
    await credentialVault.saveProfile(projectId, profile)
    return redact(profile.targets.find((t) => t.id === targetId))
  },

  async remove(projectId, targetId) {
    const profile = await credentialVault.getProfile(projectId)
    if (!profile) return true
    profile.targets = (profile.targets ?? []).filter((t) => t.id !== targetId)
    await credentialVault.saveProfile(projectId, profile)
    return true
  },

  /** Unredacted (includes passphrase) — main-process-only use, e.g. to actually connect. */
  async getRaw(projectId, targetId) {
    const profile = await credentialVault.getProfile(projectId)
    return (profile?.targets ?? []).find((t) => t.id === targetId) ?? null
  }
}
