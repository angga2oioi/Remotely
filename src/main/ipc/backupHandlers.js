import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { settingsBackupService } from '../backup/settingsBackupService.js'

export function registerBackupHandlers() {
  ipcMain.handle('backup:export', async (event, password) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const envelope = await settingsBackupService.exportAll(password)

    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Export Remotely Backup',
      defaultPath: `remotely-backup-${new Date().toISOString().slice(0, 10)}.remotely-backup`,
      filters: [{ name: 'Remotely Backup', extensions: ['remotely-backup', 'json'] }]
    })
    if (canceled || !filePath) return { canceled: true }

    await fs.writeFile(filePath, JSON.stringify(envelope))
    return { canceled: false, filePath }
  })

  ipcMain.handle('backup:import', async (event, password) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import Remotely Backup',
      properties: ['openFile'],
      filters: [{ name: 'Remotely Backup', extensions: ['remotely-backup', 'json'] }]
    })
    if (canceled || filePaths.length === 0) return { canceled: true }

    const raw = await fs.readFile(filePaths[0], 'utf-8')
    let envelope
    try {
      envelope = JSON.parse(raw)
    } catch {
      throw new Error('This file is not a recognized Remotely backup.')
    }

    const summary = await settingsBackupService.importAll(envelope, password)
    return { canceled: false, ...summary }
  })
}
