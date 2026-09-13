import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'
import { readCollection, writeCollection } from './jsonStore.js'

const RUNBOOKS_FILE = path.join(app.getPath('userData'), 'runbooks.json')

/**
 * A runbook is a named, reusable shell command sequence (e.g. "Restart
 * nginx" -> ["sudo systemctl restart nginx"]), global across every project —
 * only *running* one is project-scoped (it needs that project's AWS
 * credentials to reach the target instance via SSM).
 */
export const runbookStore = {
  async list() {
    return readCollection(RUNBOOKS_FILE)
  },

  async create({ name, commands }) {
    const runbooks = await readCollection(RUNBOOKS_FILE)
    const runbook = {
      id: crypto.randomUUID(),
      name,
      commands,
      createdAt: new Date().toISOString()
    }
    runbooks.push(runbook)
    await writeCollection(RUNBOOKS_FILE, runbooks)
    return runbook
  },

  async update(id, patch) {
    const runbooks = await readCollection(RUNBOOKS_FILE)
    const index = runbooks.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`Unknown runbook: ${id}`)
    runbooks[index] = { ...runbooks[index], ...patch }
    await writeCollection(RUNBOOKS_FILE, runbooks)
    return runbooks[index]
  },

  async remove(id) {
    const runbooks = await readCollection(RUNBOOKS_FILE)
    await writeCollection(
      RUNBOOKS_FILE,
      runbooks.filter((r) => r.id !== id)
    )
    return true
  },

  async exportAll() {
    return readCollection(RUNBOOKS_FILE)
  },

  async replaceAll(runbooks) {
    await writeCollection(RUNBOOKS_FILE, runbooks)
    return true
  }
}
