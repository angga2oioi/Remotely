import { promises as fs } from 'fs'
import path from 'path'

/**
 * Minimal read/modify/write helper for the small JSON collections (projects,
 * runbooks) the app keeps in userData. Not for secrets — see credentialVault
 * for encrypted-at-rest storage.
 */
export async function readCollection(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

export async function writeCollection(filePath, records) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(records, null, 2))
}
