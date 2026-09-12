import { ipcMain } from 'electron'
import { ssmService } from '../aws/ssmService.js'

export function registerSsmHandlers() {
  ipcMain.handle('ssm:runAndWait', (_event, projectId, payload) => ssmService.runAndWait(projectId, payload))

  ipcMain.handle('ssm:listManagedInstanceIds', (_event, projectId) => ssmService.listManagedInstanceIds(projectId))
}
