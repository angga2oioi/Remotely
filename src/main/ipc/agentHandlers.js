import { ipcMain } from 'electron'
import { appSettingsStore } from '../store/appSettingsStore.js'
import { agentService } from '../agent/agentService.js'
import { ec2Service } from '../aws/ec2Service.js'
import { runbookStore } from '../store/runbookStore.js'
import { instanceTagStore } from '../store/instanceTagStore.js'
import { projectStore } from '../store/projectStore.js'
import { sshTargetService } from '../ssh/sshTargetService.js'

export function registerAgentHandlers() {
  ipcMain.handle('agent:getSettings', async () => {
    const { agent } = await appSettingsStore.get()
    if (!agent) return null
    // Never send the API key itself back to the renderer.
    return { baseUrl: agent.baseUrl, model: agent.model, hasApiKey: Boolean(agent.apiKey) }
  })

  // A blank apiKey means "keep the existing one" — lets the UI offer an
  // edit flow for baseUrl/model without forcing the key to be retyped.
  // Never return the raw key back to the renderer.
  ipcMain.handle('agent:saveSettings', async (_event, { baseUrl, apiKey, model }) => {
    const { agent: existing } = await appSettingsStore.get()
    const nextApiKey = apiKey || existing?.apiKey
    if (!nextApiKey) throw new Error('An API key is required.')
    await appSettingsStore.update({ agent: { baseUrl, apiKey: nextApiKey, model } })
    return { baseUrl, model, hasApiKey: true }
  })

  ipcMain.handle('agent:interpret', async (_event, projectId, messages) => {
    const { agent } = await appSettingsStore.get()
    if (!agent?.baseUrl || !agent?.apiKey || !agent?.model) {
      throw new Error('Agent mode is not configured yet — set an endpoint, API key, and model first.')
    }

    const project = await projectStore.get(projectId)
    if (!project) throw new Error('Unknown project')

    const [instances, runbooks] = await Promise.all([
      project.type === 'ssh' ? sshTargetService.list(projectId) : listAwsInstancesWithTags(projectId),
      runbookStore.list()
    ])

    return agentService.interpret({
      baseUrl: agent.baseUrl,
      apiKey: agent.apiKey,
      model: agent.model,
      messages,
      instances,
      runbooks,
      resourceType: project.type
    })
  })
}

async function listAwsInstancesWithTags(projectId) {
  const [instances, localTagsByInstance] = await Promise.all([
    ec2Service.listInstances(projectId),
    instanceTagStore.listForProject(projectId)
  ])
  return instances.map((instance) => ({
    ...instance,
    localTags: localTagsByInstance[instance.id] ?? []
  }))
}
