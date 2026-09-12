import { ipcMain, dialog, BrowserWindow } from 'electron'
import { bootstrapSsmAgent } from '../ssh/ssmBootstrap.js'

export function registerSshHandlers() {
  ipcMain.handle('ssh:pickKeyFile', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Select private key',
      properties: ['openFile'],
      filters: [
        { name: 'Private Key', extensions: ['pem', 'ppk', 'key'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('ssh:bootstrapSsm', (_event, params) => bootstrapSsmAgent(params))
}
