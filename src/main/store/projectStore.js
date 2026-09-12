import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'
import { readCollection, writeCollection } from './jsonStore.js'

const PROJECTS_FILE = path.join(app.getPath('userData'), 'projects.json')

/**
 * Local "projects" are the top-level grouping the UI is organized around —
 * each one owns exactly one AWS credential set (see credentialVault, keyed
 * by project id) and its own set of runbooks.
 */
export const projectStore = {
  async list() {
    return readCollection(PROJECTS_FILE)
  },

  async get(id) {
    const projects = await readCollection(PROJECTS_FILE)
    return projects.find((p) => p.id === id) ?? null
  },

  async create({ name, region }) {
    const projects = await readCollection(PROJECTS_FILE)
    const project = {
      id: crypto.randomUUID(),
      name,
      region,
      createdAt: new Date().toISOString()
    }
    projects.push(project)
    await writeCollection(PROJECTS_FILE, projects)
    return project
  },

  async update(id, patch) {
    const projects = await readCollection(PROJECTS_FILE)
    const index = projects.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Unknown project: ${id}`)
    projects[index] = { ...projects[index], ...patch }
    await writeCollection(PROJECTS_FILE, projects)
    return projects[index]
  },

  async remove(id) {
    const projects = await readCollection(PROJECTS_FILE)
    await writeCollection(
      PROJECTS_FILE,
      projects.filter((p) => p.id !== id)
    )
    return true
  }
}
