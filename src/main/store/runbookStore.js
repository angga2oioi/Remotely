import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'
import { readCollection, writeCollection } from './jsonStore.js'

const RUNBOOKS_FILE = path.join(app.getPath('userData'), 'runbooks.json')

/**
 * A runbook is a named, reusable shell command sequence scoped to a project
 * (e.g. "Restart nginx" -> ["sudo systemctl restart nginx"]), executed
 * against a chosen instance via SSM Run Command instead of SSH + a PEM key.
 */
export const runbookStore = {
  async list(projectId) {
    const runbooks = await readCollection(RUNBOOKS_FILE)
    return runbooks.filter((r) => r.projectId === projectId)
  },

  async create(projectId, { name, commands }) {
    const runbooks = await readCollection(RUNBOOKS_FILE)
    const runbook = {
      id: crypto.randomUUID(),
      projectId,
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

  async removeByProject(projectId) {
    const runbooks = await readCollection(RUNBOOKS_FILE)
    await writeCollection(
      RUNBOOKS_FILE,
      runbooks.filter((r) => r.projectId !== projectId)
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
