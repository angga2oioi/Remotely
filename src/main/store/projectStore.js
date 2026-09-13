import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'
import { readCollection, writeCollection } from './jsonStore.js'

const PROJECTS_FILE = path.join(app.getPath('userData'), 'projects.json')

// Projects created before the 'type' field existed default to 'aws'.
function withDefaultType(project) {
  return project.type ? project : { ...project, type: 'aws' }
}

/**
 * Local "projects" are the top-level grouping the UI is organized around —
 * each one owns exactly one connection profile (see credentialVault, keyed
 * by project id) and can reach its resources over the transport implied by
 * `type`: 'aws' (EC2 discovered via the AWS API, commands run via SSM) or
 * 'ssh' (a manually curated list of hosts, commands run over a direct SSH
 * connection). Runbooks are shared across all projects regardless of type.
 */
export const projectStore = {
  async list() {
    const projects = await readCollection(PROJECTS_FILE)
    return projects.map(withDefaultType)
  },

  async get(id) {
    const projects = await readCollection(PROJECTS_FILE)
    const project = projects.find((p) => p.id === id)
    return project ? withDefaultType(project) : null
  },

  async create({ name, region, type = 'aws' }) {
    const projects = await readCollection(PROJECTS_FILE)
    const project = {
      id: crypto.randomUUID(),
      name,
      type,
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
  },

  async exportAll() {
    const projects = await readCollection(PROJECTS_FILE)
    return projects.map(withDefaultType)
  },

  async replaceAll(projects) {
    await writeCollection(PROJECTS_FILE, projects)
    return true
  }
}
