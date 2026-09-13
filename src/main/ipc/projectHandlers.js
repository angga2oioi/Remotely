import { ipcMain } from 'electron'
import { projectStore } from '../store/projectStore.js'
import { credentialVault } from '../vault/credentialVault.js'

export function registerProjectHandlers() {
  ipcMain.handle('project:list', () => projectStore.list())

  ipcMain.handle('project:create', async (_event, { name, region, type = 'aws', credentials }) => {
    const project = await projectStore.create({ name, region, type })
    const vaultEntry = type === 'ssh' ? { targets: [] } : { ...credentials, region }
    await credentialVault.saveProfile(project.id, vaultEntry)
    return project
  })

  ipcMain.handle('project:rename', (_event, id, name) => projectStore.update(id, { name }))

  ipcMain.handle('project:updateCredentials', (_event, id, credentials) =>
    credentialVault.saveProfile(id, credentials)
  )

  ipcMain.handle('project:hasCredentials', async (_event, id) => Boolean(await credentialVault.getProfile(id)))

  ipcMain.handle('project:delete', async (_event, id) => {
    await projectStore.remove(id)
    await credentialVault.deleteProfile(id)
    return true
  })
}
