import { app } from 'electron'
import path from 'path'
import { readCollection, writeCollection } from './jsonStore.js'

const INSTANCE_TAGS_FILE = path.join(app.getPath('userData'), 'instanceTags.json')

/**
 * Local, app-only labels on an instance — never sent to AWS. Used to
 * organize/filter the EC2 list within Remotely (e.g. "prod", "db-primary"),
 * distinct from real AWS tags shown read-only from DescribeInstances.
 */
export const instanceTagStore = {
  /** Returns { [instanceId]: string[] } for every tagged instance in the project. */
  async listForProject(projectId) {
    const records = await readCollection(INSTANCE_TAGS_FILE)
    const result = {}
    for (const record of records) {
      if (record.projectId === projectId) result[record.instanceId] = record.tags
    }
    return result
  },

  async addTag(projectId, instanceId, tag) {
    const records = await readCollection(INSTANCE_TAGS_FILE)
    let record = records.find((r) => r.projectId === projectId && r.instanceId === instanceId)
    if (!record) {
      record = { projectId, instanceId, tags: [] }
      records.push(record)
    }
    if (!record.tags.includes(tag)) record.tags.push(tag)
    await writeCollection(INSTANCE_TAGS_FILE, records)
    return record.tags
  },

  async removeTag(projectId, instanceId, tag) {
    const records = await readCollection(INSTANCE_TAGS_FILE)
    const record = records.find((r) => r.projectId === projectId && r.instanceId === instanceId)
    if (!record) return []
    record.tags = record.tags.filter((t) => t !== tag)
    await writeCollection(INSTANCE_TAGS_FILE, records)
    return record.tags
  },

  async exportAll() {
    return readCollection(INSTANCE_TAGS_FILE)
  },

  async replaceAll(records) {
    await writeCollection(INSTANCE_TAGS_FILE, records)
    return true
  }
}
