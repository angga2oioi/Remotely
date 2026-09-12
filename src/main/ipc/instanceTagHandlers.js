import { ipcMain } from 'electron'
import { instanceTagStore } from '../store/instanceTagStore.js'

export function registerInstanceTagHandlers() {
  ipcMain.handle('instanceTag:listForProject', (_event, projectId) => instanceTagStore.listForProject(projectId))

  ipcMain.handle('instanceTag:add', (_event, projectId, instanceId, tag) =>
    instanceTagStore.addTag(projectId, instanceId, tag)
  )

  ipcMain.handle('instanceTag:remove', (_event, projectId, instanceId, tag) =>
    instanceTagStore.removeTag(projectId, instanceId, tag)
  )
}
