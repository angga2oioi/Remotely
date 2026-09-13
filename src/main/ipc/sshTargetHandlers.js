import { ipcMain } from 'electron'
import { sshTargetService } from '../ssh/sshTargetService.js'
import { runOverSsh } from '../ssh/sshRunbookRunner.js'

export function registerSshTargetHandlers() {
  ipcMain.handle('sshTarget:list', (_event, projectId) => sshTargetService.list(projectId))

  ipcMain.handle('sshTarget:add', (_event, projectId, target) => sshTargetService.add(projectId, target))

  ipcMain.handle('sshTarget:update', (_event, projectId, targetId, patch) =>
    sshTargetService.update(projectId, targetId, patch)
  )

  ipcMain.handle('sshTarget:remove', (_event, projectId, targetId) => sshTargetService.remove(projectId, targetId))

  ipcMain.handle('sshTarget:runAndWait', async (_event, projectId, { targetId, commands }) => {
    const target = await sshTargetService.getRaw(projectId, targetId)
    if (!target) throw new Error('Unknown SSH target')
    return runOverSsh({
      host: target.host,
      port: target.port,
      username: target.username,
      privateKeyPath: target.privateKeyPath,
      passphrase: target.passphrase,
      commands
    })
  })
}
